-- EduConnect: slides module — animated HTML explainers

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE slides (
    id uuid primary key default gen_random_uuid(),
    course_id uuid references courses(id),
    title text not null,
    description text,
    file_path text not null,
    uploaded_by uuid references profiles(id),
    created_at timestamptz default now()
);

ALTER TABLE slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student read slides" ON slides FOR SELECT USING (true);
CREATE POLICY "Teacher full slides" ON slides FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('slides', 'slides', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read slides"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'slides' AND auth.role() = 'authenticated');

CREATE POLICY "Teacher write slides"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'slides'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
  );

CREATE POLICY "Teacher delete slides"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'slides'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
  );
