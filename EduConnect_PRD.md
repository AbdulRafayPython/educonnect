# Product Requirements Document (PRD)
## EduConnect — Private Online Teaching Platform
**Version:** 1.0  
**Date:** April 11, 2026  
**Author:** Platform Owner (Teacher)  
**Status:** Draft

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

*End of Document*

*This PRD is a living document and should be updated as requirements evolve.*
