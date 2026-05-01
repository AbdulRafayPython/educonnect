# EduConnect

A private online teaching platform built with **React + Vite + TypeScript**, **Tailwind CSS v4**, and **Supabase**.

---

## Quick Start

### 1. Add your Supabase credentials

Open `frontend/.env` and fill in the anon key:

```env
VITE_SUPABASE_URL=https://vltjeudovblmekxlbbgc.supabase.co
VITE_SUPABASE_ANON_KEY=<paste your anon key here>
```

Get these from → **[Supabase Dashboard → API Settings](https://supabase.com/dashboard/project/vltjeudovblmekxlbbgc/settings/api)**

### 2. Push the database schema

```bash
# from the project root (EuConnect/)
npx supabase login
npx supabase link --project-ref vltjeudovblmekxlbbgc
npx supabase db push
```

### 3. Create the first user (Teacher)

Since public signup is disabled, create the teacher account via:
- **Supabase Dashboard → Authentication → Add User**, OR
- Run in Supabase SQL editor:

```sql
-- After Auth user is created, insert their profile
INSERT INTO profiles (id, role, full_name, email)
VALUES ('<auth-user-uuid>', 'teacher', 'Dr. Aris', 'teacher@school.edu');
```

### 4. Run the dev server

```bash
cd frontend
npm run dev
```

App runs at **http://localhost:5173**

---

## Routes

| Path | Description |
|---|---|
| `/login` | Login page |
| `/teacher/dashboard` | Teacher dashboard |
| `/student/dashboard` | Student dashboard |

---

## Project Structure

```
EuConnect/
├── frontend/                # Vite React app
│   ├── src/
│   │   ├── components/      # Shared components (Sidebar, TopBar, DashboardLayout)
│   │   ├── lib/             # supabase.ts client
│   │   ├── pages/           # Login, TeacherDashboard, StudentDashboard
│   │   └── store/           # Zustand state (useAppStore)
│   └── .env                 # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
└── supabase/
    └── migrations/          # Initial schema SQL
```

---

## Design System — "Academy Blueprint"

| Token | Value |
|---|---|
| Primary | `#00193c` (Navy) |
| Surface | `#f8f9fa` (Off-white) |
| Font | Public Sans |
| Shape | Rounded-2xl surfaces, pill stats |
