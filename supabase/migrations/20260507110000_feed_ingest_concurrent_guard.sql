-- Prevent duplicate concurrent ingest runs.
--
-- Problem: pg_cron can fire two overlapping executions if the function URL is
-- registered more than once, or if a manual trigger coincides with the schedule.
-- Both instances would race past the "is there a run in progress?" check because
-- the check and the INSERT are not atomic.
--
-- Fix: partial unique index on a constant expression WHERE finished_at IS NULL.
-- Only one row may be "open" (unfinished) at a time.  The second concurrent
-- INSERT will fail with error 23505; the Edge Function treats that as a clean
-- "already running" bail-out rather than a real error.

-- First: close all open rows (finished_at IS NULL) so the unique index can be
-- created cleanly. Any run open at migration time is considered orphaned —
-- either it was from the duplicate-execution bug we're now fixing, or it
-- crashed before finalizeRun could write finished_at.
UPDATE feed_ingest_runs
SET    finished_at = now()
WHERE  finished_at IS NULL;

-- Create the guard index.
CREATE UNIQUE INDEX feed_ingest_runs_one_active_idx
    ON feed_ingest_runs ((true))
    WHERE finished_at IS NULL;
