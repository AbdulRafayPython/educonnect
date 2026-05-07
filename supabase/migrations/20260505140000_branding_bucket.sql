-- Public bucket for branding assets used in transactional emails (logo, etc.).
-- Email clients (Gmail, Outlook) cannot reach localhost or signed URLs reliably,
-- so the recovery email loads its logo from this public bucket.

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read; only authenticated teachers can write (admin-only in practice).
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
CREATE POLICY "branding_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_teacher_write" ON storage.objects;
CREATE POLICY "branding_teacher_write"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  )
  WITH CHECK (
    bucket_id = 'branding'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );
