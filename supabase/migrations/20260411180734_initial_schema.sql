-- Initial schema for EduConnect

CREATE TYPE user_role AS ENUM ('teacher', 'student');

CREATE TABLE profiles (
    id uuid references auth.users on delete cascade primary key,
    role text check (role in ('teacher', 'student')),
    full_name text,
    email text,
    avatar_url text,
    created_at timestamptz default now()
);

-- Turn on RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Profiles policies
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Teacher can read all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

CREATE TABLE semesters (
    id uuid primary key default gen_random_uuid(),
    title text,
    start_date date,
    end_date date,
    created_by uuid references profiles(id)
);

ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student read semesters" ON semesters FOR SELECT USING (true);
CREATE POLICY "Teacher all semesters" ON semesters FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

CREATE TABLE courses (
    id uuid primary key default gen_random_uuid(),
    semester_id uuid references semesters(id),
    title text,
    description text,
    total_lectures int,
    completed_lectures int default 0,
    created_by uuid references profiles(id),
    is_archived bool default false,
    created_at timestamptz default now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student read courses" ON courses FOR SELECT USING (true);
CREATE POLICY "Teacher full courses" ON courses FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

CREATE TABLE sessions (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id),
    title text,
    scheduled_at timestamptz,
    duration_min int,
    zoom_link text,
    status text check (status in ('scheduled','in_progress','completed','cancelled')),
    summary text,
    created_by uuid references profiles(id),
    created_at timestamptz default now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student read sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Teacher full sessions" ON sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

CREATE TABLE documents (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id),
    title text,
    file_path text,
    file_type text,
    tag text check (tag in ('notes','reference','assignment','other')),
    uploaded_by uuid references profiles(id),
    created_at timestamptz default now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student read docs" ON documents FOR SELECT USING (true);
CREATE POLICY "Teacher full docs" ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

CREATE TABLE quizzes (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id),
    title text,
    description text,
    file_path text,
    type text check (type in ('quiz','challenge','assignment')),
    due_date timestamptz,
    status text default 'pending',
    submission_path text,
    grade text,
    feedback text,
    created_by uuid references profiles(id),
    created_at timestamptz default now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student read quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Student update quizzes" ON quizzes FOR UPDATE USING (true);
CREATE POLICY "Teacher full quizzes" ON quizzes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

CREATE TABLE notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid references profiles(id),
    type text,
    title text,
    body text,
    is_read bool default false,
    related_id uuid,
    created_at timestamptz default now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own notifications" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "Teacher insert notifications" ON notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);
