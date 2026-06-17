-- EduConnect: 1:1 real-time chat (teacher ↔ each student) + per-user timezone.
--
-- Model: exactly one teacher in this product, so a "conversation" is uniquely
-- identified by the student. The teacher gets an inbox (one row per student);
-- each student gets a single thread with the teacher. Works for both Mode A
-- `student` and Mode B `student_group` learners — the conversation is keyed by
-- the student profile regardless of role.

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-user timezone (IANA name, e.g. 'Asia/Karachi'). Drives the "match my
-- timings" comparison in Settings. NULL = fall back to the browser locale.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  last_message_text text,
  last_sender_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  student_unread    integer NOT NULL DEFAULT 0,
  teacher_unread    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  reply_to        uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE IF NOT EXISTS chat_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON chat_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last ON chat_conversations (last_message_at DESC);

-- Realtime UPDATE/DELETE payloads need the full old row to carry the PK + fields.
ALTER TABLE chat_messages  REPLICA IDENTITY FULL;
ALTER TABLE chat_reactions REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions     ENABLE ROW LEVEL SECURITY;

-- Conversations: a student sees only their own row; the teacher sees all.
-- Rows are created exclusively via open_conversation() (SECURITY DEFINER), so
-- no INSERT policy is granted (deny by default). The summary columns are
-- maintained by the AFTER-INSERT trigger (also SECURITY DEFINER).
CREATE POLICY "chat_conv_select" ON chat_conversations FOR SELECT
  USING (student_id = auth.uid() OR public.is_teacher(auth.uid()));

-- Messages: visible to the conversation's student or the teacher.
CREATE POLICY "chat_msg_select" ON chat_messages FOR SELECT
  USING (
    public.is_teacher(auth.uid())
    OR EXISTS (
      SELECT 1 FROM chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.student_id = auth.uid()
    )
  );

-- A user may only post as themselves, into a conversation they belong to
-- (the teacher may post into any).
CREATE POLICY "chat_msg_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_teacher(auth.uid())
      OR EXISTS (
        SELECT 1 FROM chat_conversations c
        WHERE c.id = conversation_id AND c.student_id = auth.uid()
      )
    )
  );

-- Senders may soft-delete their own messages (sets deleted_at app-side).
CREATE POLICY "chat_msg_update_own" ON chat_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Reactions: same visibility as the underlying message; you manage only yours.
CREATE POLICY "chat_react_select" ON chat_reactions FOR SELECT
  USING (
    public.is_teacher(auth.uid())
    OR EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = chat_reactions.message_id AND c.student_id = auth.uid()
    )
  );

CREATE POLICY "chat_react_insert" ON chat_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_teacher(auth.uid())
      OR EXISTS (
        SELECT 1 FROM chat_messages m
        JOIN chat_conversations c ON c.id = m.conversation_id
        WHERE m.id = message_id AND c.student_id = auth.uid()
      )
    )
  );

CREATE POLICY "chat_react_delete_own" ON chat_reactions FOR DELETE
  USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: keep the conversation summary + unread counters in sync.
-- SECURITY DEFINER so it can write the conversation row regardless of the
-- caller's RLS (clients never UPDATE conversations directly).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION chat_on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
BEGIN
  SELECT student_id INTO v_student FROM chat_conversations WHERE id = NEW.conversation_id;

  UPDATE chat_conversations
  SET
    last_message_at   = NEW.created_at,
    last_message_text = left(NEW.body, 140),
    last_sender_id    = NEW.sender_id,
    -- The student authored it → the teacher has a new unread, and vice-versa.
    teacher_unread    = teacher_unread + (CASE WHEN NEW.sender_id = v_student THEN 1 ELSE 0 END),
    student_unread    = student_unread + (CASE WHEN NEW.sender_id = v_student THEN 0 ELSE 1 END)
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_on_message_insert ON chat_messages;
CREATE TRIGGER trg_chat_on_message_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION chat_on_message_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: find-or-create a conversation. The teacher passes the target student;
-- a student's own id is forced server-side (they can't open someone else's).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION open_conversation(p_student_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_id      uuid;
BEGIN
  IF public.is_teacher(auth.uid()) THEN
    v_student := p_student_id;
  ELSE
    v_student := auth.uid();
  END IF;

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'student id required';
  END IF;

  INSERT INTO chat_conversations (student_id)
  VALUES (v_student)
  ON CONFLICT (student_id) DO UPDATE SET student_id = EXCLUDED.student_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION open_conversation(uuid) FROM public;
GRANT EXECUTE ON FUNCTION open_conversation(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: clear the caller's unread counter on a conversation (read receipt).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
BEGIN
  SELECT student_id INTO v_student FROM chat_conversations WHERE id = p_conversation_id;
  IF v_student IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() = v_student THEN
    UPDATE chat_conversations SET student_unread = 0 WHERE id = p_conversation_id;
  ELSIF public.is_teacher(auth.uid()) THEN
    UPDATE chat_conversations SET teacher_unread = 0 WHERE id = p_conversation_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION mark_conversation_read(uuid) FROM public;
GRANT EXECUTE ON FUNCTION mark_conversation_read(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='chat_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='chat_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
  END IF;
END $$;
