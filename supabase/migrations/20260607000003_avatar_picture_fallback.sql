-- Harden the Google sign-up trigger: capture the profile photo whether Google
-- supplies it under the `avatar_url` or the raw `picture` claim (Supabase does
-- not always normalise `picture` -> `avatar_url`). Accounts with no photo stay
-- null, as expected. CREATE OR REPLACE preserves the existing REVOKE grants.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_app_meta_data->>'provider') = 'google'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (
      id, role, full_name, email, avatar_url, google_id,
      onboarding_complete, email_notifications
    ) VALUES (
      NEW.id,
      'student_group',
      COALESCE(NEW.raw_user_meta_data->>'full_name',
               NEW.raw_user_meta_data->>'name',
               split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'avatar_url',
               NEW.raw_user_meta_data->>'picture'),
      NEW.raw_user_meta_data->>'sub',
      false,
      true
    );
  END IF;
  RETURN NEW;
END;
$$;
