-- EduConnect: a single shared AI-Masterclass group room — every student_group
-- learner (all cohorts) + the teacher chat together in one feed. Distinct from
-- the 1:1 teacher↔student DMs in 20260617000001_chat_and_timezone.sql.

-- Membership helper: the teacher and any Mode B (student_group) learner. Mode A
-- private students are deliberately excluded. SECURITY DEFINER so it ignores the
-- caller's RLS on profiles (mirrors is_teacher()).
CREATE OR REPLACE FUNCTION public.is_masterclass_member(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role IN ('teacher', 'student_group')
  );
$$;

REVOKE ALL ON FUNCTION public.is_masterclass_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_masterclass_member(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS masterclass_room_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  reply_to    uuid REFERENCES masterclass_room_messages(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE IF NOT EXISTS masterclass_room_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES masterclass_room_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_mc_room_messages_created ON masterclass_room_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_mc_room_reactions_message ON masterclass_room_reactions (message_id);

ALTER TABLE masterclass_room_messages  REPLICA IDENTITY FULL;
ALTER TABLE masterclass_room_reactions REPLICA IDENTITY FULL;

ALTER TABLE masterclass_room_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE masterclass_room_reactions ENABLE ROW LEVEL SECURITY;

-- Any member can read the room.
CREATE POLICY "mc_room_msg_select" ON masterclass_room_messages FOR SELECT
  USING (public.is_masterclass_member(auth.uid()));

-- A member posts only as themselves.
CREATE POLICY "mc_room_msg_insert" ON masterclass_room_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_masterclass_member(auth.uid()));

-- Authors may soft-delete their own messages.
CREATE POLICY "mc_room_msg_update_own" ON masterclass_room_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "mc_room_react_select" ON masterclass_room_reactions FOR SELECT
  USING (public.is_masterclass_member(auth.uid()));

CREATE POLICY "mc_room_react_insert" ON masterclass_room_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_masterclass_member(auth.uid()));

CREATE POLICY "mc_room_react_delete_own" ON masterclass_room_reactions FOR DELETE
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='masterclass_room_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE masterclass_room_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='masterclass_room_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE masterclass_room_reactions;
  END IF;
END $$;
