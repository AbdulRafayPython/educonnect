// Real-time 1:1 chat (teacher ↔ each student). One conversation per student;
// the teacher gets an inbox of all of them. See migration
// 20260617000001_chat_and_timezone.sql for the data model + RLS.
import { supabase } from './supabase';

// The fixed reaction palette. Kept small + universal so the picker stays a
// single tap and renders identically across platforms.
export const CHAT_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '😢'] as const;
export type ChatEmoji = (typeof CHAT_EMOJIS)[number];

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  student_id: string;
  created_at: string;
  last_message_at: string;
  last_message_text: string | null;
  last_sender_id: string | null;
  student_unread: number;
  teacher_unread: number;
}

export interface ChatParticipant {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
}

// A conversation joined with the student's profile, for the teacher's inbox.
export interface InboxConversation extends ChatConversation {
  student: ChatParticipant | null;
}

// ── Conversation lifecycle ───────────────────────────────────────────────────

// Find-or-create the conversation. Teacher passes the target student id; a
// student's own id is forced server-side, so the arg is ignored for them.
export async function openConversation(studentId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_conversation', {
    p_student_id: studentId ?? null,
  });
  if (error) throw error;
  return data as string;
}

// Clear *my* unread counter on a conversation (read receipt).
export async function markConversationRead(conversationId: string): Promise<void> {
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

// Teacher inbox: every conversation + the student profile, newest activity first.
export async function fetchInbox(): Promise<InboxConversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*, student:profiles!chat_conversations_student_id_fkey(id, full_name, email, avatar_url, role)')
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return (data as InboxConversation[]) ?? [];
}

// ── Messages + reactions ─────────────────────────────────────────────────────

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as ChatMessage[]) ?? [];
}

// All reactions for a conversation, via an inner join on the parent message so
// we never have to enumerate message ids client-side.
export async function fetchReactions(conversationId: string): Promise<ChatReaction[]> {
  const { data, error } = await supabase
    .from('chat_reactions')
    .select('*, chat_messages!inner(conversation_id)')
    .eq('chat_messages.conversation_id', conversationId);
  if (error) throw error;
  // Strip the embedded join object; callers only need the reaction columns.
  return ((data as (ChatReaction & { chat_messages?: unknown })[]) ?? []).map(
    ({ chat_messages: _join, ...r }) => r,
  );
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  replyTo?: string | null,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body, reply_to: replyTo ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

// Toggle a reaction: if the user already reacted with this emoji, remove it;
// otherwise add it. Returns the new state (true = now reacting).
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
  alreadyReacting: boolean,
): Promise<boolean> {
  if (alreadyReacting) {
    const { error } = await supabase
      .from('chat_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('chat_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  // Ignore a unique-violation race (already reacted) — treat as success.
  if (error && error.code !== '23505') throw error;
  return true;
}

// Soft-delete one of my own messages.
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), body: '' })
    .eq('id', messageId);
  if (error) throw error;
}

// Group reactions by emoji → list of user ids that reacted with it.
export function groupReactions(reactions: { emoji: string; user_id: string }[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const r of reactions) {
    (map[r.emoji] ??= []).push(r.user_id);
  }
  return map;
}

// ── Masterclass group room ───────────────────────────────────────────────────
// One shared room for every student_group learner + the teacher (all cohorts).
// See migration 20260617000002_masterclass_room.sql.

export interface RoomMessage {
  id: string;
  sender_id: string;
  body: string;
  reply_to: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface RoomReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// Shape returned by the get_chat_profiles() RPC (no email by design).
interface ChatProfileRow { id: string; full_name: string | null; avatar_url: string | null; role: string | null }

const toParticipant = (r: ChatProfileRow): ChatParticipant => ({
  id: r.id,
  full_name: r.full_name,
  email: null,
  avatar_url: r.avatar_url,
  role: r.role,
});

// All chat profiles the caller may see (teacher + — for room members — every
// masterclass student). Goes through the SECURITY DEFINER RPC so it works
// despite the restrictive profiles RLS. Used for the group-room roster and to
// resolve each message's sender identity without an N+1 lookup.
export async function fetchRoomMembers(): Promise<ChatParticipant[]> {
  const { data, error } = await supabase.rpc('get_chat_profiles');
  if (error) throw error;
  return ((data as ChatProfileRow[]) ?? []).map(toParticipant);
}

export async function fetchOneMember(userId: string): Promise<ChatParticipant | null> {
  const all = await fetchRoomMembers();
  return all.find((p) => p.id === userId) ?? null;
}

// The teacher's display profile, for a student's 1:1 DM header (students can't
// read the teacher's profiles row directly under RLS).
export async function fetchTeacherProfile(): Promise<ChatParticipant | null> {
  const { data, error } = await supabase.rpc('get_chat_profiles');
  if (error) throw error;
  const t = ((data as ChatProfileRow[]) ?? []).find((r) => r.role === 'teacher');
  return t ? toParticipant(t) : null;
}

export async function fetchRoomMessages(): Promise<RoomMessage[]> {
  const { data, error } = await supabase
    .from('masterclass_room_messages')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as RoomMessage[]) ?? [];
}

export async function fetchRoomReactions(): Promise<RoomReaction[]> {
  const { data, error } = await supabase.from('masterclass_room_reactions').select('*');
  if (error) throw error;
  return (data as RoomReaction[]) ?? [];
}

export async function sendRoomMessage(
  senderId: string,
  body: string,
  replyTo?: string | null,
): Promise<RoomMessage> {
  const { data, error } = await supabase
    .from('masterclass_room_messages')
    .insert({ sender_id: senderId, body, reply_to: replyTo ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as RoomMessage;
}

export async function toggleRoomReaction(
  messageId: string,
  userId: string,
  emoji: string,
  alreadyReacting: boolean,
): Promise<boolean> {
  if (alreadyReacting) {
    const { error } = await supabase
      .from('masterclass_room_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('masterclass_room_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error && error.code !== '23505') throw error;
  return true;
}
