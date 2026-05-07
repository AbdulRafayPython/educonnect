# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EduConnect is a private, invite-only one-on-one tutoring platform (one teacher, one student). The full product spec lives in `EduConnect_PRD.md` — consult it for feature requirements, RBAC matrix, and the canonical DB schema before adding features.

## Repo layout

- `frontend/` — Vite + React 19 + TypeScript app (the only buildable code). All commands below run from this directory.
- `supabase/migrations/` — SQL migrations. **Filenames are timestamped in 2026 on purpose** (project's working timeline); do not "fix" them to look older.
  - `20260411180734_initial_schema.sql` — tables and base RLS.
  - `20260430000001_storage_rpc_and_rls.sql` — `documents` + `quiz-submissions` storage buckets, `increment_completed_lectures(uuid)` RPC, realtime publication for `notifications`.
  - `20260430142801_fix_rls_recursion_and_tightening.sql` — breaks an RLS recursion on `profiles` and tightens policies.
  - `20260430161458_profiles_self_update_policy.sql` — lets a user UPDATE their own profile row.
  - `20260505000001_slides.sql` — `slides` table + `slides` storage bucket for HTML-deck uploads.
  - `20260505120000_quiz_submission_metadata.sql` — adds `submitted_by`, `submitted_at`, `submitted_filename` columns to `quizzes` (single-row submission model — there is no separate submissions table).
  - `20260505140000_branding_bucket.sql` — public `branding` bucket used to host the logo for transactional emails.
  - `20260507100000_feed.sql` — v1.1 AI Feed: `feed_items`, `feed_sources`, `feed_ingest_runs`, `feed_interactions` + RLS + seed of default RSS sources + `feed-covers/` path inside the `branding` bucket for proxied news images.
  - `20260507100100_feed_cron.sql` — schedules `ingest_feeds` Edge Function hourly via `pg_cron` + `net.http_post`.
- `supabase/functions/ingest_feeds/` — Deno Edge Function that fetches each active `feed_sources.rss_url`, dedups by `source_url`, extracts cover images (RSS enclosure → og:image → first article `<img>`), proxies them into `branding/feed-covers/`, and calls **Google Gemini 2.5 Flash** (`responseSchema` mode) to rewrite the title + excerpt into student-friendly wording before inserting into `feed_items` with `status = 'published'`. Requires `GEMINI_API_KEY` secret. **Never review queue** — news is live by default; teacher only hides/pins/re-simplifies after the fact.
- `supabase/config.toml` — Supabase project config. The `[auth.email.template.recovery]` block points at `supabase/templates/recovery.html` (custom branded reset-password email).
- `supabase/templates/recovery.html` — Public-Sans + `#00193c → #002d62` academic-gradient password reset email. Logo `<img>` hot-links the Supabase public bucket URL (`branding/hat.png`); email clients can't load localhost or signed URLs.
- `EduConnect_PRD.md` — product requirements (features, schema, NFRs).

## Common commands

All run from `frontend/`:

```bash
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # tsc -b && vite build (typecheck + build)
npm run lint       # ESLint
npm run preview    # preview production build
```

Database:

```bash
# Standard Supabase CLI flow (from repo root)
npx supabase link --project-ref vltjeudovblmekxlbbgc
npx supabase db push

# Alternative: direct push via pg client (frontend/push_schema.mjs)
# Note: this file currently has hardcoded DB credentials — do NOT commit changes that re-introduce them; prefer env vars.
```

Branding asset upload (one-shot, run after `db push` creates the `branding` bucket):

```bash
# from frontend/, with VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
node upload_branding.mjs   # uploads public/hat.png to the public `branding` bucket
```

There is no test runner configured.

## Architecture

### Auth + routing flow
`src/App.tsx` is the single source of routing truth. On mount it calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`. Whenever a session exists, it fetches the user's `profiles` row and stores it in Zustand (`useAppStore`). The store derives `role` from `profile.role`. Unauthenticated users are redirected to `/login`; authenticated users hitting `/login` bounce to their role's dashboard.

The route guards (`teacherGuard` / `studentGuard`) have a three-state ladder: **no user → redirect to `/login`**; **user but role still loading → render `<AppShellSkeleton />`**; **user with wrong role → redirect to the correct dashboard**. The middle state is critical — without it, the post-login transition produced a blank page because guards bounced through `/login` ↔ `/dashboard` while the profile fetch was in flight. `/login` itself uses the same ladder when `user` is set.

Routes are duplicated by role prefix (`/teacher/*` and `/student/*`) and reuse the same page components (`Courses`, `Sessions`, `Documents`, `Quizzes`, `Slides`, `SlideViewer`, `Notifications`). Pages are expected to read `role` from the store and conditionally render teacher-only controls.

### State
Zustand store at `src/store/useAppStore.ts` holds `user`, `profile`, `role`, `isLoading`. `profile` is currently typed `any` — when adding generated DB types, replace this. Setting profile auto-derives role, so always go through `setProfile`. The store also **caches profile in `localStorage` under `educonnect:profile-cache`** and hydrates it synchronously at module load — this is what makes a returning user's dashboard render instantly instead of flashing a skeleton. `setProfile` writes to localStorage on every call; `setProfile(null)` clears it.

Server state is owned by **TanStack Query** (`@tanstack/react-query`). Dashboards (`TeacherDashboard.tsx`, `StudentDashboard.tsx`) and the quiz submitter-profile lookup use queries; gate skeleton screens on `isPending` rather than ad-hoc `useEffect` loading flags.

### Shared libs
- `src/lib/nav.ts` — `teacherNav` / `studentNav` arrays + `navForRole(role)`. Always import from here, do not duplicate nav arrays in pages.
- `src/lib/time.ts` — `formatPKT`, `formatCET` (uses `Intl.DateTimeFormat` with `Asia/Karachi` and `Europe/Copenhagen`), `useCountdown(target)` hook ticking once per second, `isJoinable(scheduled_at, duration_min)` for the 15-min Zoom gate.
- `src/lib/notify.ts` — `notifyStudents(type, title, body, related_id)` and `notifyTeachers(...)`. Sessions/Documents/Quizzes call these on inserts/updates so the bell + Notifications page light up via realtime.

### Supabase client
Single client in `src/lib/supabase.ts`, reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `frontend/.env`. Falls back to localhost dummy values if env vars are missing — auth will silently fail in that state. **Symptom: login button does nothing, or the app sits in an infinite loading spinner after sign-in.** Always verify `frontend/.env` first when debugging login.

### RLS model (important for any DB query)
All tables have RLS enabled. The current policies (see migration) grant **students blanket SELECT** across `semesters`, `courses`, `sessions`, `documents`, `quizzes` (no per-enrollment scoping yet) and **teachers full CRUD** via an `EXISTS` check on their own `profiles` row. `notifications` is properly scoped to `recipient_id = auth.uid()`. When adding queries, do not assume student row-level isolation beyond `notifications` — the PRD describes per-enrollment scoping that is not yet implemented in SQL.

### Layout / UI system
- `components/DashboardLayout.tsx` wraps all dashboard pages with `Sidebar` + `TopBar`. Pass `title` and a `navItems` array per role. The shell is **mobile-first**: sidebar is an off-canvas drawer below `lg`, content drops the `ml-60` offset (`lg:ml-60`), and `TopBar` shows a hamburger that toggles `sidebarOpen` state owned by `DashboardLayout`. Heights use `100dvh` (not `100vh`) for iOS Safari; safe-area insets apply via `env(safe-area-inset-*)`.
- `components/Modal.tsx` is a bottom sheet on mobile (`items-end`, `rounded-t-3xl`, `max-h-[92dvh]`) and a centered card on `sm+`.
- `components/Skeleton.tsx` exports `Skeleton`, `SkeletonCard`, `SkeletonRow`, `SkeletonGrid`, and `DashboardContentSkeleton`. `components/AppShellSkeleton.tsx` mirrors the full chrome (sidebar + topbar + dashboard content) for the auth-loading state.
- Tailwind v4 via `@tailwindcss/vite`. Theme tokens (Material 3-style: `primary`, `surface`, `on-surface`, etc., plus the `.academic-gradient` utility = `linear-gradient(135deg, #00193c 0%, #002d62 100%)`) are defined in `src/index.css` using `@theme` — extend tokens there, not in a `tailwind.config`.
- Font: Public Sans. Icons: `material-symbols-outlined` (Google Material Symbols, loaded via index.html) and `lucide-react`.
- iOS quirks already handled in `index.css`: `font-size: 16px` on inputs (prevents focus zoom), `overscroll-behavior-y: none`, `touch-action: manipulation`, `viewport-fit=cover` + `theme-color` in `index.html`.

### File downloads from Supabase Storage
**Never** wire a `<a href={signedUrl} download>` for Storage downloads. Two reasons: (1) Supabase signed URLs default to `Content-Disposition: attachment` and can mangle HTML rendering; (2) the `download` attribute is ignored on cross-origin URLs, so the browser navigates to the file instead of saving it. Always use the **download-as-blob** pattern: `supabase.storage.from(bucket).download(path)` → wrap the bytes in a `Blob` (set `type: 'text/html;charset=utf-8'` for HTML decks to fix mojibake) → `URL.createObjectURL(blob)` → either set on iframe `src` (with `sandbox="allow-scripts allow-same-origin"`) or trigger an anchor click + `revokeObjectURL`. See `pages/SlideViewer.tsx`, `pages/Documents.tsx`, `pages/CourseDetail.tsx`, `pages/Quizzes.tsx` for the canonical implementation. When uploading HTML, set `contentType: 'text/html; charset=utf-8'` so the bytes round-trip cleanly.

### `html2tsx.js`
Quick-and-dirty converter that wraps raw HTML mockups into React components in `src/pages/`. The source HTML lives at `frontend/src/Login.html`, `frontend/src/TeacherDashboard.html`, `frontend/src/StudentDashboard.html`. Used during initial scaffolding — re-running it will overwrite existing `TeacherDashboard.tsx` / `StudentDashboard.tsx`, so don't run it again unless you intend to regenerate from HTML.

## Conventions to preserve

- Time storage: `scheduled_at` is `timestamptz` in UTC. UI must render both PKT (teacher) and CET/CEST (student) — see PRD §5.4 / §9.
- Account creation: public signup is disabled. Teacher creates students via Supabase Admin API or dashboard; the app never exposes a signup form.
- **First-teacher bootstrap:** after creating the auth user in Supabase Dashboard → Authentication, you must also insert the matching `profiles` row with `role='teacher'`. Without it, login redirects loop indefinitely because `App.tsx` gates every protected route on both `user` AND `role`. Example: `INSERT INTO profiles (id, role, full_name, email) VALUES ('<auth-user-uuid>', 'teacher', 'Dr. Aris', 'teacher@school.edu');`
- File uploads go through Supabase Storage with private buckets + signed URLs (`documents`, `quiz-submissions`, `slides`). The one exception is `branding`, which is public on purpose — it's the only way email clients can fetch the logo. Don't add other public buckets.
- Quiz submissions use a **single-row model**: the `quizzes` table itself stores `submitted_by` / `submitted_at` / `submitted_filename`, since this product is one-teacher / one-student. Don't add a separate submissions table without first reconciling with the PRD.
- AI Feed news is **fully automated** — the Edge Function publishes directly to `feed_items.status = 'published'` without a teacher review step. Cover images are proxied into our own `branding` bucket (under `feed-covers/`) so third-party hot-link blocks don't break the UI. The only acceptable use of the public `branding` bucket beyond the logo is feed covers; private buckets are still the rule everywhere else.
