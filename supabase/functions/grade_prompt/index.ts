// Edge Function: grade_prompt
// The AI judge behind the Prompt Quest game. Given a learner's prompt for an
// arena_attempt, it scores the prompt against the Week-2 5-INGREDIENT recipe
// (WHO / WHAT / DETAILS / OUTPUT / STYLE), 0-2 each → /10, via Google Gemini.
//
// Security: requires a valid user JWT (verify_jwt = true). The caller may only
// grade their OWN attempt; the score is written with the service-role key so a
// learner can never set their own score (no client write policy exists). The
// prompt is saved as 'submitted' BEFORE grading so it's never lost on an LLM
// hiccup; a failed grade is retryable (status stays 'submitted', not 'graded').
//
// Requires secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const LOG = "[grade_prompt]";
const GEMINI_TIMEOUT_MS = 12_000;
// Order matters: lead with no-thinking / high-availability models. The plain
// `gemini-2.5-flash` alias is a *thinking* model that can spend the whole output
// budget on hidden reasoning and return empty text, and it frequently 503s — so
// it goes last. (Same ordering rationale as the ingest_feeds function.)
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"];

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RUBRIC_SYSTEM = `You are a strict but fair grading judge for a prompt-writing game.

Students are learning the 5-INGREDIENT recipe for talking to AI:
- WHO: give the AI a role/persona to act as (e.g. "Act as a patient tutor").
- WHAT: state the exact task clearly (not vague).
- DETAILS: who it's for, what they already know, and the limits/constraints (length, budget, level, etc.).
- OUTPUT: the shape the answer should take (bullets, step-by-step, ask one at a time, a table, under N words...).
- STYLE: tone, language, or simplicity level (e.g. "simple English", "to a 9-year-old", "confident but not exaggerated").

You score a student's PROMPT — NOT an answer to it — for how well it uses the five ingredients to handle the given SCENARIO.

Scoring per ingredient: 0 = missing, 1 = vague/partial, 2 = clear and specific.
Be consistent and do not be generous:
- A prompt that just restates the scenario as a question earns low scores.
- Writing the label words ("WHO: ...") without real substance is NOT a 2.
- A very short prompt cannot earn 2 on DETAILS.
- If the prompt is empty, gibberish, or ignores the scenario, give all zeros.
The prompt does NOT need to literally label the ingredients — judge whether each idea is present and specific.

Output ONLY JSON matching the schema.`;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: "server misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);
  const uid = userData.user.id;

  let body: { attempt_id?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid body" }, 400);
  }

  const attemptId = String(body.attempt_id ?? "");
  const prompt = String(body.prompt ?? "").trim();
  if (!attemptId) return json({ ok: false, error: "attempt_id required" }, 400);
  if (!prompt) return json({ ok: false, error: "Write a prompt before submitting." }, 400);
  if (prompt.length > 4000) return json({ ok: false, error: "That prompt is too long." }, 400);

  // Load the attempt; verify ownership.
  const { data: attempt, error: aErr } = await admin
    .from("arena_attempts")
    .select("id, user_id, round, status, topic_id, score, breakdown, feedback, strengths, fixes")
    .eq("id", attemptId)
    .maybeSingle();
  if (aErr) return json({ ok: false, error: aErr.message }, 500);
  if (!attempt) return json({ ok: false, error: "attempt not found" }, 404);
  if (attempt.user_id !== uid) return json({ ok: false, error: "forbidden" }, 403);

  // Already graded → idempotent return (single submission per round, final).
  if (attempt.status === "graded") {
    return json({
      ok: true,
      already: true,
      score: attempt.score,
      breakdown: attempt.breakdown,
      feedback: attempt.feedback,
      strengths: attempt.strengths,
      fixes: attempt.fixes,
    });
  }

  const { data: topic } = await admin
    .from("arena_topics")
    .select("scenario, audience, round")
    .eq("id", attempt.topic_id)
    .maybeSingle();
  const scenario = topic?.scenario ?? "";
  const audience = topic?.audience ?? "";

  // Save the prompt first so it's never lost if the LLM call fails.
  await admin
    .from("arena_attempts")
    .update({ prompt_text: prompt, status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", attemptId);

  let graded: GradeResult;
  try {
    graded = await gradeWithGemini(scenario, audience, attempt.round, prompt, geminiApiKey);
  } catch (e) {
    console.log(`${LOG} grade failed:`, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Scoring is busy right now — please try again in a moment." }, 502);
  }

  const breakdown = {
    who: clampSub(graded.who),
    what: clampSub(graded.what),
    details: clampSub(graded.details),
    output: clampSub(graded.output),
    style: clampSub(graded.style),
  };
  const score = breakdown.who + breakdown.what + breakdown.details + breakdown.output + breakdown.style;

  const { error: upErr } = await admin
    .from("arena_attempts")
    .update({
      status: "graded",
      score,
      breakdown,
      feedback: (graded.feedback ?? "").trim() || null,
      strengths: (graded.strengths ?? "").trim() || null,
      fixes: (graded.fixes ?? "").trim() || null,
      graded_at: new Date().toISOString(),
    })
    .eq("id", attemptId);
  if (upErr) return json({ ok: false, error: upErr.message }, 500);

  return json({
    ok: true,
    score,
    breakdown,
    feedback: graded.feedback,
    strengths: graded.strengths,
    fixes: graded.fixes,
  });
});

interface GradeResult {
  who: number;
  what: number;
  details: number;
  output: number;
  style: number;
  strengths: string;
  fixes: string;
  feedback: string;
}

function clampSub(n: unknown): number {
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(2, x));
}

