-- EduConnect: let chat participants see each other's *display* identity.
--
-- profiles RLS only lets a user read their own row (+ the teacher reads all), so
-- a student_group learner couldn't see other members' names/avatars in the group
-- room, nor the teacher's name/avatar in their 1:1 DM. This RPC exposes only the
-- non-sensitive display fields (id, full_name, avatar_url, role — deliberately
-- NO email, since Mode B users are minors) to the people allowed to see them:
--   • the teacher is always visible (everyone has a 1:1 thread with them);
--   • all masterclass (student_group) members are visible to one another and to
--     the teacher — i.e. only to callers who are themselves room members.
-- A Mode A private `student` therefore sees only the teacher, never other kids.
CREATE OR REPLACE FUNCTION public.get_chat_profiles()
RETURNS TABLE (id uuid, full_name text, avatar_url text, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.role
  FROM profiles p
  WHERE p.role = 'teacher'
     OR (public.is_masterclass_member(auth.uid()) AND p.role = 'student_group');
$$;

REVOKE ALL ON FUNCTION public.get_chat_profiles() FROM public;
GRANT EXECUTE ON FUNCTION public.get_chat_profiles() TO authenticated;
