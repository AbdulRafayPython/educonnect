import { supabase } from './supabase';

type NotifType =
  | 'session_new'
  | 'session_updated'
  | 'session_cancelled'
  | 'session_summary'
  | 'document'
  | 'quiz'
  | 'grade'
  | 'announcement'
  | 'submission'
  | 'slide';

async function recipients(target: 'students' | 'teachers'): Promise<string[]> {
  const role = target === 'students' ? 'student' : 'teacher';
  const { data } = await supabase.from('profiles').select('id').eq('role', role);
  return data?.map((r) => r.id) ?? [];
}

export async function notifyStudents(
  type: NotifType,
  title: string,
  body: string,
  related_id?: string,
) {
  const ids = await recipients('students');
  if (ids.length === 0) return;
  await supabase.from('notifications').insert(
    ids.map((recipient_id) => ({ recipient_id, type, title, body, related_id })),
  );
}

export async function notifyTeachers(
  type: NotifType,
  title: string,
  body: string,
  related_id?: string,
) {
  const ids = await recipients('teachers');
  if (ids.length === 0) return;
  await supabase.from('notifications').insert(
    ids.map((recipient_id) => ({ recipient_id, type, title, body, related_id })),
  );
}
