-- EduConnect: track who submitted a quiz, when, and the original filename.
-- The platform is 1-teacher / 1-student so a single submission per quiz row is fine,
-- but the teacher still needs to see student identity, original filename, and timestamp.

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_filename text;
