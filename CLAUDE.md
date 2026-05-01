# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EduConnect is a private, invite-only one-on-one tutoring platform (one teacher, one student). The full product spec lives in `EduConnect_PRD.md` — consult it for feature requirements, RBAC matrix, and the canonical DB schema before adding features.

## Repo layout

- `frontend/` — Vite + React 19 + TypeScript app (the only buildable code). All commands below run from this directory.
- `supabase/migrations/` — SQL migrations. **Filenames are timestamped in 2026 on purpose** (project's working timeline — today's date is 2026-05-01); do not "fix" them to look older.
  - `20260411180734_initial_schema.sql` — tables and base RLS.
  - `20260430000001_storage_rpc_and_rls.sql` — `documents` + `quiz-submissions` storage buckets, `increment_completed_lectures(uuid)` RPC, realtime publication for `notifications`.
- `supabase/config.toml` — Supabase project config.
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

There is no test runner configured.

## Architecture

### Auth + routing flow
`src/App.tsx` is the single source of routing truth. On mount it calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`. Whenever a session exists, it fetches the user's `profiles` row and stores it in Zustand (`useAppStore`). The store derives `role` from `profile.role` — every protected route in `App.tsx` gates on both `user` and `role === 'teacher' | 'student'`. Unauthenticated users are redirected to `/login`; authenticated users hitting `/login` bounce to their role's dashboard.

Routes are duplicated by role prefix (`/teacher/*` and `/student/*`) and reuse the same page components (`Courses`, `Sessions`, `Documents`, `Quizzes`, `Notifications`). Pages are expected to read `role` from the store and conditionally render teacher-only controls.

### State
Zustand store at `src/store/useAppStore.ts` holds `user`, `profile`, `role`, `isLoading`. `profile` is currently typed `any` — when adding generated DB types, replace this. Setting profile auto-derives role, so always go through `setProfile`.

### Shared libs
- `src/lib/nav.ts` — `teacherNav` / `studentNav` arrays + `navForRole(role)`. Always import from here, do not duplicate nav arrays in pages.
- `src/lib/time.ts` — `formatPKT`, `formatCET` (uses `Intl.DateTimeFormat` with `Asia/Karachi` and `Europe/Copenhagen`), `useCountdown(target)` hook ticking once per second, `isJoinable(scheduled_at, duration_min)` for the 15-min Zoom gate.
- `src/lib/notify.ts` — `notifyStudents(type, title, body, related_id)` and `notifyTeachers(...)`. Sessions/Documents/Quizzes call these on inserts/updates so the bell + Notifications page light up via realtime.

### Supabase client
Single client in `src/lib/supabase.ts`, reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `frontend/.env`. Falls back to localhost dummy values if env vars are missing — auth will silently fail in that state. **Symptom: login button does nothing, or the app sits in an infinite loading spinner after sign-in.** Always verify `frontend/.env` first when debugging login.

### RLS model (important for any DB query)
All tables have RLS enabled. The current policies (see migration) grant **students blanket SELECT** across `semesters`, `courses`, `sessions`, `documents`, `quizzes` (no per-enrollment scoping yet) and **teachers full CRUD** via an `EXISTS` check on their own `profiles` row. `notifications` is properly scoped to `recipient_id = auth.uid()`. When adding queries, do not assume student row-level isolation beyond `notifications` — the PRD describes per-enrollment scoping that is not yet implemented in SQL.

### Layout / UI system
- `components/DashboardLayout.tsx` wraps all dashboard pages with `Sidebar` (fixed `ml-60`) + `TopBar`. Pass `title` and a `navItems` array per role.
- Tailwind v4 via `@tailwindcss/vite`. Theme tokens (Material 3-style: `primary`, `surface`, `on-surface`, etc., plus `academic-gradient` utility) are defined in `src/index.css` using `@theme` — extend tokens there, not in a `tailwind.config`.
- Font: Public Sans. Icons: `material-symbols-outlined` (Google Material Symbols, loaded via index.html) and `lucide-react`.

### `html2tsx.js`
Quick-and-dirty converter that wraps raw HTML mockups into React components in `src/pages/`. The source HTML lives at `frontend/src/Login.html`, `frontend/src/TeacherDashboard.html`, `frontend/src/StudentDashboard.html`. Used during initial scaffolding — re-running it will overwrite existing `TeacherDashboard.tsx` / `StudentDashboard.tsx`, so don't run it again unless you intend to regenerate from HTML.

## Conventions to preserve

- Time storage: `scheduled_at` is `timestamptz` in UTC. UI must render both PKT (teacher) and CET/CEST (student) — see PRD §5.4 / §9.
- Account creation: public signup is disabled. Teacher creates students via Supabase Admin API or dashboard; the app never exposes a signup form.
- **First-teacher bootstrap:** after creating the auth user in Supabase Dashboard → Authentication, you must also insert the matching `profiles` row with `role='teacher'`. Without it, login redirects loop indefinitely because `App.tsx` gates every protected route on both `user` AND `role`. Example: `INSERT INTO profiles (id, role, full_name, email) VALUES ('<auth-user-uuid>', 'teacher', 'Dr. Aris', 'teacher@school.edu');`
- File uploads go through Supabase Storage with private buckets + signed URLs (`documents`, `quiz-submissions`). Don't add public buckets.
