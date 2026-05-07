# AI Feed — one-time setup checklist

The schema migrations and Edge Function are committed; one-time deploy steps below.

## 1. Push the migrations

```bash
# from repo root
npx supabase link --project-ref vltjeudovblmekxlbbgc   # first time only
npx supabase db push
```

This creates `feed_items`, `feed_sources`, `feed_ingest_runs`, `feed_interactions` (with RLS), seeds 7 default RSS sources, and schedules the `pg_cron` job to run hourly at minute :07.

## 2. Schedule the cron job (manual — run once in SQL editor)

Hosted Supabase blocks `ALTER DATABASE ... SET app.settings.*` for security, so the cron schedule has to be created with the URL and service-role key inlined. Pick **one** of the two options below and paste it into **Dashboard → SQL editor**.

**Where to find the service-role key:** Dashboard → Project Settings → API Keys → `service_role` (the secret one, not `anon`). It's a JWT starting with `eyJhbGc...`. Never commit it to git.

### Option A — inline the key (simplest)

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
      'Authorization', 'Bearer eyJhbGc...PASTE_SERVICE_ROLE_KEY_HERE...'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

The key never leaves the database.

### Option B — use Supabase Vault (recommended for production)

```sql
-- One-time: store the secret
SELECT vault.create_secret('eyJhbGc...PASTE_SERVICE_ROLE_KEY_HERE...', 'service_role_key');

-- Schedule the job; it reads the decrypted secret at run time
SELECT cron.unschedule('ingest_feeds_hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingest_feeds_hourly');

SELECT cron.schedule(
  'ingest_feeds_hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vltjeudovblmekxlbbgc.supabase.co/functions/v1/ingest_feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
```

### Verify the schedule was registered

```sql
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'ingest_feeds_hourly';
```

You should see one row, `schedule = '7 * * * *'`, `active = true`.

## 3. Set the Gemini API key as a function secret

```bash
# from repo root
supabase secrets set GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>
```

## 4. Deploy the Edge Function

```bash
supabase functions deploy ingest_feeds
```

## 5. (Optional) Manually trigger the first run

From the teacher's `/teacher/feed` page, click **Refresh feed now**. Or from your terminal:

```bash
curl -X POST 'https://vltjeudovblmekxlbbgc.supabase.co/functions/v1/ingest_feeds' \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

You should see a JSON response like `{ "ok": true, "items_inserted": 12, "llm_calls": 12, "errors": [] }` after a minute or two. Items immediately appear at `/student/feed`.

## How it works (one-paragraph version)

`pg_cron` fires `ingest_feeds` every hour. The function pulls each active `feed_sources.rss_url`, dedups against `feed_items.source_url`, extracts a cover image (RSS enclosure → og:image → first article `<img>`), proxies that image into the public `branding/feed-covers/{itemId}.{ext}` bucket path so third-party hot-link blocks don't break anything, and asks Gemini 2.5 Flash to rewrite the title and excerpt into 2–3 plain-language sentences for a high-school student. The simplified row goes straight into `feed_items` with `status='published'` and the student gets a notification. A failing source increments `consecutive_failures` but doesn't crash the run; failing entries are skipped.

Hard caps: 5 items per source per run, 30 items per run, 30 LLM calls per run, 800 KB per cover image, 15 s per Gemini call. All audit info lives in `feed_ingest_runs`.

## Troubleshooting

- **No items showing up**: tail logs with `supabase functions logs ingest_feeds --tail`. Most common cause is `GEMINI_API_KEY` not set, or the source URL returning 403 (some sources block Cloudflare Workers; switch to a different source).
- **Images broken**: check the `consecutive_failures` count on `feed_sources`. The function falls back to a brand-color gradient if image extraction fails — that's by design.
- **Re-run for testing**: there's no harm running the function multiple times; dedup is by `source_url`.
