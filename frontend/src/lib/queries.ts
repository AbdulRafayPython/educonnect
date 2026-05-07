import { supabase } from './supabase';

export const qk = {
  documents: ['documents'] as const,
  sessions: ['sessions'] as const,
  quizzes: ['quizzes'] as const,
  courses: ['courses'] as const,
  coursesActive: ['courses', 'active'] as const,
  notifications: ['notifications'] as const,
  slides: ['slides'] as const,
  feedItems: ['feed', 'items'] as const,
  feedItem: (id: string) => ['feed', 'item', id] as const,
  feedSaved: (userId: string) => ['feed', 'saved', userId] as const,
  feedInteractions: (userId: string) => ['feed', 'interactions', userId] as const,
  feedSources: ['feed', 'sources'] as const,
  feedItemsAdmin: ['feed', 'items', 'admin'] as const,
  feedEngagement: (itemId: string) => ['feed', 'engagement', itemId] as const,
};

export interface FeedItem {
  id: string;
  type: 'news' | 'concept';
  status: 'published' | 'hidden' | 'archived' | 'draft';
  difficulty: 'foundations' | 'core' | 'advanced' | null;
  title: string;
  summary: string;
  body: string | null;
  cover_image_url: string | null;
  cover_image_url_original: string | null;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  published_at: string;
  pinned_until: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FeedSource {
  id: string;
  name: string;
  rss_url: string;
  is_active: boolean;
  brand_color: string | null;
  last_fetched_at: string | null;
  consecutive_failures: number;
  created_at: string;
}

export interface FeedInteraction {
  id: string;
  item_id: string;
  user_id: string;
  is_read: boolean;
  is_saved: boolean;
  reaction: 'like' | 'curious' | 'mind_blown' | null;
  read_at: string | null;
  updated_at: string;
}

export async function fetchFeedItems() {
  const { data, error } = await supabase
    .from('feed_items')
    .select('*')
    .eq('status', 'published')
    .order('pinned_until', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as FeedItem[];
}

export async function fetchFeedItem(id: string) {
  const { data, error } = await supabase
    .from('feed_items')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as FeedItem;
}

export async function fetchMyFeedInteractions(userId: string) {
  const { data, error } = await supabase
    .from('feed_interactions')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as FeedInteraction[];
}

export async function fetchSavedFeedItems(userId: string) {
  const { data, error } = await supabase
    .from('feed_interactions')
    .select('item_id, feed_items(*)')
    .eq('user_id', userId)
    .eq('is_saved', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? [])
    .map((row: any) => row.feed_items)
    .filter(Boolean)) as FeedItem[];
}

export async function fetchFeedSources() {
  const { data, error } = await supabase
    .from('feed_sources')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as FeedSource[];
}

export async function fetchAllFeedItemsAdmin() {
  const { data, error } = await supabase
    .from('feed_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as FeedItem[];
}

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

export async function fetchSlides() {
  const { data, error } = await supabase
    .from('slides')
    .select('*')
    .order('created_at', { ascending: false });
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
