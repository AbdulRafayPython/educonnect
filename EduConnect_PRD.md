# Product Requirements Document (PRD)
## EduConnect — Private Online Teaching Platform
**Version:** 1.1
**Date:** May 7, 2026 (v1.1 addendum); original April 11, 2026
**Author:** Platform Owner (Teacher)
**Status:** Draft

> **v1.1 changelog:** Adds **§13 AI Feed** and **§14 Programming Playground** — two student-facing learning surfaces (curated AI knowledge & news feed, and an interactive programming environment with progress telemetry visible to the teacher). All v1.0 sections below are unchanged; the new sections are appended at the end so existing references stay stable.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Stakeholders & User Roles (RBAC)](#3-stakeholders--user-roles-rbac)
4. [Tech Stack](#4-tech-stack)
5. [Feature Requirements](#5-feature-requirements)
6. [Database Schema](#6-database-schema)
7. [UI/UX Requirements](#7-uiux-requirements)
8. [Notification System](#8-notification-system)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Supabase Configuration](#10-supabase-configuration)
11. [Project Milestones](#11-project-milestones)
12. [Appendix — Page Inventory](#12-appendix--page-inventory)
13. [AI Feed (v1.1)](#13-ai-feed-v11)
14. [Programming Playground (v1.1)](#14-programming-playground-v11)

---

## 1. Executive Summary

EduConnect is a private, invite-only web application built to support a one-on-one online tutoring relationship between a teacher (in Pakistan) and a student (in Denmark). It centralises all session management, course tracking, document sharing, quiz/challenge uploads, and real-time notifications into a single professional dashboard. The platform is owned and administered entirely by the teacher.

---

## 2. Product Vision & Goals

| Goal | Description |
|------|-------------|
| **Centralised scheduling** | All Zoom session links, timings, and topics in one place |
| **Course progress tracking** | Know exactly how many lectures remain per course |
| **Knowledge capture** | Session summaries so both parties can review what was covered |
| **Resource management** | Documents, quizzes, and challenges organised per course |
| **Real-time awareness** | Notification bell keeps both parties informed instantly |
| **Privacy** | Closed system — only the teacher can create accounts |

---

## 3. Stakeholders & User Roles (RBAC)

### 3.1 Role Definitions

| Role | Description | Account Creation |
|------|-------------|------------------|
| **Teacher (Admin)** | Full administrative control over the entire application | Self-registered on initial setup |
| **Student** | Read/interact access scoped to their own enrolled courses | Created exclusively by Teacher |

### 3.2 Permissions Matrix

| Feature | Teacher | Student |
|---------|---------|---------|
| Create student accounts | ✅ | ❌ |
| Manage courses & semesters | ✅ | ❌ |
| Add / edit sessions | ✅ | ❌ |
| View sessions | ✅ | ✅ |
| Add session summaries | ✅ | ❌ |
| View session summaries | ✅ | ✅ |
| Upload documents | ✅ | ❌ |
| Download documents | ✅ | ✅ |
| Upload quizzes / challenges | ✅ | ❌ |
| View / attempt quizzes | ✅ | ✅ |
| Add Zoom links | ✅ | ❌ |
| View Zoom links | ✅ | ✅ |
| Send global notifications | ✅ | ❌ |
| View notifications | ✅ | ✅ |
| Manage lecture count | ✅ | ❌ |
| View lecture progress | ✅ | ✅ |

---

## 4. Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js (Vite) + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State Management** | Zustand |
| **Backend / Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth (email + password) |
| **Real-time** | Supabase Realtime (notifications) |
| **File Storage** | Supabase Storage (documents, quizzes) |
| **Time / Date** | date-fns |
| **Video Links** | Stored URLs (Zoom meeting links) |
| **Hosting** | Vercel (recommended) |

---

## 5. Feature Requirements

### 5.1 Authentication & Account Management

- **FR-AUTH-01:** Teacher logs in with email/password via Supabase Auth.
- **FR-AUTH-02:** Only the Teacher role can create new student accounts via a "Create Student" form in the Admin panel.
- **FR-AUTH-03:** Students receive login credentials via email (Supabase invite email).
- **FR-AUTH-04:** Role is stored in `profiles.role` and enforced via Supabase Row Level Security (RLS).
- **FR-AUTH-05:** Session tokens are managed by Supabase; auto-refresh on page reload.

---

### 5.2 Dashboard

#### Teacher Dashboard
- Overview cards: total courses, total sessions this week, upcoming sessions, pending quizzes to grade.
- Quick-action buttons: Add Session, Create Course, Upload Document.
- Recent activity feed.
- Notification summary widget.

#### Student Dashboard
- Upcoming session card with Zoom link + countdown timer.
- Enrolled courses with progress bars.
- Recent session summaries.
- Pending quizzes / challenges.
- Notification bell + recent notifications.

---

### 5.3 Semester & Course Management

- **FR-COURSE-01:** Teacher can create a Semester (e.g., "Fall 2026") with a start and end date.
- **FR-COURSE-02:** Teacher can add Courses to a Semester (title, description, total planned lecture count).
- **FR-COURSE-03:** Each Course tracks:
  - Total planned lectures
  - Completed lectures (auto-incremented when a session is marked "Completed")
  - Remaining lectures = Total − Completed
  - Percentage progress bar
- **FR-COURSE-04:** Student can view all enrolled courses with progress indicators.
- **FR-COURSE-05:** Teacher can archive a completed course.

---

### 5.4 Session / Lecture Management

- **FR-SESSION-01:** Teacher can schedule a session with:
  - Title (e.g., "Chapter 3: Arrays & Linked Lists")
  - Date & time (with time-zone awareness — PKT for teacher, CET/CEST for student; both times displayed)
  - Duration (minutes)
  - Zoom meeting link
  - Linked course
  - Status: `Scheduled | In Progress | Completed | Cancelled`
- **FR-SESSION-02:** On marking a session `Completed`, the lecture count for the linked course increments automatically.
- **FR-SESSION-03:** Teacher can add a post-session summary (rich text, markdown supported).
- **FR-SESSION-04:** Student can view all sessions for their enrolled courses, filtered by status.
- **FR-SESSION-05:** Sessions display both PKT and CET/CEST times side by side.
- **FR-SESSION-06:** A countdown timer shows time remaining until the next scheduled session.

---

### 5.5 Zoom Session Links

- **FR-ZOOM-01:** Each session record stores a Zoom meeting URL.
- **FR-ZOOM-02:** Student dashboard highlights the next upcoming session with a prominent "Join Zoom" button that becomes active 15 minutes before the scheduled time.
- **FR-ZOOM-03:** Teacher can update the Zoom link for any future session.

---

### 5.6 Session Summaries

- **FR-SUMMARY-01:** After each session the Teacher can write a summary: topics covered, key concepts, homework assigned.
- **FR-SUMMARY-02:** Summaries are attached to sessions and visible to the student.
- **FR-SUMMARY-03:** Student can view all past summaries in a chronological feed.
- **FR-SUMMARY-04:** Teacher can edit summaries after submission.

---

### 5.7 Document Management

- **FR-DOC-01:** Teacher can upload documents (PDF, DOCX, PPTX, images) to a specific course.
- **FR-DOC-02:** Documents are tagged: `Lecture Notes | Reference | Assignment | Other`.
- **FR-DOC-03:** Student can download any document attached to their enrolled course.
- **FR-DOC-04:** Teacher can delete or replace documents.
- **FR-DOC-05:** File storage via Supabase Storage with private buckets and signed URLs.

---

### 5.8 Quizzes & Challenges

- **FR-QUIZ-01:** Teacher can upload a quiz or challenge as a file (PDF/DOCX) or write it inline (text + multiple-choice).
- **FR-QUIZ-02:** Each quiz has: title, linked course, due date, type (`Quiz | Challenge | Assignment`), and status (`Pending | Submitted | Graded`).
- **FR-QUIZ-03:** Student can view pending quizzes, download the file, and mark as submitted (upload their answer file).
- **FR-QUIZ-04:** Teacher can view submissions and update the grade/feedback field.
- **FR-QUIZ-05:** Graded quizzes are visible to the student with score and teacher feedback.

---

### 5.9 Lecture Progress Tracker

- **FR-PROGRESS-01:** Each course displays:
  - A circular or linear progress bar: X of Y lectures completed.
  - List of all lecture sessions (title, date, status) expandable in an accordion.
  - Estimated completion date based on average session frequency.
- **FR-PROGRESS-02:** Teacher can manually override the total lecture count.
- **FR-PROGRESS-03:** Overview page for teacher showing all courses and their progress at a glance.

---

### 5.10 Notification System

- **FR-NOTIF-01:** A bell icon in the global navigation bar shows an unread count badge.
- **FR-NOTIF-02:** Clicking the bell opens a dropdown/panel listing all notifications, newest first.
- **FR-NOTIF-03:** Notification types:

| Event | Who is notified |
|-------|----------------|
| New session scheduled | Student |
| Session time updated | Student |
| Session cancelled | Student |
| Session summary posted | Student |
| New document uploaded | Student |
| New quiz / challenge posted | Student |
| Quiz graded | Student |
| General announcement | Student |

- **FR-NOTIF-04:** Teacher can broadcast a custom announcement to the student from the Admin panel.
- **FR-NOTIF-05:** Notifications are stored in the database; real-time delivery via Supabase Realtime subscriptions.
- **FR-NOTIF-06:** Individual notifications can be marked as read; "Mark all as read" button available.
- **FR-NOTIF-07:** Teacher has their own notification feed for student quiz submissions.

---

## 6. Database Schema

### `profiles`
```sql
id           uuid  PRIMARY KEY (references auth.users)
role         text  CHECK (role IN ('teacher', 'student'))
full_name    text
email        text
avatar_url   text
created_at   timestamptz
```

### `semesters`
```sql
id           uuid  PRIMARY KEY
title        text  (e.g., "Fall 2026")
start_date   date
end_date     date
created_by   uuid  FK profiles
```

### `courses`
```sql
id                    uuid  PRIMARY KEY
semester_id           uuid  FK semesters
title                 text
description           text
total_lectures        int
completed_lectures    int  DEFAULT 0
created_by            uuid  FK profiles
is_archived           bool DEFAULT false
created_at            timestamptz
```

### `sessions`
```sql
id              uuid  PRIMARY KEY
course_id       uuid  FK courses
title           text
scheduled_at    timestamptz  (stored in UTC)
duration_min    int
zoom_link       text
status          text  CHECK IN ('scheduled','in_progress','completed','cancelled')
summary         text
created_by      uuid  FK profiles
created_at      timestamptz
```

### `documents`
```sql
id           uuid  PRIMARY KEY
course_id    uuid  FK courses
title        text
file_path    text  (Supabase Storage path)
file_type    text
tag          text  CHECK IN ('notes','reference','assignment','other')
uploaded_by  uuid  FK profiles
created_at   timestamptz
```

### `quizzes`
```sql
id             uuid  PRIMARY KEY
course_id      uuid  FK courses
title          text
description    text
file_path      text
type           text  CHECK IN ('quiz','challenge','assignment')
due_date       timestamptz
status         text  DEFAULT 'pending'
submission_path text
grade          text
feedback       text
created_by     uuid  FK profiles
created_at     timestamptz
```

### `notifications`
```sql
id           uuid  PRIMARY KEY
recipient_id uuid  FK profiles
type         text
title        text
body         text
is_read      bool  DEFAULT false
related_id   uuid  (optional: session/quiz/doc id)
created_at   timestamptz
```

---

## 7. UI/UX Requirements

### 7.1 Design Principles
- Clean, professional, academic aesthetic.
- Color palette: deep navy primary, white background, accent teal/green for progress.
- Fully responsive (desktop-first but mobile-friendly).
- Consistent spacing using Tailwind's design system.

### 7.2 Navigation Structure

**Teacher (Admin) Navigation:**
```
Dashboard | Courses | Sessions | Documents | Quizzes | Students | Notifications | Settings
```

**Student Navigation:**
```
Dashboard | My Courses | Sessions | Documents | Quizzes | Notifications
```

### 7.3 Key UI Components
- **Progress Ring:** Circular SVG progress indicator on each course card.
- **Session Card:** Shows title, date/time in both time zones (PKT & CET), Zoom button, status badge.
- **Notification Bell:** Animated badge with unread count; real-time update via Supabase Realtime.
- **Countdown Timer:** Live countdown to next session displayed prominently on student dashboard.
- **Lecture Tracker:** Accordion list of all lectures per course with status icons (✅ Completed, 🕐 Scheduled, ❌ Cancelled).
- **Summary Viewer:** Card-based view of session summaries with date and course tag.

---

## 8. Notification System

### 8.1 Architecture
- Notifications are written to the `notifications` table on every relevant action (new session, new quiz, etc.).
- The frontend subscribes to Supabase Realtime channel filtered by `recipient_id = current_user_id`.
- On receiving a new notification event, the bell badge count increments and a toast appears in the corner.

### 8.2 Notification Bell Behaviour
- Unread count shown as a red badge on the bell icon.
- Clicking opens a slide-in panel (not a page change) listing all notifications.
- Each entry shows: icon (based on type), title, short body text, relative time (e.g., "2 hours ago").
- Click on a notification navigates to the relevant resource and marks it as read.

---

## 9. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| **Security** | All database access via Supabase RLS policies; no direct table access without auth |
| **Privacy** | No public-facing pages; all routes are behind authentication |
| **Performance** | Dashboard initial load < 2 seconds; real-time latency < 1 second |
| **Time Zones** | All times stored in UTC; displayed in PKT (UTC+5) for Teacher and CET/CEST for Student |
| **File Size** | Max upload size 50 MB per file |
| **Availability** | Supabase free tier SLA; upgrade to Pro for 99.9% uptime |
| **Browser Support** | Chrome, Firefox, Safari, Edge (latest 2 versions) |

---

## 10. Supabase Configuration

### 10.1 Auth Settings
- Email + password sign-in enabled.
- "Confirm email" enabled for student invites.
- Disable public sign-ups — teacher creates all accounts via Admin API.

### 10.2 Row Level Security (RLS) Policies (summary)

| Table | Policy |
|-------|--------|
| `profiles` | Users can read their own row; Teacher can read all |
| `courses` | Teacher: full CRUD; Student: SELECT only |
| `sessions` | Teacher: full CRUD; Student: SELECT only |
| `documents` | Teacher: full CRUD; Student: SELECT + download |
| `quizzes` | Teacher: full CRUD; Student: SELECT + update own submission |
| `notifications` | Users can SELECT/UPDATE their own rows; Teacher can INSERT for any recipient |

### 10.3 Storage Buckets
- `documents` — private, accessed via signed URLs.
- `quiz-submissions` — private, teacher reads all, student reads own.

---

## 11. Project Milestones

| Phase | Deliverable | Duration |
|-------|-------------|----------|
| **Phase 1** | Supabase setup, Auth, RBAC, profiles | 1 week |
| **Phase 2** | Course & Semester management + Lecture Tracker | 1 week |
| **Phase 3** | Session scheduling + Zoom links + Time zone display | 1 week |
| **Phase 4** | Session Summaries + Document uploads | 1 week |
| **Phase 5** | Quizzes & Challenges module | 1 week |
| **Phase 6** | Notification system (bell + Realtime) | 3–4 days |
| **Phase 7** | Teacher Admin panel + Student account creation | 3–4 days |
| **Phase 8** | UI polish, responsive design, testing, deployment | 1 week |
| **Total** | | **~8 weeks** |

---

## 12. Appendix — Page Inventory

| Page | Role | Description |
|------|------|-------------|
| `/login` | Both | Email/password login |
| `/dashboard` | Both | Role-aware landing page |
| `/courses` | Both | List of all courses / enrolled courses |
| `/courses/:id` | Both | Course detail: lectures, documents, quizzes, progress |
| `/sessions` | Both | Full session calendar/list |
| `/sessions/:id` | Both | Session detail with Zoom link + summary |
| `/documents` | Both | All documents (teacher: upload; student: download) |
| `/quizzes` | Both | All quizzes/challenges |
| `/quizzes/:id` | Both | Quiz detail + submission |
| `/notifications` | Both | Full notification history |
| `/admin` | Teacher | Admin panel |
| `/admin/students` | Teacher | Student list + create new student |
| `/admin/semesters` | Teacher | Manage semesters |
| `/settings` | Both | Profile settings, password change |

---

## 13. AI Feed (v1.1)

### 13.1 Goal
Give the student a single surface where they (a) build foundational understanding of Artificial Intelligence and (b) keep up with what's happening across the AI / tech world. **News is fully automated** — pulled from trusted RSS sources, simplified into easy wording, paired with an image, and published directly to the student feed without any teacher action. **Concepts** remain teacher-authored. The teacher still owns the source list and can hide/unpublish anything they don't want shown, but the default flow is hands-off.

### 13.2 Two surface modes

| Mode | What it is | How it's populated |
|------|------------|--------------------|
| **News** | Headlines from the AI/ML world. Each card has a cover image, simplified 2–3 sentence summary in plain language, source attribution, and an "Open original" link. | **Fully automated.** A scheduled Edge Function pulls every active source in `feed_sources`, dedupes by URL, extracts a cover image (Open Graph / RSS enclosure / first article image), runs the title + excerpt through a "simplifier" LLM call to produce easy wording, and inserts the row directly into `feed_items` with `status = 'published'`. No teacher review. |
| **Concepts** | Bite-sized explainers ("What is gradient descent?", "How does a transformer work?"). | **Teacher-authored** (Markdown), tagged by difficulty (`Foundations / Core / Advanced`). |

### 13.3 Functional requirements

#### Student
- **FR-FEED-01:** Student sees `/student/feed` with two tabs: `For You` (mixed News + Concepts, reverse-chronological) and `Concepts` (only the explainer stream).
- **FR-FEED-02:** Each card has: **cover image** (always present — falls back to a per-source branded gradient if extraction failed), title, **simplified 2–3 sentence summary in easy wording**, type badge (`News` / `Concept`), difficulty chip, source name + favicon (news), relative time ("3 hours ago"), and a primary "Read more" CTA.
- **FR-FEED-03:** Detail page (`/student/feed/:id`) renders the full simplified body, the cover image at full width, source link with "Open original →" CTA, and a reading-time estimate (~200 wpm). Concept items render Markdown with code highlighting.
- **FR-FEED-04:** Student can **Save** and **React** (👍 / 🤔 / 🤯). Read state auto-tracks on detail-page view.
- **FR-FEED-05:** Saved items live at `/student/feed/saved`. Read items fade visually but stay in the feed.
- **FR-FEED-06:** Filter chips: type (`All / News / Concepts`), source (multi-select), difficulty.

#### Teacher
- **FR-FEED-07:** `/teacher/feed/sources` — CRUD for the RSS source list (`name`, `rss_url`, `is_active`, optional `brand_color` for the fallback gradient). "Test fetch" button shows the latest 5 entries the source returns, so the teacher can sanity-check before activating.
- **FR-FEED-08:** `/teacher/feed` — table of all published `feed_items` (news + concepts) with engagement metrics (read / saved / reaction counts). Per-row actions: **Hide** (sets `status = 'hidden'`, vanishes from student feed), **Pin** (sticky at top of student feed for 24h), **Re-simplify** (re-runs the LLM on a news item if the simplification looks wrong), **Delete**.
- **FR-FEED-09:** `/teacher/feed/new` — Markdown editor for **Concept** authoring (title, body, difficulty, cover_image_url, status). News items are *never* hand-authored — the teacher only curates sources and moderates output.
- **FR-FEED-10:** Teacher dashboard widget: "Top 3 most-reacted items this week" + "Source health" (sources that haven't returned a new item in 14 days).

#### Automation
- **FR-FEED-11:** Edge Function `ingest_feeds` runs **every 60 min** via `pg_cron`. For each active source: fetch RSS → for each new entry not in `feed_items.source_url`:
  1. Extract a cover image (priority: RSS `<media:content>` / `<enclosure>` → Open Graph `og:image` from the canonical URL → first `<img>` in article body → null).
  2. Build a "raw excerpt" from the RSS `description` (HTML-stripped, ≤2000 chars).
  3. Call the **simplifier** — Google Gemini (`gemini-2.5-flash` via the official Generative Language API) — with a fixed system prompt: *"Rewrite the following AI/tech news for a high-school student in 2–3 short sentences. Plain language, no jargon, no hype. Return JSON: `{title_simple, summary_simple}`."* `responseMimeType: "application/json"` is set on the request so the model returns parseable JSON natively.
  4. Insert into `feed_items` with `status = 'published'`, `type = 'news'`, `published_at = now()`.
  5. Emit a `feed_item_published` notification to the student via the existing `notifications` table.
- **FR-FEED-12:** Rate limiting / cost guard — at most 30 LLM calls per ingestion run. If a source returns more than its share, the surplus is queued for the next run. A daily counter in `feed_ingest_runs` caps total runs/day.
- **FR-FEED-13:** **Image proxying** — `cover_image_url` may point at a third-party origin that hot-link-blocks or rotates. The function copies the image into the public `branding/feed-covers/{item_id}.{ext}` Supabase bucket path (max 800 KB, downscaled to 1200×630 if larger) and stores that URL on the row. Originals only kept as fallback in `cover_image_url_original`.
- **FR-FEED-14:** Failure mode — a failing source does not block other sources. Errors logged to `feed_ingest_runs` with `source_id`, `error_message`, `entries_pulled`. Teacher dashboard surfaces sources failing 3 runs in a row.

### 13.4 Recommended default sources (seeded via initial migration)

| Name | RSS |
|------|-----|
| Hugging Face Papers | `https://huggingface.co/papers/rss` |
| Anthropic | `https://www.anthropic.com/news/rss.xml` |
| OpenAI | `https://openai.com/news/rss.xml` |
| Google DeepMind | `https://deepmind.google/blog/rss.xml` |
| Simon Willison | `https://simonwillison.net/atom/everything/` |
| MIT Tech Review — AI | `https://www.technologyreview.com/topic/artificial-intelligence/feed` |
| The Verge — AI | `https://www.theverge.com/ai-artificial-intelligence/rss/index.xml` |

Editable by teacher.

### 13.5 Database schema (additions)

```sql
-- Published items shown to the student (news = automated, concepts = teacher-authored)
CREATE TABLE feed_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                     text NOT NULL CHECK (type IN ('news','concept')),
  status                   text NOT NULL DEFAULT 'published'
                              CHECK (status IN ('published','hidden','archived','draft')),
  difficulty               text DEFAULT 'core' CHECK (difficulty IN ('foundations','core','advanced')),
  title                    text NOT NULL,        -- already simplified for news
  summary                  text NOT NULL,        -- ≤320 chars, simplified
  body                     text,                 -- concept: Markdown; news: optional longer simplified body
  cover_image_url          text,                 -- proxied URL in our branding bucket
  cover_image_url_original text,                 -- third-party origin (fallback)
  source_id                uuid REFERENCES feed_sources(id),
  source_name              text,                 -- denormalised for the card UI
  source_url               text,                 -- canonical link to the original article (news)
  published_at             timestamptz DEFAULT now(),
  pinned_until             timestamptz,
  created_by               uuid REFERENCES profiles(id),  -- null for automated news
  created_at               timestamptz DEFAULT now(),
  UNIQUE (source_url)
);

-- Trusted RSS sources
CREATE TABLE feed_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  rss_url         text NOT NULL UNIQUE,
  is_active       bool DEFAULT true,
  brand_color     text,                          -- hex; used in fallback gradient cover
  last_fetched_at timestamptz,
  consecutive_failures int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Per-run audit log for the ingest function
CREATE TABLE feed_ingest_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  sources_seen  int DEFAULT 0,
  items_inserted int DEFAULT 0,
  llm_calls     int DEFAULT 0,
  errors        jsonb                            -- [{source_id, message}]
);

-- Per-student interaction state (saved / reaction); read state inferred from a view below
CREATE TABLE feed_interactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid REFERENCES feed_items(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_read    bool DEFAULT false,
  is_saved   bool DEFAULT false,
  reaction   text CHECK (reaction IN ('like','curious','mind_blown')),
  read_at    timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (item_id, user_id)
);

CREATE INDEX feed_items_published_at_idx ON feed_items (published_at DESC) WHERE status = 'published';
CREATE INDEX feed_items_source_url_idx ON feed_items (source_url);
```

### 13.6 RLS

| Table | Policy |
|-------|--------|
| `feed_items` | Teacher: full CRUD. Student: SELECT where `status = 'published'`. |
| `feed_sources` | Teacher only. |
| `feed_ingest_runs` | Teacher SELECT only; service role inserts. |
| `feed_interactions` | User can SELECT/INSERT/UPDATE where `user_id = auth.uid()`. Teacher can SELECT all (engagement dashboards). |

### 13.7 UI / pages

- **Student `/student/feed`** — magazine-style grid (two columns desktop, one column mobile). Pinned items pulled to the top. Filter chips: `All / News / Concepts`, source multi-select, difficulty.
- **Student `/student/feed/:id`** — reader view. Cover image at full width, simplified body, "Open original →" CTA for news, related items below.
- **Student `/student/feed/saved`** — same grid, only saved items.
- **Teacher `/teacher/feed`** — table of all items with engagement, hide/pin/re-simplify/delete actions. No "review queue" — news is live by default.
- **Teacher `/teacher/feed/new`** — Markdown editor for **Concept** items only.
- **Teacher `/teacher/feed/sources`** — sources CRUD with "Test fetch" preview, source-health indicator, brand color picker for fallback gradients.

### 13.8 Automated ingestion architecture

- **Edge Function:** `supabase/functions/ingest_feeds/index.ts` (Deno).
  - Uses `fast-xml-parser` for RSS/Atom parsing.
  - Image extraction: try `<media:content url=>`, `<enclosure url=>`, `<itunes:image>`, then fetch the article URL and parse `<meta property="og:image">` and `<meta name="twitter:image">`. Falls back to first `<img>` in article body. If all fail, leave null and let the UI render a per-source brand gradient.
  - Image proxying: download the chosen URL → if larger than 800 KB or wider than 1200 px, downscale via `https://deno.land/x/imagescript` → upload to `branding/feed-covers/{item_id}.{ext}` with `cacheControl: 31536000`.
  - Simplifier LLM: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY` with `generationConfig: { temperature: 0.3, maxOutputTokens: 300, responseMimeType: "application/json", responseSchema: { type: "object", properties: { title_simple: {type:"string"}, summary_simple: {type:"string"} }, required: ["title_simple","summary_simple"] } }`. The response schema guarantees parseable JSON; tolerant fallback (regex first `{...}` block) only kicks in on hard parse failures.
  - Secrets: `GEMINI_API_KEY` set via `supabase secrets set GEMINI_API_KEY=...`. Service-role key is implicit in Edge Function runtime.
- **Schedule:** `pg_cron` job in a migration: `SELECT cron.schedule('ingest_feeds_hourly', '7 * * * *', $$select net.http_post(url := '<function-url>', headers := jsonb_build_object('Authorization','Bearer <invoke-key>'))$$);`. Minute 7 (not 0) per the off-the-hour convention.
- **Manual trigger:** teacher dashboard has a "Refresh feed now" button that hits the same function URL — useful for testing or after adding a new source.
- **Local dev:** `npx supabase functions serve ingest_feeds --env-file .env.local` lets us iterate without deploying.

### 13.9 LLM provider — Google Gemini

**Model:** `gemini-2.5-flash` via the Google AI / Generative Language API. Chosen because:

- **Cost:** Gemini 2.5 Flash is roughly $0.075–0.30 per 1M input tokens (free tier covers ~1500 requests/day on the AI Studio key, which is well above one ingest run/hour × 30 items). Effectively free for this workload.
- **Native JSON mode:** `responseMimeType: "application/json"` + `responseSchema` removes the "did the model return valid JSON?" failure class entirely. The simplifier doesn't need any prompt-engineered JSON wrappers.
- **Region / availability:** the AI Studio endpoint is reachable from Supabase Edge Functions without an org/project key dance.

**Setup:**

```bash
# Once
supabase secrets set GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>
supabase functions deploy ingest_feeds
```

**Request shape (Deno/Edge Function):**

```ts
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`;
const body = {
  systemInstruction: { parts: [{ text: SIMPLIFIER_SYSTEM_PROMPT }] },
  contents: [{ role: "user", parts: [{ text: `Title: ${title}\n\nExcerpt: ${excerpt}` }] }],
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 300,
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        title_simple: { type: "string" },
        summary_simple: { type: "string" }
      },
      required: ["title_simple", "summary_simple"]
    }
  }
};
const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const data = await res.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
const { title_simple, summary_simple } = JSON.parse(text);
```

**Failure modes:**
- Quota exhausted → log to `feed_ingest_runs.errors` and fall back to the raw RSS title + first 240 chars of excerpt (item still gets published, wording is just less polished).
- Schema validation failure → tolerant regex fallback extracts the first `{...}` block from the response text.
- Network timeout (set 15 s ceiling per call) → skip that item; it'll retry on the next ingest run since dedup is by `source_url`.

---

## 14. Programming Playground (v1.1)

### 14.1 Goal
Turn EduConnect into a place the student actively practices — not just reads. The playground is a guided coding environment: structured tracks, lessons with embedded interactive problems, in-browser code execution, automatic grading, and a dashboard the teacher uses to see *exactly* how the student is progressing (which lessons completed, time spent, attempts, where they got stuck).

### 14.2 Scope (v1)
- **Languages:** Python and JavaScript at launch. (Python via Pyodide in-browser; JavaScript via a sandboxed worker.)
- **Format:** A learning track is a sequence of **lessons**. Each lesson is a stack of **steps**. A step is either a **reading** (Markdown) or a **challenge** (problem statement + starter code + test cases).
- **Future-friendly:** schema modeled so we can add C++/Java later via a remote sandbox (Judge0 self-host or the official paid API) without changing tables.

### 14.3 Functional requirements

#### Authoring (teacher)
- **FR-PG-01:** Teacher creates **tracks** (e.g., "Python Foundations", "Intro to Machine Learning") with title, description, language, difficulty, ordered lessons.
- **FR-PG-02:** Teacher creates **lessons** under a track with a title, learning objective, and ordered list of steps.
- **FR-PG-03:** Reading steps store Markdown body.
- **FR-PG-04:** Challenge steps store: problem statement (Markdown), starter code, reference solution (hidden from student), test cases (`name`, `input`, `expected_output`, `is_hidden`), grading rule (`exact_match` / `numeric_tolerance` / `function_returns` / `stdout_matches`), max attempts (0 = unlimited), time limit per run.
- **FR-PG-05:** Teacher can preview any step exactly as the student sees it.

#### Solving (student)
- **FR-PG-06:** Student sees `/student/playground` — a track grid showing progress per track (`X / Y lessons completed`).
- **FR-PG-07:** Inside a lesson, a vertical stepper walks through readings and challenges. Progress within a lesson is auto-saved.
- **FR-PG-08:** Challenge view: split-pane (problem on left, Monaco editor on right, console + test results below). "Run" executes against visible tests; "Submit" runs all (incl. hidden) tests and records the attempt.
- **FR-PG-09:** Student gets per-test pass/fail with diff for failed assertions. Hidden tests show only pass/fail, never the input/expected.
- **FR-PG-10:** A challenge is **completed** when all tests pass. Lesson is completed when all challenges in it are completed (readings auto-complete on view + dwell ≥ 10s).
- **FR-PG-11:** "Hint" reveals a teacher-authored hint after N attempts (configurable per challenge).
- **FR-PG-12:** "Reset to starter" with a confirm modal.

#### Progress & telemetry
- **FR-PG-13:** Every Run/Submit writes an `attempt` row: code snapshot, run mode (`run|submit`), test results JSON, runtime ms, error class (`syntax|runtime|timeout|wrong_answer|none`), created_at.
- **FR-PG-14:** Student dashboard shows current streak, total challenges solved, time spent this week, and the next recommended lesson.
- **FR-PG-15:** Teacher `/teacher/playground/progress` shows per-student (single student in this product, but kept multi-tenant): tracks with completion %, lessons broken down by status, last activity, time-on-task, attempts-per-challenge with the latest failing attempt's code preview, struggle-flags (≥ 5 failing submits, or > 30 min on a single challenge).
- **FR-PG-16:** Teacher can leave a per-challenge feedback comment that surfaces inline in the student's editor on next open.

#### Execution model
- **FR-PG-17:** **Python** runs in-browser via [Pyodide](https://pyodide.org/) loaded lazily on first challenge. Stdin/stdout captured into the console panel. Standard library only at launch (no `pip install`).
- **FR-PG-18:** **JavaScript** runs in a sandboxed `Worker` with no DOM access, a wall-clock timeout (default 5 s), and a memory cap. `console.*` proxied to the UI.
- **FR-PG-19:** The grader is a deterministic function in `frontend/src/lib/playground/grade.ts` that runs the user code through the sandbox, captures outputs, and compares against the test definition. Result objects are normalised so the UI doesn't care which engine ran.
- **FR-PG-20:** No teacher-shipped code is executed against the student's machine; reference solutions are server-only and never sent to the student client (RLS enforced on the `solution` column).

### 14.4 Database schema (additions)

```sql
CREATE TABLE pg_tracks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  language     text NOT NULL CHECK (language IN ('python','javascript')),
  difficulty   text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  cover_image_url text,
  position     int NOT NULL DEFAULT 0,
  is_published bool DEFAULT false,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE pg_lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id    uuid NOT NULL REFERENCES pg_tracks(id) ON DELETE CASCADE,
  title       text NOT NULL,
  objective   text,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE pg_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid NOT NULL REFERENCES pg_lessons(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('reading','challenge')),
  position    int NOT NULL DEFAULT 0,
  title       text NOT NULL,

  -- reading
  body        text,

  -- challenge
  starter_code     text,
  solution         text,                      -- teacher-only via RLS
  hint             text,
  hint_after_attempts int DEFAULT 3,
  grading_rule     text CHECK (grading_rule IN ('exact_match','numeric_tolerance','function_returns','stdout_matches')),
  test_cases       jsonb,                     -- [{name, input, expected, is_hidden}]
  max_attempts     int DEFAULT 0,             -- 0 = unlimited
  time_limit_ms    int DEFAULT 5000,

  created_at  timestamptz DEFAULT now()
);

CREATE TABLE pg_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step_id     uuid NOT NULL REFERENCES pg_steps(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','failed')),
  best_code   text,
  completed_at timestamptz,
  time_spent_seconds int DEFAULT 0,
  attempts    int DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, step_id)
);

CREATE TABLE pg_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step_id     uuid NOT NULL REFERENCES pg_steps(id) ON DELETE CASCADE,
  mode        text NOT NULL CHECK (mode IN ('run','submit')),
  code        text NOT NULL,
  results     jsonb,                          -- per-test pass/fail
  error_class text CHECK (error_class IN ('syntax','runtime','timeout','wrong_answer','none')),
  runtime_ms  int,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE pg_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id     uuid NOT NULL REFERENCES pg_steps(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  body        text NOT NULL,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON pg_attempts (user_id, step_id, created_at DESC);
CREATE INDEX ON pg_progress (user_id, status);
```

### 14.5 RLS

| Table | Policy |
|-------|--------|
| `pg_tracks`, `pg_lessons` | Teacher: full CRUD. Student: SELECT where `is_published = true` (tracks). |
| `pg_steps` | Teacher: full CRUD on all columns. Student: SELECT but **never** the `solution` column — enforce via a view `pg_steps_public` that omits `solution`, and grant the student SELECT on the view only. |
| `pg_progress`, `pg_attempts` | Student: SELECT/INSERT/UPDATE rows where `user_id = auth.uid()`. Teacher: SELECT on all rows. |
| `pg_feedback` | Teacher: full CRUD. Student: SELECT where `user_id = auth.uid()`. |

### 14.6 UI / pages

- **`/student/playground`** — Track grid (cover, language badge, X/Y progress, "Resume").
- **`/student/playground/tracks/:id`** — Lesson list with completion state per lesson.
- **`/student/playground/lessons/:id`** — Stepper. Reading and challenge steps share a chrome.
- **`/student/playground/steps/:id`** — Challenge view (split panes, Monaco, console). Mobile collapses to tabs (`Problem | Code | Tests`).
- **`/teacher/playground`** — Tracks CRUD (drag-reorder lessons, drag-reorder steps).
- **`/teacher/playground/edit/:trackId`** — Lesson + step editor, test-case builder, "Preview as student" toggle.
- **`/teacher/playground/progress`** — Per-student dashboard: track-level rings, lesson timeline, struggle-flag list, latest failing-attempt code preview with line numbers and a "Leave feedback" inline action.

### 14.7 Tech additions

| Concern | Choice |
|---------|--------|
| **Code editor** | `@monaco-editor/react` (themed to match the platform's `#00193c` primary) |
| **Python runtime** | Pyodide via CDN, lazy-loaded on first challenge in a track |
| **JS runtime** | Sandboxed `Worker` with `postMessage` protocol, AbortController for timeouts |
| **Markdown** | `react-markdown` + `remark-gfm` (already a tiny dep) |
| **Diff for failing tests** | `diff` package, side-by-side view |
| **Activity tracking** | Heartbeat every 15 s while a step is open accumulates `time_spent_seconds` |

### 14.8 Notifications

- `pg_step_completed` → teacher (so they know the student finished something).
- `pg_struggle_flag` → teacher (when a student crosses the struggle threshold).
- `pg_feedback_left` → student (inline + bell).

### 14.9 Open decisions (call these out before implementing)

1. **Track seeding.** Do we hand-author the first 2–3 tracks ("Python Foundations" + "Intro to ML") together, or import an existing open-licensed curriculum (e.g. CS50 / The Odin Project) and adapt? *Recommendation:* hand-author the first track to set the tone, then import for breadth.
2. **C++/Java in v2.** Will require a remote sandbox (Judge0 self-host on a tiny VPS, or paid Judge0 API at ~$10/mo). Decide whether to lock v1 to Python+JS and table this for v2.
3. **AI explainer for failing tests.** A "Why did this fail?" button that calls the Anthropic API with the user's code + the failing test, and returns a Socratic hint (not the answer). Off by default, gated by a teacher toggle on each challenge — keeps the cost predictable and prevents shortcut-seeking.
4. **Streaks vs. mastery.** Streaks gamify daily habit but can pressure the student. Recommend showing both ("3-day streak 🔥" + "Mastery: 12 challenges solved") and let teacher hide the streak per-student in Settings.

### 14.10 Milestones

| Phase | Deliverable | Estimate |
|-------|-------------|----------|
| **PG-1** | Schema + RLS + teacher track/lesson/step CRUD | 4–5 days |
| **PG-2** | Student stepper + reading view + Monaco wired in | 3 days |
| **PG-3** | Pyodide integration + grader for `exact_match` and `function_returns` | 3 days |
| **PG-4** | JS worker sandbox + remaining grading rules | 2 days |
| **PG-5** | Attempt logging + student dashboard widgets | 2 days |
| **PG-6** | Teacher progress dashboard + struggle-flags + feedback | 3 days |
| **PG-7** | Polish, mobile pass, hint reveal, notifications | 2 days |
| **Total** | | **~3 weeks** |

### 14.11 Combined v1.1 milestones

| Phase | Deliverable | Estimate |
|-------|-------------|----------|
| **F-1** | Feed schema + RLS + sources CRUD + student feed UI | 3 days |
| **F-2** | `ingest_feeds` Edge Function: RSS parsing, image extraction + proxying, dedup | 3 days |
| **F-3** | Simplifier LLM call + cron schedule + manual refresh button | 2 days |
| **F-4** | Reactions, saved, hide/pin actions, notifications, engagement widget | 2 days |
| **PG-1 – PG-7** | (above) | 3 weeks |
| **Total v1.1** | | **~5 weeks** |

---

*End of Document*

*This PRD is a living document and should be updated as requirements evolve.*
