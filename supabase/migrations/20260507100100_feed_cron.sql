-- Enables the ingest_feeds Edge Function to be invoked on a schedule.
--
-- NOTE: Supabase hosted Postgres does NOT allow `ALTER DATABASE ... SET app.settings.*`
-- (permission denied). The cron schedule itself must be created MANUALLY from the
-- Dashboard → SQL editor, with the function URL and service-role key inlined or
-- read from Supabase Vault. This migration only sets up the prerequisite extensions.
--
-- After `db push`, run ONE of the snippets in `FEED_SETUP.md` step 2 from the SQL editor
-- to actually wire the schedule.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
