// Edge Function: ingest_feeds
// Pulls active RSS sources, simplifies entries via Gemini 2.5 Flash, proxies cover
// images into the `branding` bucket, and inserts straight into `feed_items`
// with status='published'. No teacher review step.
//
// Invoked hourly by pg_cron via net.http_post, or manually from the teacher dashboard.

/// <reference path="./deno.d.ts" />
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import { corsHeaders, handleCorsPreflight, jsonResponse } from "../_shared/cors.ts";

// ---------- Constants ----------

const LOG = "[ingest_feeds]";
const RSS_TIMEOUT_MS = 8_000;
const ARTICLE_TIMEOUT_MS = 3_000; // kept for future use; article scraping is currently skipped
const IMAGE_TIMEOUT_MS = 5_000;
const GEMINI_TIMEOUT_MS = 6_000;
const MAX_IMAGE_BYTES = 800_000;
const MAX_SOURCES_PER_RUN = 3;    // keep wall-clock time under 150 s
const MAX_ITEMS_PER_SOURCE = 2;   // 3 sources × 2 items = 6 LLM calls worst-case
const MAX_ITEMS_PER_RUN = 10;
const MAX_LLM_CALLS_PER_RUN = 10;
// A run open longer than this is considered crashed/timed-out and will be
// purged at the start of the next invocation so the guard index is freed.
const STALE_RUN_MINUTES = 4;
const USER_AGENT = "EduConnect-Feed/1.0";
const BRANDING_BUCKET = "branding";
const COVERS_PREFIX = "feed-covers";

const SIMPLIFIER_SYSTEM_PROMPT =
  "You rewrite AI/tech news for a high-school student. Plain language, no jargon, no hype. Output only JSON.";

// ---------- Types ----------

interface FeedSource {
  id: string;
  name: string;
  rss_url: string;
  is_active: boolean;
  consecutive_failures: number | null;
}

interface NormalizedEntry {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  enclosureUrl: string | null;
  mediaContent: { url: string } | null;
}

interface SimplifierResult {
  title_simple: string;
  summary_simple: string;
}

interface RunError {
  source_id?: string;
  source_name?: string;
  message: string;
}

interface IngestSummary {
  ok: boolean;
  items_inserted: number;
  llm_calls: number;
  errors: RunError[];
}

