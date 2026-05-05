import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

const PROFILE_CACHE_KEY = 'educonnect:profile-cache';

interface AppState {
  user: User | null;
  profile: any | null; // Replace any with generated Database type later
  role: 'teacher' | 'student' | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: any | null) => void;
  setIsLoading: (isLoading: boolean) => void;
}

// Hydrate profile/role synchronously from localStorage so returning users
// see their dashboard immediately while we revalidate in the background.
const cachedProfile = (() => {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: cachedProfile,
  role: cachedProfile?.role || null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => {
    try {
      if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      // ignore quota / private-mode failures
    }
    set({ profile, role: profile?.role || null });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
}));
