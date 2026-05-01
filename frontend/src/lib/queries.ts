import { supabase } from './supabase';

export const qk = {
  documents: ['documents'] as const,
  sessions: ['sessions'] as const,
  quizzes: ['quizzes'] as const,
  courses: ['courses'] as const,
  coursesActive: ['courses', 'active'] as const,
  notifications: ['notifications'] as const,
};

export async function fetchDocuments() {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('scheduled_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchQuizzes() {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourses() {
  const { data, error } = await supabase.from('courses').select('id, title');
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title')
    .eq('is_archived', false);
  if (error) throw error;
  return data ?? [];
}
