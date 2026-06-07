// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 (email pipeline) — FLAGGED / NOT YET WIRED.
//
// The transactional-email pipeline (Resend/SMTP + the 9 React Email templates +
// the `dispatch_emails` Edge Function + enqueue triggers + /unsubscribe) is
// deferred until an email transport credential is provided. See PRD §9.
//
// This module is the single, intentional integration point so that turning the
// pipeline on later is a one-flag change rather than a hunt through the codebase.
//
// IMPORTANT: real enqueuing must happen server-side. `email_queue` has no
// client INSERT policy (by design — RLS), so the actual rows are written by
// Postgres triggers / Edge Functions in Phase 4. This client helper is a no-op
// today and exists only to document the contract and mark call sites.
// ─────────────────────────────────────────────────────────────────────────────

/** Master switch for the email pipeline. Flip to true once Phase 4 ships. */
export const EMAIL_PIPELINE_ENABLED = false;

/** The transactional templates from PRD §9.2 (kept here so call sites are typed). */
export type EmailTemplate =
  | 'welcome'              // Template 1 — Mode B welcome
  | 'session_reminder'     // Template 2 — 24h / 30min before
  | 'quiz_posted'          // Template 3
  | 'quiz_reminder'        // Template 4 — 24h before due
  | 'quiz_graded'          // Template 5
  | 'session_summary'      // Template 6
  | 'broadcast'            // Template 7 — teacher-authored
  | 'certificate'          // Template 8
  | 'mode_a_event';        // Template 9 — DTU student events

/**
 * Intended enqueue surface for Phase 4. Today this is a guarded no-op: when the
 * pipeline is disabled it does nothing; when enabled it will defer to a server
 * endpoint / Edge Function that owns the actual `email_queue` insert. Callers
 * can wire this in now without sending anything.
 */
export async function queueEmail(
  template: EmailTemplate,
  recipientId: string,
  payload: Record<string, unknown>,
  sendAt?: Date,
): Promise<void> {
  if (!EMAIL_PIPELINE_ENABLED) return; // flagged off — intentional no-op
  // Phase 4: POST to the dispatch endpoint / call the enqueue RPC here.
  console.debug('[email] queue', { template, recipientId, payload, sendAt });
}
