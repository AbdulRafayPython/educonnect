import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import ThemeToggle from './ThemeToggle';

interface TopBarProps {
  title: string;
  onMenuClick?: () => void;
}

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  session_new: 'event',
  session_updated: 'event_repeat',
  session_cancelled: 'event_busy',
  session_summary: 'description',
  quiz: 'quiz',
  document: 'attach_file',
  grade: 'grade',
  announcement: 'campaign',
  submission: 'assignment_turned_in',
};

export default function TopBar({ title, onMenuClick }: TopBarProps) {
  const navigate = useNavigate();
  const { profile, user, role } = useAppStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (active && data) setNotifs(data);
    };
    load();

    const channel = supabase
      .channel(`notif-bell-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.id}`,
      }, (payload) => {
        setNotifs((prev) => [payload.new as Notif, ...prev].slice(0, 8));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const goToFull = () => {
    setNotifOpen(false);
    // Mode B (student_group) is email-first and has no notifications page yet;
    // send those users to their hub instead of a non-existent guarded route.
    navigate(role === 'teacher' ? '/teacher/notifications' : role === 'student' ? '/student/notifications' : '/masterclass');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-2 px-3 sm:px-6 bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/20 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-container active:bg-surface-container/80 transition-colors text-on-surface-variant -ml-1"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>menu</span>
          </button>
        )}
        <h1 className="text-base font-bold text-on-surface tracking-tight truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <ThemeToggle />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '1.25rem' }}>notifications</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error border-2 border-surface-container-lowest text-[0.6rem] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 sm:mt-2 sm:w-80 top-[calc(env(safe-area-inset-top)+4rem)] sm:top-auto bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-50">
              <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between">
                <span className="font-bold text-sm text-on-surface">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[0.65rem] font-bold text-primary uppercase tracking-wider hover:underline">Mark all read</button>
                )}
              </div>
              <div className="divide-y divide-outline-variant/10 max-h-96 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="px-5 py-10 text-center text-xs text-on-surface-variant">No notifications yet.</div>
                ) : notifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`flex items-start gap-3 px-5 py-3.5 hover:bg-surface-container/50 transition-colors cursor-pointer ${n.is_read ? 'opacity-60' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${n.is_read ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>{typeIcons[n.type] || 'notifications'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug truncate ${n.is_read ? 'text-on-surface-variant' : 'text-on-surface font-bold'}`}>{n.title}</p>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">{n.body}</p>
                      <p className="text-[0.65rem] font-semibold text-secondary/60 uppercase tracking-wider mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-outline-variant/10 text-center">
                <button onClick={goToFull} className="text-xs font-bold text-primary hover:underline">View All Notifications</button>
              </div>
            </div>
          )}
        </div>

        <div
          title={profile?.full_name || 'User'}
          className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-xl"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg academic-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
          )}
          <span className="hidden md:block text-xs font-bold text-on-surface truncate max-w-[120px]">{profile?.full_name || 'User'}</span>
        </div>
      </div>
    </header>
  );
}
