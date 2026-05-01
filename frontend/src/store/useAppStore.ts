import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface AppState {
  user: User | null;
  profile: any | null; // Replace any with generated Database type later
  role: 'teacher' | 'student' | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: any | null) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile, role: profile?.role || null }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
