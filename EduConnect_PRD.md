# Product Requirements Document (PRD)
## EduConnect v2.0 — Private Teaching Platform + AI Masterclass Hub
**Version:** 2.0
**Date:** June 7, 2026
**Author:** Abdul Rafay
**Status:** Draft

> **v2.0 scope:** Evolves the original 1:1 teacher–student platform into a dual-mode system.
> **Mode A — 1:1 Track** is the existing EduConnect experience for Abdul Rafay ↔ DTU student,
> fully preserved from v1.1.
> **Mode B — AI Masterclass Hub** is a new group learning surface for the family cousins cohort
> (ages 5 to university). It adds Google OAuth registration, a class scheduling system,
> AI session links with class-specific Zoom/Meet URLs, structured quiz delivery, and a
> transactional email pipeline that notifies every enrolled student of every event.
> Both modes share one Supabase project, one auth layer, and one design system.
> UI is intentionally crafted — not vibe-coded — with a clear component language,
> design tokens, and strict layout rules documented in §8.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Stakeholders & User Roles (RBAC)](#3-stakeholders--user-roles-rbac)
4. [Tech Stack](#4-tech-stack)
5. [Authentication & Registration](#5-authentication--registration)
6. [Mode A — 1:1 Private Track](#6-mode-a--11-private-track)
7. [Mode B — AI Masterclass Hub](#7-mode-b--ai-masterclass-hub)
8. [UI/UX Design System](#8-uiux-design-system)
9. [Email Notification Pipeline](#9-email-notification-pipeline)
10. [Database Schema](#10-database-schema)
11. [Supabase Configuration](#11-supabase-configuration)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [AI Feed (from v1.1)](#13-ai-feed-from-v11)
14. [Programming Playground (from v1.1)](#14-programming-playground-from-v11)
15. [Project Milestones](#15-project-milestones)
16. [Page Inventory](#16-page-inventory)

---

## 1. Executive Summary

EduConnect v2.0 serves two teaching relationships from one application:

**Mode A** is the private 1:1 tutoring platform between Abdul Rafay (teacher, Pakistan) and a
single student at DTU (Denmark). It covers session scheduling, course progress, document sharing,
quizzes, Zoom links, the AI news feed, and the programming playground — all from v1.1, unchanged.

**Mode B** is the new AI Masterclass Hub. Abdul Rafay runs a weekly "Zero to Hero AI Sessions"
class for a group of family cousins ranging from young children to university students. Every
cousin registers with Google OAuth (no manual account creation), selects their age group on
first login, gets enrolled into the appropriate cohort, and from that moment receives:

- Scheduled class links (Zoom/Meet) delivered to their inbox before every session
- Structured session content with a clear agenda
- Quizzes and challenges sent via email on schedule
- Completion certificates when they finish a cohort
- A personal dashboard showing their progress across all 12 weeks

The teacher (Abdul Rafay) manages both modes from a single admin panel with a mode switcher.

---

## 2. Product Vision & Goals

| Goal | Mode | Description |
|------|------|-------------|
| Centralised scheduling | Both | All session links, timings, and agendas in one place |
| Google OAuth onboarding | B | Cousins register in one click — no invite flow required |
| Age-group cohorts | B | Automatic routing to Little Ones (5–10), Juniors (11–15), or Advanced (16+) cohort |
| Email-first notifications | Both | Every event triggers a beautifully formatted email, not just a bell icon |
| Course progress tracking | Both | Exact lecture count, completion percentage, streak data |
| AI Masterclass content | B | 12-week structured AI agent curriculum delivered session by session |
| Quiz delivery pipeline | Both | Quizzes emailed on schedule; submissions tracked in dashboard |
| Design quality | Both | Intentional, component-driven UI — nothing vibe-coded |
| Privacy | Both | All routes behind authentication; no public-facing pages |

---

## 3. Stakeholders & User Roles (RBAC)

### 3.1 Role Definitions

| Role | Description | Account Creation |
|------|-------------|------------------|
| `teacher` | Abdul Rafay. Full admin over both modes. | Self-registered on initial setup |
| `student_private` | The DTU student. Scoped to Mode A only. | Created by teacher via invite |
| `student_group` | Any cousin. Scoped to Mode B. | Self-registered via Google OAuth |

### 3.2 Permissions Matrix

| Feature | teacher | student_private | student_group |
|---------|---------|-----------------|---------------|
| Create / manage courses | ✅ | ❌ | ❌ |
| Create / manage cohorts | ✅ | ❌ | ❌ |
| Schedule sessions (both modes) | ✅ | ❌ | ❌ |
| View own sessions | ✅ | ✅ | ✅ |
| Upload documents / materials | ✅ | ❌ | ❌ |
| Download documents | ✅ | ✅ | ✅ (cohort materials) |
| Create and send quizzes | ✅ | ❌ | ❌ |
| Attempt quizzes | ❌ | ✅ | ✅ |
| View quiz grades and feedback | ✅ | ✅ (own) | ✅ (own) |
| Add session summaries | ✅ | ❌ | ❌ |
| Self-register via Google OAuth | ❌ | ❌ | ✅ |
| Invite-only registration | ❌ | ✅ | ❌ |
| View cohort roster | ✅ | ❌ | ❌ |
| Send broadcast email | ✅ | ❌ | ❌ |
| Access AI Feed | ✅ | ✅ | ✅ |
| Access Programming Playground | ✅ | ✅ | ✅ (age-gated tracks) |
| View personal progress dashboard | ✅ | ✅ | ✅ |

---

## 4. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 19 + Vite + TypeScript | |
| Styling | Tailwind CSS v4 + shadcn/ui | Custom design tokens — see §8 |
| State management | Zustand | |
| Backend / database | Supabase (PostgreSQL 15) | |
| Authentication | Supabase Auth | Email+password (Mode A) + Google OAuth (Mode B) |
| Real-time | Supabase Realtime | Notification bell, live session countdown |
| File storage | Supabase Storage | Documents, quiz submissions, certificates |
| Email | Resend + React Email | Transactional emails — see §9 |
| Scheduling (email jobs) | Supabase Edge Functions + pg_cron | Pre-session reminders, quiz dispatch |
| Code editor | Monaco Editor (@monaco-editor/react) | Playground |
| Python runtime | Pyodide (lazy-loaded) | Playground |
| Time / date | date-fns + date-fns-tz | PKT ↔ CET/CEST display |
| PDF generation | @react-pdf/renderer | Completion certificates |
| Hosting | Vercel | |

---

## 5. Authentication & Registration

### 5.1 Google OAuth — Mode B students

- **FR-AUTH-G-01:** A public `/join` landing page displays the program name, a short description, and a single "Continue with Google" button. No email/password form.
- **FR-AUTH-G-02:** Clicking the button triggers Supabase Google OAuth (`supabase.auth.signInWithOAuth({ provider: 'google' })`). The user is redirected back to `/onboarding` on success.
- **FR-AUTH-G-03:** On first login, `/onboarding` shows a two-step form:
  - Step 1: Confirm display name (pre-filled from Google profile), upload optional avatar.
  - Step 2: Select age group — "I'm 5–10 years old", "I'm 11–15", "I'm 16 or older / university". This determines the default cohort.
- **FR-AUTH-G-04:** On submit, a `profiles` row is created with `role = 'student_group'`, `age_group` set, and the user is auto-enrolled into the active cohort for their age group.
- **FR-AUTH-G-05:** Returning users skip onboarding and land directly on `/dashboard`.
- **FR-AUTH-G-06:** Google OAuth is the only registration path for `student_group`. There is no manual invite flow for Mode B.

### 5.2 Email + password — Mode A student (DTU)

- **FR-AUTH-P-01:** Teacher creates the DTU student account from the Admin panel using the Supabase Admin API (invite email sent by Supabase).
- **FR-AUTH-P-02:** Student sets a password on first login via the Supabase invite link.
- **FR-AUTH-P-03:** Role is `student_private`. The `/join` page and Google OAuth flow are not accessible to this role.

### 5.3 Teacher account

- **FR-AUTH-T-01:** Teacher registers once with email + password on `/setup` (disabled after first use via a `platform_config` flag).
- **FR-AUTH-T-02:** Teacher can also link a Google account to their existing teacher profile for convenience, but OAuth alone never grants `teacher` role.

### 5.4 Session management

- Supabase auto-refresh tokens on page reload.
- Role enforced via `profiles.role` and Supabase RLS on every table.
- Unauthorized route access redirects to `/login` with a `next` param.

---

## 6. Mode A — 1:1 Private Track

All feature requirements from the original v1.0 and v1.1 PRD apply unchanged. For completeness, key areas are:

### 6.1 Dashboard (teacher + DTU student)
Teacher sees: total courses, sessions this week, upcoming sessions, pending quiz grades, recent activity.
Student sees: next session countdown, Zoom join button (active 15 min before), enrolled courses with progress bars, pending quizzes, recent summaries, notification bell.

### 6.2 Semester & course management
Teacher creates Semesters → Courses → Sessions. Each course tracks total / completed / remaining lectures and renders a circular progress ring. Student sees progress for all enrolled courses.

### 6.3 Session management
Each session has title, date/time (stored UTC, displayed in both PKT and CET/CEST), duration, Zoom link, linked course, and status (`scheduled | in_progress | completed | cancelled`). Marking completed auto-increments the lecture count.

### 6.4 Session summaries
Teacher writes rich-text (Markdown) post-session summaries. Student reads them in a chronological feed.

### 6.5 Document management
Teacher uploads PDFs, DOCX, PPTX tagged as `notes | reference | assignment | other`. Student downloads via Supabase signed URLs.

### 6.6 Quizzes & challenges
Teacher uploads or writes quizzes with due dates. Student downloads, submits, and receives grades + feedback. Status lifecycle: `pending → submitted → graded`.

### 6.7 Lecture progress tracker
Per-course progress ring (X of Y completed), accordion list of all sessions by status, estimated completion date.

### 6.8 Notification bell
Real-time bell via Supabase Realtime. Events: new session, session update/cancel, summary posted, document uploaded, quiz posted, quiz graded, general announcement.

---

## 7. Mode B — AI Masterclass Hub

### 7.1 Cohorts

Three parallel cohorts run the same 12-week curriculum at different depth levels:

| Cohort | Age range | Label | Depth |
|--------|-----------|-------|-------|
| `little_ones` | 5–10 | Little explorers | Play-based, guided by teacher, minimal independent typing |
| `juniors` | 11–15 | Junior builders | Structured activities, build real outputs each session |
| `advanced` | 16+ / university | AI architects | Full agent building, automation pipelines, freelance-ready skills |

The 12-week curriculum is the one planned in the prior conversation: Phase 1 (AI foundations, weeks 1–4), Phase 2 (creating with AI, weeks 5–8), Phase 3 (building agents, weeks 9–12).

### 7.2 Class scheduling

- **FR-MC-01:** Teacher creates a `masterclass_session` with: week number (1–12), title, date/time, duration, meeting link (Zoom or Google Meet URL), cohort targets (can target all three at once or a subset), agenda (Markdown), and materials attached.
- **FR-MC-02:** Each session has a `session_type`: `class | quiz_session | demo_day | office_hours`.
- **FR-MC-03:** Teacher can schedule all 12 weeks in bulk using a "Generate schedule" tool that asks for a start date, a day of week, and a time, then creates all 12 session rows pre-filled with titles from the curriculum template.
- **FR-MC-04:** Student sees only sessions relevant to their cohort. Sessions are displayed in a weekly calendar view and a list view.
- **FR-MC-05:** The next upcoming session is pinned to the top of the student dashboard with a large countdown timer and a "Join class" button that activates 10 minutes before start.

### 7.3 Session content per week

Each of the 12 sessions has a structured content block stored by the teacher:

- **Agenda** — what will happen in this class (Markdown, visible to student before session)
- **Activity for little ones** — specific instructions for ages 5–10
- **Activity for juniors** — specific instructions for ages 11–15
- **Activity for advanced** — specific instructions for ages 16+
- **Tools needed** — list of tools (ChatGPT, Poe, Make.com, etc.) with links, displayed before the session
- **Session recording link** — added by teacher after the session
- **Session summary** — Markdown notes of what was covered, added after

Students in each cohort see only the activity relevant to their group, plus the shared agenda and tools list.

### 7.4 Quiz system for Mode B

- **FR-QUIZ-MC-01:** Teacher creates quizzes tied to a specific week number and cohort(s). Each quiz has: title, description, type (`knowledge_check | hands_on_challenge | reflection`), due date (auto-set to 6 days after the session), and content (inline questions or file attachment).
- **FR-QUIZ-MC-02:** Inline quizzes support multiple choice and short answer questions authored in a drag-and-drop builder.
- **FR-QUIZ-MC-03:** On quiz creation, the system automatically:
  1. Inserts the quiz into the student dashboard "Pending" section.
  2. Sends a quiz notification email to every enrolled student in the targeted cohort (see §9).
  3. Schedules a reminder email 24 hours before the due date.
- **FR-QUIZ-MC-04:** Student submits inline or uploads a file. Teacher reviews and adds feedback. Student receives a grade email.
- **FR-QUIZ-MC-05:** Students who complete all quizzes for all 12 weeks unlock a completion certificate (auto-generated PDF with their name, cohort, and the program title).

### 7.5 Student progress dashboard (Mode B)

- Weekly progress ring: sessions attended vs total.
- Quiz completion rate.
- Current streak (consecutive weeks with at least one quiz submitted).
- "What's next" card showing upcoming session and pending quiz.
- Badge shelf: earned badges for milestones (First session, First quiz, Halfway, All done).
- Certificate download button (unlocked on 100% quiz completion).

### 7.6 Teacher cohort management panel

- `/admin/masterclass/cohorts` — list of all enrolled students per cohort. Shows name, age group, Google avatar, join date, sessions attended, quizzes completed, last active.
- `/admin/masterclass/sessions` — full 12-week schedule with attendance status per session.
- `/admin/masterclass/quizzes` — all quizzes with submission counts and pending reviews.
- `/admin/masterclass/broadcast` — send a custom email to all students or a specific cohort (subject + body, sent via Resend).
- Export: teacher can export a CSV of cohort roster + progress for any cohort.

---

## 8. UI/UX Design System

This section defines the exact design language. Every component must follow these rules. No ad hoc styles.

### 8.1 Design principles

1. **Intentional, not impulsive.** Every spacing, color, and type decision comes from the token system below — not from intuition or a copied component. If a token does not exist for something, add it to the token file first.
2. **Calm professionalism.** The platform serves learners of all ages. It should feel like a premium educational product — not a social app, not a game, not a SaaS landing page.
3. **Hierarchy through weight and space.** Color is used sparingly. Emphasis comes from typography weight and whitespace first, color second.
4. **Mobile-first for Mode B students.** Cousins will access the platform on phones. Every layout works at 375px before it works at 1440px.
5. **Accessible by default.** WCAG AA contrast on all text. Focus rings on all interactive elements. No information conveyed by color alone.

### 8.2 Color tokens (defined in `tailwind.config.ts`)

```typescript
// Brand
--color-primary:       #0F172A  // Slate 900 — primary text, nav bg
--color-primary-mid:   #1E3A5F  // Deep navy — headings, active states
--color-accent:        #0EA5E9  // Sky 500 — CTAs, links, badges
--color-accent-light:  #E0F2FE  // Sky 100 — accent backgrounds

// Surface
--color-surface:       #FFFFFF  // Card backgrounds
--color-bg:            #F8FAFC  // Page background (Slate 50)
--color-border:        #E2E8F0  // Slate 200 — card and input borders
--color-border-strong: #CBD5E1  // Slate 300 — dividers

// Text
--color-text-primary:  #0F172A  // Slate 900
--color-text-secondary:#475569  // Slate 600
--color-text-muted:    #94A3B8  // Slate 400

// Semantic
--color-success:       #10B981  // Emerald 500
--color-warning:       #F59E0B  // Amber 500
--color-danger:        #EF4444  // Red 500
--color-info:          #3B82F6  // Blue 500

// Cohort colors (used for cohort badges and accents only)
--color-little-ones:   #A78BFA  // Violet 400
--color-juniors:       #34D399  // Emerald 400
--color-advanced:      #F97316  // Orange 500
```

### 8.3 Typography scale

All font-size values are in `rem` using a 16px base. Font family: `Inter` (loaded via Fontsource, self-hosted — no Google Fonts CDN call in production).

| Token | Size | Weight | Line height | Usage |
|-------|------|--------|-------------|-------|
| `text-display` | 2.25rem / 36px | 700 | 1.2 | Page hero titles |
| `text-h1` | 1.875rem / 30px | 700 | 1.25 | Section headings |
| `text-h2` | 1.5rem / 24px | 600 | 1.3 | Card headings |
| `text-h3` | 1.25rem / 20px | 600 | 1.4 | Sub-headings |
| `text-body-lg` | 1.125rem / 18px | 400 | 1.6 | Intro paragraphs |
| `text-body` | 1rem / 16px | 400 | 1.6 | Default body text |
| `text-sm` | 0.875rem / 14px | 400 | 1.5 | Labels, captions |
| `text-xs` | 0.75rem / 12px | 400 | 1.4 | Badges, timestamps |

### 8.4 Spacing scale

`4px` base unit. All spacing values are multiples: `4, 8, 12, 16, 24, 32, 48, 64, 96px`. No arbitrary values in the codebase.

### 8.5 Component library rules

**Cards**
```
background: var(--color-surface)
border: 1px solid var(--color-border)
border-radius: 12px
padding: 24px
box-shadow: none (shadow is a design smell — use border instead)
```
Hover state for clickable cards: `border-color: var(--color-border-strong)`, `background: #FAFBFD`, transition 150ms ease.

**Buttons**
Three variants only. No custom one-off buttons.

- `btn-primary` — `background: var(--color-accent)`, white text, `border-radius: 8px`, `padding: 10px 20px`, `font-weight: 500`. Hover: darken 8%.
- `btn-secondary` — `background: transparent`, `border: 1px solid var(--color-border-strong)`, primary text. Hover: `background: var(--color-bg)`.
- `btn-ghost` — no background, no border, accent text color. Hover: `background: var(--color-accent-light)`.

Destructive actions use `btn-secondary` with `color: var(--color-danger)` and `border-color: var(--color-danger)`.

**Badges / pills**
```
border-radius: 999px (full pill)
padding: 2px 10px
font-size: text-xs
font-weight: 500
```
Color pairs (background / text): success `#D1FAE5 / #065F46`, warning `#FEF3C7 / #92400E`, danger `#FEE2E2 / #991B1B`, info `#DBEAFE / #1E40AF`, muted `#F1F5F9 / #475569`.

**Form inputs**
```
height: 40px
border: 1px solid var(--color-border)
border-radius: 8px
padding: 0 12px
font-size: text-body
focus: border-color: var(--color-accent), outline: none, box-shadow: 0 0 0 3px var(--color-accent-light)
```

**Navigation**
Desktop: fixed left sidebar, `width: 240px`, `background: var(--color-primary)`, white text. Active item has `background: rgba(255,255,255,0.1)` and a `3px solid var(--color-accent)` left border.
Mobile: bottom tab bar for Mode B students (max 4 tabs: Home, Sessions, Quizzes, Profile). Mode A student uses a hamburger drawer.

**Data tables**
Header row: `background: var(--color-bg)`, `font-weight: 600`, `font-size: text-sm`, `color: var(--color-text-secondary)`. Data rows: white background, `border-bottom: 1px solid var(--color-border)`. No zebra striping.

**Progress rings**
SVG circles. `stroke-width: 6px`. Background track: `var(--color-border)`. Foreground: `var(--color-accent)`. Center label: percentage in `text-h3`, subtext in `text-xs / text-muted`.

**Countdown timer**
Four blocks (days, hours, minutes, seconds) in monospace font (`font-family: 'JetBrains Mono', monospace`). Each block: `background: var(--color-primary)`, white number in `text-display`, muted label in `text-xs`. Separated by colons.

**Cohort badge**
Pill with cohort color as background and matching dark text. Little ones: violet. Juniors: emerald. Advanced: orange.

### 8.6 Illustration style

No stock illustrations, no blob shapes, no gradients-as-decoration. If a visual is needed (empty states, onboarding), use a minimal single-color SVG line icon at `48px` with `color: var(--color-text-muted)`, paired with a one-sentence text explanation. Empty states must always include the action button that resolves the empty state.

### 8.7 Animation rules

- Page transitions: `opacity 0 → 1` over `200ms` only. No slides, no scale transforms on route changes.
- Component mount: `opacity 0 → 1` + `translateY(4px → 0)` over `150ms`. Subtle, not theatrical.
- Loading skeletons: `background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)`, `background-size: 200%`, animating `background-position` — standard shimmer.
- Countdown timer tick: no animation. Numbers update instantly.
- `prefers-reduced-motion: reduce` must disable all animations.

---

## 9. Email Notification Pipeline

Email is the primary communication channel for Mode B. Every significant event sends a real email to the student. Mode A uses the existing bell system with email as secondary.

### 9.1 Technology

- **Provider:** Resend (resend.com) — transactional email API with generous free tier.
- **Templates:** React Email (`@react-email/components`) — emails authored as React components, consistent with the platform's design system.
- **Sender address:** `noreply@educonnect.abdulrafay.dev` (custom domain configured in Resend).
- **From name:** `Abdul Rafay · EduConnect`
- **Trigger mechanism:** Supabase Edge Functions write to an `email_queue` table. A pg_cron job runs every minute and dispatches queued emails via the Resend API.

### 9.2 Email templates

All templates share a common wrapper: white card (`600px max-width`), platform logo top-left, accent-color top border `4px`, clean Inter typography, footer with unsubscribe link and `Abdul Rafay · Zero to Hero AI Sessions` branding.

#### Template 1 — Welcome email (Mode B, sent on first Google login)
**Subject:** `Welcome to Zero to Hero AI Sessions, {first_name}!`
Content:
- Warm greeting with their name and Google avatar shown in a circle.
- One sentence on what the program is.
- Their cohort assignment displayed as a colored badge.
- "Your first class" card showing the next scheduled session date, time, and a "Add to Google Calendar" button (opens a `calendar.google.com/calendar/r/eventedit?...` URL pre-filled).
- Large CTA button: "Go to your dashboard".
- What to expect section: three icon + text rows covering session format, quizzes, and tools they will use.

#### Template 2 — Session reminder (sent 24 hours before, then again 30 minutes before)
**Subject:** `Your AI class is tomorrow, {first_name} — Week {week_number}: {session_title}` (24h)
**Subject:** `Class starts in 30 minutes — join now {first_name}` (30min)
Content:
- Session title, week number, date and time in the student's local timezone.
- Agenda (first 3 bullet points from the Markdown agenda, plaintext rendered).
- Tools needed this week (icon list).
- Large "Join class" button linking to the Zoom/Meet URL.
- 30-minute version: simplified — just the join button and session title, no agenda details.

#### Template 3 — New quiz posted
**Subject:** `New quiz for you: {quiz_title} — due {due_date}`
Content:
- Quiz title and type badge.
- Two-sentence description.
- Due date displayed prominently.
- What to do: numbered steps (1. Open your dashboard, 2. Find the quiz in Pending, 3. Submit before the due date).
- CTA: "View quiz on dashboard".

#### Template 4 — Quiz reminder (24 hours before due date)
**Subject:** `{first_name}, your quiz "{quiz_title}" is due tomorrow`
Content:
- Friendly reminder tone.
- Due date/time.
- Current status (submitted or still pending — checked at send time).
- If pending: CTA "Submit now". If already submitted: "You're all set!" confirmation.

#### Template 5 — Quiz graded
**Subject:** `Your quiz has been graded — {quiz_title}`
Content:
- Score displayed large (e.g., `8 / 10`).
- Pass/fail badge.
- Teacher feedback rendered as a blockquote.
- CTA: "View full feedback on dashboard".

#### Template 6 — Session summary posted
**Subject:** `Week {week_number} recap is ready — {session_title}`
Content:
- Brief intro: "Here's what we covered in this week's class."
- Summary body (first 200 words of the Markdown summary, rendered to HTML).
- "Read full summary" CTA.
- Next session teaser: title and date of the next class.

#### Template 7 — General broadcast (teacher-authored)
**Subject:** `{custom_subject_from_teacher}`
Content: teacher's body rendered as HTML. Standard wrapper around it.

#### Template 8 — Completion certificate
**Subject:** `Congratulations {first_name} — you completed Zero to Hero AI Sessions!`
Content:
- Celebratory header.
- Certificate preview image (PNG render of the PDF certificate).
- "Download your certificate" CTA linking to the Supabase Storage signed URL of the generated PDF.
- Summary stats: sessions attended, quizzes completed, cohort name.

#### Template 9 — Mode A events (DTU student)
All existing Mode A notification types (new session, summary posted, document uploaded, quiz posted, quiz graded, announcement) send emails using a simpler template: minimal header, event description, CTA button. No cohort branding, cleaner academic aesthetic.

### 9.3 Email scheduling logic

| Event | Trigger | Delay |
|-------|---------|-------|
| Student registers | OAuth callback | Immediate |
| Session created | Teacher saves session | Immediate (for sessions > 2 days away); 24h reminder scheduled |
| Session 24h reminder | pg_cron | 24 hours before `scheduled_at` |
| Session 30min reminder | pg_cron | 30 minutes before `scheduled_at` |
| Quiz created | Teacher publishes quiz | Immediate |
| Quiz due date reminder | pg_cron | 24 hours before `due_date` |
| Quiz graded | Teacher submits grade | Immediate |
| Summary posted | Teacher saves summary | Immediate |
| Certificate unlocked | System detects 100% completion | Immediate |

### 9.4 Unsubscribe

Every email footer has a one-click unsubscribe link (`/unsubscribe?token={signed_jwt}`). Clicking sets `profiles.email_notifications = false`. The platform still sends password/auth emails (handled by Supabase, not Resend).

---

## 10. Database Schema

### Existing tables (unchanged from v1.1)

`profiles`, `semesters`, `courses`, `sessions`, `documents`, `quizzes`, `notifications`,
`feed_items`, `feed_sources`, `feed_ingest_runs`, `feed_interactions`,
`pg_tracks`, `pg_lessons`, `pg_steps`, `pg_progress`, `pg_attempts`, `pg_feedback`

All existing RLS policies remain unchanged.

### New tables for v2.0

```sql
-- Extend profiles with new fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_group    text CHECK (age_group IN ('little_ones','juniors','advanced')),
  ADD COLUMN IF NOT EXISTS cohort_id    uuid,  -- FK set after cohorts table created
  ADD COLUMN IF NOT EXISTS google_id    text,
  ADD COLUMN IF NOT EXISTS avatar_url   text,
  ADD COLUMN IF NOT EXISTS email_notifications bool DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_complete bool DEFAULT false;

-- Cohorts (the three age groups running the 12-week curriculum)
CREATE TABLE cohorts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,                        -- e.g. "Little Explorers — Batch 1"
  age_group    text NOT NULL CHECK (age_group IN ('little_ones','juniors','advanced')),
  is_active    bool DEFAULT true,
  start_date   date,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE profiles
  ADD CONSTRAINT fk_cohort FOREIGN KEY (cohort_id) REFERENCES cohorts(id);

-- Masterclass sessions (Mode B equivalent of sessions table)
CREATE TABLE masterclass_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number    int NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  title          text NOT NULL,
  session_type   text NOT NULL DEFAULT 'class'
                   CHECK (session_type IN ('class','quiz_session','demo_day','office_hours')),
  scheduled_at   timestamptz NOT NULL,
  duration_min   int DEFAULT 120,
  meeting_link   text NOT NULL,
  cohort_ids     uuid[],                             -- which cohorts this session targets
  agenda_md      text,
  activity_little_ones text,
  activity_juniors     text,
  activity_advanced    text,
  tools_needed   jsonb,                              -- [{name, url}]
  recording_url  text,
  summary_md     text,
  status         text DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','live','completed','cancelled')),
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);

-- Attendance tracking for masterclass sessions
CREATE TABLE masterclass_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES masterclass_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz,
  UNIQUE (session_id, user_id)
);

-- Quizzes for Mode B (separate from Mode A quizzes table)
CREATE TABLE masterclass_quizzes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number  int NOT NULL,
  title        text NOT NULL,
  description  text,
  quiz_type    text NOT NULL CHECK (quiz_type IN ('knowledge_check','hands_on_challenge','reflection')),
  cohort_ids   uuid[],
  due_date     timestamptz NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('inline','file')),
  questions    jsonb,                               -- for inline quizzes: [{question, type, options, correct}]
  file_path    text,                               -- for file-based quizzes
  max_score    int DEFAULT 10,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- Quiz submissions for Mode B
CREATE TABLE masterclass_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES masterclass_quizzes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers       jsonb,                             -- for inline: [{question_id, answer}]
  file_path     text,                             -- for file-based
  submitted_at  timestamptz DEFAULT now(),
  score         numeric(5,2),
  feedback      text,
  graded_at     timestamptz,
  graded_by     uuid REFERENCES profiles(id),
  status        text DEFAULT 'submitted'
                  CHECK (status IN ('submitted','graded')),
  UNIQUE (quiz_id, user_id)
);

-- Completion certificates
CREATE TABLE certificates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cohort_id      uuid NOT NULL REFERENCES cohorts(id),
  issued_at      timestamptz DEFAULT now(),
  pdf_path       text NOT NULL,                   -- Supabase Storage path
  sessions_count int,
  quizzes_count  int,
  UNIQUE (user_id, cohort_id)
);

-- Email queue for async dispatch
CREATE TABLE email_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES profiles(id),
  template     text NOT NULL,
  payload      jsonb NOT NULL,                    -- template variables
  send_at      timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  status       text DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','failed')),
  error        text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX email_queue_pending_idx ON email_queue (send_at) WHERE status = 'pending';
CREATE INDEX masterclass_sessions_scheduled_idx ON masterclass_sessions (scheduled_at);
CREATE INDEX masterclass_quizzes_due_date_idx ON masterclass_quizzes (due_date);
```

---

## 11. Supabase Configuration

### 11.1 Auth providers

- Email provider: enabled (for teacher and Mode A student).
- Google provider: enabled. Client ID and secret stored as Supabase secrets. Redirect URL: `https://educonnect.abdulrafay.dev/auth/callback`.
- Public sign-ups: disabled for email provider. Google OAuth is the only self-serve path and creates `student_group` role only.

### 11.2 RLS additions for v2.0

| Table | Policy |
|-------|--------|
| `cohorts` | Teacher: full CRUD. Students: SELECT on their own cohort. |
| `masterclass_sessions` | Teacher: full CRUD. Student: SELECT where their `cohort_id` is in `cohort_ids`. |
| `masterclass_attendance` | Teacher: full CRUD. Student: INSERT/SELECT where `user_id = auth.uid()`. |
| `masterclass_quizzes` | Teacher: full CRUD. Student: SELECT where their cohort is targeted. |
| `masterclass_submissions` | Teacher: full CRUD. Student: INSERT/SELECT/UPDATE where `user_id = auth.uid()`. |
| `certificates` | Teacher: SELECT all. Student: SELECT where `user_id = auth.uid()`. |
| `email_queue` | Service role only (Edge Function). Teacher: SELECT for monitoring. |

### 11.3 Edge functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `handle_google_auth` | Auth hook (post-sign-in) | Creates `profiles` row for new Google users, assigns `student_group` role |
| `dispatch_emails` | pg_cron every 1 min | Fetches pending `email_queue` rows where `send_at <= now()`, calls Resend API |
| `schedule_session_reminders` | DB trigger on `masterclass_sessions INSERT/UPDATE` | Inserts 24h and 30min reminder rows into `email_queue` |
| `schedule_quiz_reminder` | DB trigger on `masterclass_quizzes INSERT` | Inserts quiz notification + 24h-before-due reminder into `email_queue` |
| `check_certificate_eligibility` | DB trigger on `masterclass_submissions INSERT/UPDATE` | Checks if user has completed all quizzes; if yes, generates PDF and inserts `certificates` row, queues certificate email |
| `ingest_feeds` | pg_cron every hour at :07 | RSS ingestion from v1.1 (unchanged) |

### 11.4 Storage buckets

| Bucket | Access | Contents |
|--------|--------|----------|
| `documents` | Private, signed URLs | Mode A course documents |
| `quiz-submissions` | Private | Mode A quiz submission files |
| `masterclass-materials` | Private, signed URLs | Mode B session materials |
| `masterclass-submissions` | Private | Mode B quiz submission files |
| `certificates` | Private, signed URLs (student reads own) | Generated certificate PDFs |
| `branding` | Public | Feed cover images, avatars |

---

## 12. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Security | All DB access via RLS; no service-role key in frontend code |
| Privacy | No public routes except `/join`, `/login`, `/unsubscribe`; all others require auth |
| Performance | Dashboard load < 2s on 4G mobile; real-time latency < 1s |
| Time zones | All timestamps stored UTC; PKT (UTC+5) for teacher; CET/CEST for DTU student; local browser time for Mode B students |
| Email deliverability | SPF, DKIM, DMARC configured on sender domain via Resend dashboard |
| File size | Max 50 MB per upload; certificates max 2 MB |
| Availability | Supabase Pro for 99.9% uptime; Resend 99.99% uptime SLA |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2 versions); iOS Safari 16+; Android Chrome |
| Accessibility | WCAG 2.1 AA — all interactive elements keyboard navigable, all images have alt text, color contrast ≥ 4.5:1 for normal text |
| GDPR consideration | Users can request account deletion from Settings; deletion cascades profile and submissions; email queue purged |

---

## 13. AI Feed (from v1.1)

All requirements from §13 of v1.1 are preserved unchanged. The feed is visible to all three roles. Mode B students see the same feed as the DTU student, but the difficulty filter defaults to `foundations` for `little_ones` cohort and `core` for `juniors`.

---

## 14. Programming Playground (from v1.1)

All requirements from §14 of v1.1 are preserved unchanged. Age gating is applied:

- `little_ones` cohort: playground is visible but locked with a friendly message ("Coding playground coming soon for you — keep attending classes!"). Unlocks at Week 9 per the curriculum.
- `juniors` and `advanced` cohorts: full access from Week 5 onwards.
- DTU student: full access always.

---

## 15. Project Milestones

### Phase 1 — Auth + onboarding (1 week)
- Google OAuth integration with Supabase
- `/join` landing page with Google button
- `/onboarding` two-step form (name + age group)
- `handle_google_auth` Edge Function
- `profiles` schema update and RLS
- Teacher setup page and self-registration lock

### Phase 2 — Mode B cohorts + scheduling (1 week)
- `cohorts` and `masterclass_sessions` tables + RLS
- Teacher cohort management panel
- 12-week schedule generator tool
- Student session calendar view and dashboard countdown
- Attendance tracking

### Phase 3 — Mode B quizzes (1 week)
- `masterclass_quizzes` and `masterclass_submissions` tables
- Inline quiz builder (multiple choice + short answer)
- Student quiz attempt UI
- Teacher grading panel

### Phase 4 — Email pipeline (1 week)
- Resend account + domain + DKIM setup
- React Email template components (all 9 templates)
- `email_queue` table and `dispatch_emails` Edge Function
- All DB triggers for session and quiz scheduling
- Unsubscribe endpoint

### Phase 5 — Certificates + completion (3 days)
- `certificates` table
- PDF generation with @react-pdf/renderer
- `check_certificate_eligibility` Edge Function
- Certificate email template
- Student certificate download UI

### Phase 6 — UI polish pass (1 week)
- Apply design system §8 across all new screens
- Mobile bottom tab bar for Mode B
- Empty states with action buttons
- Loading skeletons everywhere
- Animation and transition review
- Accessibility audit (keyboard nav, contrast, alt text)

### Phase 7 — Mode A preservation + integration testing (3 days)
- Verify all Mode A features work with the updated schema
- Mode switcher in teacher admin panel
- End-to-end test: Google sign-in → onboarding → cohort enrolment → email received → quiz submitted → certificate generated

### Phase 8 — Deployment (2 days)
- Vercel deployment with env vars
- Supabase production project (Pro plan)
- Resend domain verification
- pg_cron jobs verified in production
- Smoke test all email templates against real inboxes

**Total estimated time: ~7 weeks**

---

## 16. Page Inventory

### Shared / auth pages

| Path | Role | Description |
|------|------|-------------|
| `/join` | Public | Mode B landing page with Google OAuth button |
| `/login` | Public | Email + password login (Mode A student and teacher) |
| `/auth/callback` | Public | Supabase OAuth redirect handler |
| `/onboarding` | student_group (new) | Two-step profile + age-group setup |
| `/unsubscribe` | Public (token-gated) | One-click email unsubscribe |
| `/settings` | All | Profile, password change, notification preferences |

### Mode A — 1:1 private track

| Path | Role | Description |
|------|------|-------------|
| `/dashboard` | Both (Mode A) | Role-aware landing: teacher overview or student session countdown |
| `/courses` | Both | Course list |
| `/courses/:id` | Both | Course detail: lectures, documents, quizzes, progress |
| `/sessions` | Both | Session calendar and list |
| `/sessions/:id` | Both | Session detail with Zoom link and summary |
| `/documents` | Both | Document library |
| `/quizzes` | Both | Quiz list |
| `/quizzes/:id` | Both | Quiz detail and submission |
| `/notifications` | Both | Full notification history |
| `/admin` | teacher | Admin panel — mode switcher at top |
| `/admin/students` | teacher | DTU student account management |
| `/admin/semesters` | teacher | Semester management |

### Mode B — AI Masterclass Hub

| Path | Role | Description |
|------|------|-------------|
| `/masterclass` | student_group | Student hub: upcoming session, progress ring, pending quiz |
| `/masterclass/sessions` | student_group | 12-week session list with status |
| `/masterclass/sessions/:id` | student_group | Session detail: agenda, cohort activity, tools, summary, recording |
| `/masterclass/quizzes` | student_group | Quiz list (pending, submitted, graded) |
| `/masterclass/quizzes/:id` | student_group | Quiz attempt or result view |
| `/masterclass/progress` | student_group | Full progress: sessions, quizzes, badges, certificate |
| `/admin/masterclass` | teacher | Mode B admin hub |
| `/admin/masterclass/cohorts` | teacher | Cohort roster, progress per student, CSV export |
| `/admin/masterclass/sessions` | teacher | Session CRUD, schedule generator, attendance |
| `/admin/masterclass/sessions/new` | teacher | New session form |
| `/admin/masterclass/sessions/:id/edit` | teacher | Edit session, add summary, recording link |
| `/admin/masterclass/quizzes` | teacher | Quiz list, submission counts, pending reviews |
| `/admin/masterclass/quizzes/new` | teacher | Quiz builder (inline or file) |
| `/admin/masterclass/quizzes/:id/grade` | teacher | Review submissions and add feedback |
| `/admin/masterclass/broadcast` | teacher | Send custom email to all or specific cohort |
| `/admin/masterclass/email-log` | teacher | Email queue status, sent history, failures |

### AI Feed and Playground (both modes)

| Path | Role | Description |
|------|------|-------------|
| `/feed` | All students | AI news and concept feed |
| `/feed/:id` | All students | Feed item reader view |
| `/feed/saved` | All students | Saved items |
| `/playground` | All students (age-gated) | Track grid |
| `/playground/tracks/:id` | All students | Lesson list |
| `/playground/lessons/:id` | All students | Step stepper |
| `/playground/steps/:id` | All students | Challenge: Monaco + console |
| `/admin/feed` | teacher | Feed item management |
| `/admin/feed/sources` | teacher | RSS source CRUD |
| `/admin/feed/new` | teacher | Concept authoring |
| `/admin/playground` | teacher | Track and lesson CRUD |
| `/admin/playground/edit/:trackId` | teacher | Step editor and test-case builder |
| `/admin/playground/progress` | teacher | Student progress, struggle flags, feedback |

---

*End of Document v2.0*

*This PRD is a living document. All section numbers in v1.0 and v1.1 remain stable. New v2.0 sections start at §5 (Auth & Registration) and §7 (Mode B). Sections §6, §13, and §14 preserve previous content exactly.*