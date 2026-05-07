import { supabase } from './supabase';
import type { FeedInteraction } from './queries';

type Reaction = 'like' | 'curious' | 'mind_blown';

async function upsertInteraction(itemId: string, userId: string, patch: Partial<FeedInteraction>) {
  const { data, error } = await supabase
    .from('feed_interactions')
    .upsert(
      {
        item_id: itemId,
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'item_id,user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as FeedInteraction;
}

export function markRead(itemId: string, userId: string) {
  return upsertInteraction(itemId, userId, { is_read: true, read_at: new Date().toISOString() });
}

export function toggleSave(itemId: string, userId: string, current: boolean) {
  return upsertInteraction(itemId, userId, { is_saved: !current });
}

export function setReaction(itemId: string, userId: string, current: Reaction | null, next: Reaction) {
  // Toggle off if tapping the same reaction
  return upsertInteraction(itemId, userId, { reaction: current === next ? null : next });
}