// ---------- Entrypoint ----------

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  // Auth: accept service-role bearer (cron / server) OR a teacher's user JWT (UI).
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

  const authHeader = req.headers.get("Authorization") ?? "";
  const internalCron = req.headers.get("x-internal-cron") ?? "";
  const expectedInternalCron = Deno.env.get("INTERNAL_CRON_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "supabase env missing" }, 500);
  }

  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const serviceRoleOk = bearerToken.length > 0 && bearerToken === serviceRoleKey;
  const cronOk = expectedInternalCron.length > 0 &&
    internalCron === expectedInternalCron;

  let teacherOk = false;
  if (!serviceRoleOk && !cronOk && bearerToken.length > 0) {
    // Validate user JWT and confirm role='teacher' before accepting.
    const authClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(bearerToken);
    if (!userErr && userData?.user) {
      const { data: profile } = await authClient
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      teacherOk = profile?.role === "teacher";
    }
  }

  if (!serviceRoleOk && !cronOk && !teacherOk) {
    console.log(`${LOG} unauthorized invocation`);
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Run synchronously for all calls — teacher JWT included.
  // EdgeRuntime.waitUntil does not reliably extend isolate lifetime on the
  // Supabase hosted runtime: the isolate is recycled almost immediately after
  // the 202 Response is returned, killing background work before it completes.
  // A full 7-source ingest typically finishes in 30–60 s, well within the
  // 150 s wall-clock limit, and the browser has no built-in request timeout.
  // The `?background=1` query-param escape hatch is kept for any future use.
  const url = new URL(req.url);
  const wantBackground = url.searchParams.get("background") === "1";

  if (wantBackground) {
    const work = runIngest(supabase, geminiApiKey).then((s) => {
      console.log(`${LOG} background run finished`, s);
    }).catch((e) => {
      console.log(`${LOG} background run crashed`, e);
    });
    // EdgeRuntime.waitUntil keeps the isolate alive until the promise settles.
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") er.waitUntil(work);
    return new Response(
      JSON.stringify({ ok: true, status: "started", message: "Ingest running in background" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const summary = await runIngest(supabase, geminiApiKey);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`${LOG} unhandled error in runIngest:`, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});

// ---------- Orchestrator ----------

async function runIngest(
  supabase: SupabaseClient,
  geminiApiKey: string,
): Promise<IngestSummary> {
  console.log(`${LOG} run starting`);

  // Close any run row that has been open longer than STALE_RUN_MINUTES.
  // This happens when a previous execution was killed by the 150 s wall-clock
  // limit before finalizeRun could write finished_at.  Without this cleanup,
  // the concurrent-guard unique index would block every future invocation.
  const staleThreshold = new Date(Date.now() - STALE_RUN_MINUTES * 60 * 1000).toISOString();
  // Fire-and-forget: no .select() / head:true needed — just close the rows.
  const { error: staleErr } = await supabase
    .from("feed_ingest_runs")
    .update({ finished_at: new Date().toISOString() })
    .is("finished_at", null)
    .lt("started_at", staleThreshold);
  if (staleErr) {
    // Non-fatal — log and continue; the INSERT below will detect the 23505 if the row is still open.
    console.log(`${LOG} stale-run cleanup warning:`, staleErr.message);
  } else {
    console.log(`${LOG} stale-run cleanup done`);
  }

  const { data: runRow, error: runErr } = await supabase
    .from("feed_ingest_runs")
    .insert({})
    .select("id")
    .single();

  if (runErr) {
    // 23505 = unique_violation — another run is already in progress (concurrent-guard index).
    // Treat as a clean no-op rather than an error so cron logs stay quiet.
    if ((runErr as { code?: string }).code === "23505") {
      console.log(`${LOG} concurrent run already active, skipping`);
      return { ok: true, items_inserted: 0, llm_calls: 0, errors: [] };
    }
    console.log(`${LOG} could not create run row`, runErr);
    return { ok: false, items_inserted: 0, llm_calls: 0, errors: [{ message: runErr.message ?? "run insert failed" }] };
  }
  if (!runRow) {
    return { ok: false, items_inserted: 0, llm_calls: 0, errors: [{ message: "run insert returned no row" }] };
  }
  const runId = runRow.id as string;

  const errors: RunError[] = [];
  let itemsInserted = 0;
  let llmCalls = 0;
  let sourcesSeen = 0;

  // Fetch the student profile once — single-student model, used for notifications.
  const { data: studentRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .limit(1)
    .maybeSingle();
  const studentId: string | null = studentRow?.id ?? null;

  const { data: sources, error: sourcesErr } = await supabase
    .from("feed_sources")
    .select("id, name, rss_url, is_active, consecutive_failures")
    .eq("is_active", true)
    .order("last_fetched_at", { ascending: true, nullsFirst: true })
    .limit(MAX_SOURCES_PER_RUN);

  if (sourcesErr) {
    console.log(`${LOG} feed_sources select failed:`, sourcesErr.message);
    errors.push({ message: `feed_sources select failed: ${sourcesErr.message}` });
    await finalizeRun(supabase, runId, sourcesSeen, itemsInserted, llmCalls, errors);
    return { ok: false, items_inserted: 0, llm_calls: 0, errors };
  }

  const activeSources = (sources ?? []) as FeedSource[];
  console.log(`${LOG} ${activeSources.length} active sources (cap=${MAX_SOURCES_PER_RUN})`);

  // Sequential per-source loop — RSS targets are flaky and we don't want to hammer them.
  // try/finally guarantees finalizeRun is called even if an unexpected exception
  // propagates past the per-source catch (e.g. Deno OOM, hard network reset).
  try {
    for (const source of activeSources) {
      if (itemsInserted >= MAX_ITEMS_PER_RUN) {
        console.log(`${LOG} run cap reached, stopping`);
        break;
      }
      sourcesSeen++;

      try {
        const remainingForRun = MAX_ITEMS_PER_RUN - itemsInserted;
        const remainingLLM = MAX_LLM_CALLS_PER_RUN - llmCalls;
        const sourceCap = Math.min(MAX_ITEMS_PER_SOURCE, remainingForRun, remainingLLM);

        if (sourceCap <= 0) break;

        const result = await processSource(
          supabase,
          source,
          sourceCap,
          geminiApiKey,
          studentId,
        );
        itemsInserted += result.itemsInserted;
        llmCalls += result.llmCalls;

        await supabase
          .from("feed_sources")
          .update({
            consecutive_failures: 0,
            last_fetched_at: new Date().toISOString(),
          })
          .eq("id", source.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(`${LOG} source error [${source.name}]:`, message);
        errors.push({ source_id: source.id, source_name: source.name, message });
        await supabase
          .from("feed_sources")
          .update({
            consecutive_failures: (source.consecutive_failures ?? 0) + 1,
          })
          .eq("id", source.id);
      }
    }
  } finally {
    // Always close the run row — even if the function is about to be killed.
    await finalizeRun(supabase, runId, sourcesSeen, itemsInserted, llmCalls, errors);
  }

  console.log(
    `${LOG} run finished: items=${itemsInserted} llm=${llmCalls} errors=${errors.length}`,
  );
  return { ok: true, items_inserted: itemsInserted, llm_calls: llmCalls, errors };
}

async function finalizeRun(
  supabase: SupabaseClient,
  runId: string,
  sourcesSeen: number,
  itemsInserted: number,
  llmCalls: number,
  errors: RunError[],
): Promise<void> {
  await supabase
    .from("feed_ingest_runs")
    .update({
      finished_at: new Date().toISOString(),
      sources_seen: sourcesSeen,
      items_inserted: itemsInserted,
      llm_calls: llmCalls,
      errors: errors.length > 0 ? errors : null,
    })
    .eq("id", runId);
}

// ---------- Per-source processing ----------

interface SourceResult {
  itemsInserted: number;
  llmCalls: number;
}

async function processSource(
  supabase: SupabaseClient,
  source: FeedSource,
  cap: number,
  geminiApiKey: string,
  studentId: string | null,
): Promise<SourceResult> {
  console.log(`${LOG} processing source [${source.name}] cap=${cap}`);

  const xml = await fetchWithTimeout(source.rss_url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
  }, RSS_TIMEOUT_MS).then((r) => r.text());

  const entries = parseFeed(xml);
  if (entries.length === 0) {
    console.log(`${LOG} [${source.name}] zero parsed entries`);
    return { itemsInserted: 0, llmCalls: 0 };
  }

  // Batch dedup — single query against feed_items for all candidate URLs.
  const candidateUrls = entries.map((e) => e.link).filter(Boolean);
  const existing = new Set<string>();
  if (candidateUrls.length > 0) {
    const { data: existingRows } = await supabase
      .from("feed_items")
      .select("source_url")
      .in("source_url", candidateUrls);
    for (const r of existingRows ?? []) {
      if (r.source_url) existing.add(r.source_url as string);
    }
  }

  const fresh = entries.filter((e) => e.link && !existing.has(e.link)).slice(0, cap);
  console.log(`${LOG} [${source.name}] ${entries.length} parsed, ${fresh.length} new`);

  let inserted = 0;
  let llmCalls = 0;

  for (const entry of fresh) {
    try {
      const cleanExcerpt = stripHtml(entry.description).slice(0, 2000);

      // Image: use RSS-native image only (enclosure / media:content).
      // Article-page og:image scraping is skipped — it adds 3 s per item and
      // frequently hits the 150 s wall-clock limit on the hosted runtime.
      const originalImage: string | null =
        entry.mediaContent?.url ?? entry.enclosureUrl ?? null;

      // We need an item id to name the storage object — generate one upfront.
      const newItemId = crypto.randomUUID();
      let coverImageUrl: string | null = null;
      if (originalImage) {
        coverImageUrl = await proxyImage(supabase, originalImage, newItemId).catch((err) => {
          console.log(`${LOG} image proxy failed:`, err instanceof Error ? err.message : err);
          return null;
        });
      }

      // Simplifier (Gemini)
      let simplified: SimplifierResult;
      let usedLLM = false;
      if (llmCalls < MAX_LLM_CALLS_PER_RUN && geminiApiKey) {
        try {
          simplified = await simplifyWithGemini(entry.title, cleanExcerpt, geminiApiKey);
          usedLLM = true;
        } catch (err) {
          console.log(`${LOG} gemini failed, using fallback:`, err instanceof Error ? err.message : err);
          simplified = fallbackSimplify(entry.title, cleanExcerpt);
        }
      } else {
        simplified = fallbackSimplify(entry.title, cleanExcerpt);
      }
      if (usedLLM) llmCalls++;

      const publishedAt = pickPublishedAt(entry.pubDate);

      const { error: insertErr } = await supabase.from("feed_items").insert({
        id: newItemId,
        type: "news",
        status: "published",
        title: simplified.title_simple,
        summary: simplified.summary_simple,
        cover_image_url: coverImageUrl,
        cover_image_url_original: originalImage,
        source_id: source.id,
        source_name: source.name,
        source_url: entry.link,
        published_at: publishedAt,
        created_by: null,
      });

      if (insertErr) {
        // Most likely a UNIQUE(source_url) race; treat as benign.
        console.log(`${LOG} insert skipped (${insertErr.code ?? "?"}): ${insertErr.message}`);
        continue;
      }

      inserted++;

      if (studentId) {
        await supabase.from("notifications").insert({
          recipient_id: studentId,
          type: "feed_item_published",
          title: "New in your feed",
          body: simplified.title_simple,
          related_id: newItemId,
        });
      }
    } catch (err) {
      // Per-entry failure must not stop the rest of this source.
      console.log(`${LOG} entry error:`, err instanceof Error ? err.message : err);
    }
  }

  return { itemsInserted: inserted, llmCalls };
}

// ---------- Feed parsing ----------

function parseFeed(xml: string): NormalizedEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    parseTagValue: false,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch (err) {
    console.log(`${LOG} XML parse error:`, err instanceof Error ? err.message : err);
    return [];
  }

  // RSS 2.0
  const rss = parsed.rss as Record<string, unknown> | undefined;
  if (rss && typeof rss === "object") {
    const channel = rss.channel as Record<string, unknown> | undefined;
    if (channel) {
      const items = toArray<Record<string, unknown>>(channel.item);
      return items.map(normalizeRssItem).filter((e) => e.link && e.title);
    }
  }

  // Atom
  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed && typeof feed === "object") {
    const entries = toArray<Record<string, unknown>>(feed.entry);
    return entries.map(normalizeAtomEntry).filter((e) => e.link && e.title);
  }

  return [];
}

function normalizeRssItem(item: Record<string, unknown>): NormalizedEntry {
  const title = readText(item.title);
  const link = readText(item.link);
  const description = readText(item.description) || readText(item["content:encoded"]);
  const pubDate = readText(item.pubDate) || readText(item["dc:date"]) || null;

  let enclosureUrl: string | null = null;
  const enclosure = item.enclosure as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const enclosureFirst = Array.isArray(enclosure) ? enclosure[0] : enclosure;
  if (enclosureFirst && typeof enclosureFirst === "object") {
    enclosureUrl = (enclosureFirst["@_url"] as string) ?? null;
  }

  let mediaContent: { url: string } | null = null;
  const media = item["media:content"] as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const mediaFirst = Array.isArray(media) ? media[0] : media;
  if (mediaFirst && typeof mediaFirst === "object") {
    const url = (mediaFirst["@_url"] as string) ?? null;
    if (url) mediaContent = { url };
  }
  if (!mediaContent) {
    const itunesImage = item["itunes:image"] as Record<string, unknown> | undefined;
    if (itunesImage && typeof itunesImage === "object") {
      const url = (itunesImage["@_href"] as string) ?? null;
      if (url) mediaContent = { url };
    }
  }

  return { title, link, description, pubDate, enclosureUrl, mediaContent };
}

function normalizeAtomEntry(entry: Record<string, unknown>): NormalizedEntry {
  const title = readText(entry.title);
  // Atom <link> is usually attribute-bearing; can be array of rels.
  let link = "";
  const rawLink = entry.link;
  if (Array.isArray(rawLink)) {
    const alt = rawLink.find((l) => {
      if (typeof l !== "object" || !l) return false;
      const rel = (l as Record<string, unknown>)["@_rel"];
      return !rel || rel === "alternate";
    });
    if (alt && typeof alt === "object") {
      link = ((alt as Record<string, unknown>)["@_href"] as string) ?? "";
    }
  } else if (rawLink && typeof rawLink === "object") {
    link = ((rawLink as Record<string, unknown>)["@_href"] as string) ?? "";
  } else if (typeof rawLink === "string") {
    link = rawLink;
  }

  const description = readText(entry.summary) || readText(entry.content);
  const pubDate = readText(entry.updated) || readText(entry.published) || null;

  let mediaContent: { url: string } | null = null;
  const media = entry["media:content"] as Record<string, unknown> | Record<string, unknown>[] | undefined;
  const mediaFirst = Array.isArray(media) ? media[0] : media;
  if (mediaFirst && typeof mediaFirst === "object") {
    const url = (mediaFirst["@_url"] as string) ?? null;
    if (url) mediaContent = { url };
  }

  return { title, link, description, pubDate, enclosureUrl: null, mediaContent };
}

function toArray<T = unknown>(v: unknown): T[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]) as T[];
}

