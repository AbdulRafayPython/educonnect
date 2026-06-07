-- Course cover thumbnails (Mentori UI redesign).
-- A nullable public URL pointing at branding/course-covers/<courseId>.<ext>.
-- We reuse the existing public `branding` bucket (teachers already have a
-- FOR ALL write policy via `branding_teacher_write`), so no new bucket or
-- storage policy is required. When null, the UI renders a category placeholder.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_url text;
