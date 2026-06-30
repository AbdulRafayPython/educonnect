# AI Feed — one-time setup checklist

The schema migrations and Edge Function are committed; one-time deploy steps below.

## 1. Push the migrations

```bash
# from repo root
npx supabase link --project-ref vltjeudovblmekxlbbgc   # first time only
npx supabase db push
```

This creates `feed_items`, `feed_sources`, `feed_ingest_runs`, `feed_interactions` (with RLS), seeds 7 default RSS sources, and schedules the `pg_cron` job to run hourly at minute :07.

## 2. Set the function secrets

```bash
# from repo root — the cron authenticates with INTERNAL_CRON_SECRET, NOT a key
supabase secrets set GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>
supabase secrets set INTERNAL_CRON_SECRET=$(openssl rand -hex 24)   # any long random string
```

Keep the `INTERNAL_CRON_SECRET` value — step 3 pastes it into the cron job. The
function accepts a request when the `x-internal-cron` request header equals this
secret (see `index.ts`). This avoids depending on any API-key format.

> **Why not the service-role key?** This project uses Supabase's new API keys
> (`sb_publishable_…` / `sb_secret_…`), which are **not** JWTs. The function is
> deployed with `verify_jwt = false` (see `supabase/config.toml`), so the gateway
> doesn't pre-validate auth — the function does it itself. A shared `x-internal-cron`
> secret is the simplest credential that works regardless of key format.

## 3. Schedule the cron job (manual — run once in SQL editor)

Paste into **Dashboard → SQL editor**, replacing `<INTERNAL_CRON_SECRET>` with the
value from step 2:

```sql
SELECT cron.unschedule('ingest_feeds_hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingest_feeds_hourly');

SELECT cron.schedule(
  'ingest_feeds_hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vltjeudovblmekxlbbgc.supabase.co/functions/v1/ingest_feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-cron', '<INTERNAL_CRON_SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
```

`timeout_milliseconds` is 150 s so pg_net waits for the whole run. (The function
finishes a normal run in 60–120 s; if pg_net gives up early the function still
completes server-side and finalizes its `feed_ingest_runs` row.)

### Verify the schedule was registered

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'ingest_feeds_hourly';
```

You should see one row, `schedule = '7 * * * *'`, `active = true`.

## 4. Deploy the Edge Function (JWT verification OFF)

```bash
# --no-verify-jwt is required; supabase/config.toml also pins it so plain
# `supabase functions deploy ingest_feeds` keeps it off.
supabase functions deploy ingest_feeds --no-verify-jwt
```

## 5. (Optional) Manually trigger the first run

From the teacher's `/teacher/feed` page, click **Refresh feed now** (that path sends
the teacher's own JWT, which the function validates). Or from your terminal with the
cron secret:

```bash
curl -X POST 'https://vltjeudovblmekxlbbgc.supabase.co/functions/v1/ingest_feeds' \
  -H "x-internal-cron: <INTERNAL_CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

You should see a JSON response like `{ "ok": true, "items_inserted": 4, "llm_calls": 4, "errors": [] }` after a minute or two. Items immediately appear at `/student/feed`.

## How it works (one-paragraph version)

`pg_cron` fires `ingest_feeds` every hour. The function pulls the oldest-fetched active `feed_sources.rss_url`s, takes the newest unseen item from each (dedup by `feed_items.source_url`), proxies the RSS-native cover image into the public `branding/feed-covers/{itemId}.{ext}` bucket path so third-party hot-link blocks don't break anything, and asks Gemini to rewrite the title and excerpt into plain language for a high-school student. The simplified row goes straight into `feed_items` with `status='published'` and the student gets a notification. A failing source increments `consecutive_failures` but doesn't crash the run; failing entries are skipped.

**Reliability design (important):** the hosted edge runtime hard-kills any invocation at ~150 s. To never hit that, the function (a) reads every HTTP response body *inside* its AbortController scope — a slow body read was the original hang; (b) wraps each source, each DB call, and the image upload in a hard timeout so one stuck call can't eat the budget; and (c) stops starting new work past a 125 s deadline and always finalizes its `feed_ingest_runs` row. Gemini is tried across `gemini-2.5-flash-lite → gemini-2.0-flash → gemini-2.5-flash` because the plain `2.5-flash` alias frequently returns `503 "high demand"`; if all fail the raw RSS title/excerpt is used as a fallback.

Hard caps (tuned for the 150 s ceiling): 4 sources/run, 1 newest item/source, 9 s per Gemini attempt, 4 s per image fetch+upload, 800 KB per cover image, 30 s per source. All audit info lives in `feed_ingest_runs` (its `errors` column names the source + reason for anything skipped).

## Troubleshooting

- **No items showing up**:
  - Check the cron is authenticating: `SELECT status_code FROM net._http_response ORDER BY created DESC LIMIT 5;` — a `401` means the `x-internal-cron` header / `INTERNAL_CRON_SECRET` secret don't match, or the function was redeployed with JWT verification on (`--no-verify-jwt` / config.toml).
  - Inspect the last runs: `SELECT started_at, items_inserted, llm_calls, errors FROM feed_ingest_runs ORDER BY started_at DESC LIMIT 5;`. The `errors` column pinpoints dead sources (`http 404/401`) and Gemini issues.
- **`llm_calls = 0` but items still insert**: Gemini is failing (commonly `503` overload) and the raw RSS text is being used. Usually transient — the model fallback chain recovers on the next run.
- **A source shows `http 404/401`**: that RSS URL is dead; set `is_active = false` on it (or fix the URL) in `feed_sources`. Anthropic's and Hugging Face Papers' public RSS were retired and are disabled.
- **Re-run for testing**: harmless; dedup is by `source_url`. Note the concurrent-run guard — if a previous run is still open it returns a no-op until the 4 min stale-cleanup frees it.
