import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { formatDistanceToNow } from 'date-fns';
import { navForRole } from '../lib/nav';

interface Notification {
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

export default function Notifications() {
  const { role, user } = useAppStore();
  const nav = navForRole(role);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: '', body: '' });

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const channel = supabase
      .channel(`notifications-realtime-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const sendBroadcast = async () => {
    // Get all students to send the notification to
    const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student');
    if (!students) return;
    const inserts = students.map(s => ({
      recipient_id: s.id,
      type: 'announcement',
      title: broadcast.title,
      body: broadcast.body,
    }));
    await supabase.from('notifications').insert(inserts);
    setShowBroadcast(false);
    setBroadcast({ title: '', body: '' });
    fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <DashboardLayout title="Notifications" navItems={nav}>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Notifications</h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          <div className="flex gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container text-primary text-sm font-bold rounded-xl hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>done_all</span>
                Mark all read
              </button>
            )}
            {role === 'teacher' && (
              <button onClick={() => setShowBroadcast(true)} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>campaign</span>
                Broadcast
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-on-surface-variant">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">notifications_none</span>
            <p className="text-on-surface-variant font-medium">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`rounded-2xl p-5 flex items-start gap-4 cursor-pointer transition-all border ${
                  n.is_read
                    ? 'bg-surface-container-lowest border-outline-variant/10 opacity-70'
                    : 'bg-surface-container-lowest border-primary/20 shadow-sm hover:shadow-md'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.is_read ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{typeIcons[n.type] || 'notifications'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    <h3 className={`font-bold text-sm ${n.is_read ? 'text-on-surface-variant' : 'text-on-surface'}`}>{n.title}</h3>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{n.body}</p>
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50 mt-2">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowBroadcast(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-primary">Broadcast Announcement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Announcement title" value={broadcast.title} onChange={e => setBroadcast(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Message</label>
                <textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-24" placeholder="Your message…" value={broadcast.body} onChange={e => setBroadcast(p => ({ ...p, body: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowBroadcast(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl">Cancel</button>
              <button onClick={sendBroadcast} disabled={!broadcast.title} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