async function gradeWithGemini(
  scenario: string,
  audience: string,
  round: string,
  prompt: string,
  apiKey: string,
): Promise<GradeResult> {
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  let lastErr: Error | null = null;
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiModel(model, scenario, audience, round, prompt, apiKey);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Fall through to the next model on anything EXCEPT a hard client error
      // (bad key / malformed request) that another model won't fix. This means
      // an empty/non-JSON response from one model still tries the others.
      if (/http (400|401|403)/.test(lastErr.message)) break;
      console.log(`${LOG} model ${model} failed, trying next:`, lastErr.message.slice(0, 140));
    }
  }
  throw lastErr ?? new Error("no models attempted");
}

async function callGeminiModel(
  model: string,
  scenario: string,
  audience: string,
  round: string,
  prompt: string,
  apiKey: string,
): Promise<GradeResult> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const userText =
    `SCENARIO (difficulty: ${round}):\n${scenario}\n\n` +
    `INTENDED AUDIENCE / PERSONA:\n${audience || "(none given)"}\n\n` +
    `STUDENT'S PROMPT:\n"""\n${prompt}\n"""\n\n` +
    `Score each of the five ingredients 0-2 for THIS prompt against THIS scenario. ` +
    `In "strengths" (max 25 words) name what they did well. ` +
    `In "fixes" (max 35 words) give the single most useful improvement, naming the weak/missing ingredient(s). ` +
    `In "feedback" (max 30 words) write one short, encouraging sentence.`;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: 800,
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        who: { type: "integer" },
        what: { type: "integer" },
        details: { type: "integer" },
        output: { type: "integer" },
        style: { type: "integer" },
        strengths: { type: "string" },
        fixes: { type: "string" },
        feedback: { type: "string" },
      },
      required: ["who", "what", "details", "output", "style", "strengths", "fixes", "feedback"],
    },
  };
  // Turn OFF thinking on 2.5 models — otherwise the reasoning tokens eat the
  // output budget and the model returns empty text. (Invalid on 2.0, so gate it.)
  if (model.startsWith("gemini-2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const reqBody = {
    systemInstruction: { parts: [{ text: RUBRIC_SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
  let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`gemini http ${res.status}: ${t.slice(0, 160)}`);
    }
    data = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: Partial<GradeResult>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("gemini returned non-JSON");
    parsed = JSON.parse(m[0]);
  }

  return {
    who: Number(parsed.who ?? 0),
    what: Number(parsed.what ?? 0),
    details: Number(parsed.details ?? 0),
    output: Number(parsed.output ?? 0),
    style: Number(parsed.style ?? 0),
    strengths: String(parsed.strengths ?? ""),
    fixes: String(parsed.fixes ?? ""),
    feedback: String(parsed.feedback ?? ""),
  };
}