function readText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj._ === "string") return obj._;
  }
  return "";
}

function pickPublishedAt(pubDate: string | null): string {
  if (!pubDate) return new Date().toISOString();
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return new Date().toISOString();
  // Reject obviously bogus future-dated entries by clamping to now.
  const now = Date.now();
  return new Date(Math.min(t, now)).toISOString();
}

// ---------- Image handling ----------

async function extractImageFromArticle(url: string): Promise<string | null> {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
  }, ARTICLE_TIMEOUT_MS);
  if (!res.ok) return null;
  const html = await res.text();
  const head = html.slice(0, 60_000); // og/twitter tags are always in <head>; bound the regex work.

  // Match <meta ... property="og:image" ... content="..."> in either attr order.
  const ogContent = matchMeta(head, /(?:property|name)=["']og:image(?::secure_url)?["']/);
  if (ogContent) return absolutize(ogContent, url);

  const twitterContent = matchMeta(head, /name=["']twitter:image["']/);
  if (twitterContent) return absolutize(twitterContent, url);

  // Body fallback: first <img src="...">.
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return absolutize(imgMatch[1], url);

  return null;
}

function matchMeta(head: string, identifierPattern: RegExp): string | null {
  // Look for any <meta> tag containing the identifier; grab its content="..." attr.
  const tagRe = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(head))) {
    const tag = m[0];
    if (!identifierPattern.test(tag)) continue;
    const c = tag.match(/content=["']([^"']+)["']/i);
    if (c) return c[1];
  }
  return null;
}

function absolutize(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

async function proxyImage(
  supabase: SupabaseClient,
  url: string,
  itemId: string,
): Promise<string | null> {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
  }, IMAGE_TIMEOUT_MS);
  if (!res.ok) return null;

  const declaredLen = Number(res.headers.get("content-length") ?? "0");
  if (declaredLen && declaredLen > MAX_IMAGE_BYTES) {
    console.log(`${LOG} image too big by header: ${declaredLen}`);
    return null;
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase().split(";")[0].trim();
  const ext = extFromContentType(contentType, url);
  if (!ext) return null;

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    console.log(`${LOG} image too big after read: ${buf.byteLength}`);
    return null;
  }

  const path = `${COVERS_PREFIX}/${itemId}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, new Uint8Array(buf), {
      contentType: contentType || `image/${ext}`,
      cacheControl: "31536000",
      upsert: true,
    });
  if (uploadErr) {
    console.log(`${LOG} upload error:`, uploadErr.message);
    return null;
  }

  const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}

function extFromContentType(ct: string, url: string): string | null {
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  // Last resort: sniff URL extension.
  const m = url.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i);
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
  return null;
}

// ---------- LLM ----------

async function simplifyWithGemini(
  title: string,
  excerpt: string,
  apiKey: string,
): Promise<SimplifierResult> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: SIMPLIFIER_SYSTEM_PROMPT }] },
    contents: [
      { role: "user", parts: [{ text: `Title: ${title}\n\nExcerpt: ${excerpt}` }] },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 300,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title_simple: { type: "string" },
          summary_simple: { type: "string" },
        },
        required: ["title_simple", "summary_simple"],
      },
    },
  };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, GEMINI_TIMEOUT_MS);

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`gemini http ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: Partial<SimplifierResult>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("gemini returned non-JSON");
    parsed = JSON.parse(m[0]);
  }

  const title_simple = (parsed.title_simple ?? "").trim();
  const summary_simple = (parsed.summary_simple ?? "").trim();
  if (!title_simple || !summary_simple) {
    throw new Error("gemini JSON missing required fields");
  }
  return { title_simple, summary_simple };
}

function fallbackSimplify(title: string, excerpt: string): SimplifierResult {
  return {
    title_simple: title.trim() || "Untitled",
    summary_simple: stripHtml(excerpt).slice(0, 240).trim() || "No summary available.",
  };
}

// ---------- Utilities ----------

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
