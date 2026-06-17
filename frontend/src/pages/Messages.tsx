import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import DashboardLayout from '../components/DashboardLayout';
import ChatThread from '../components/ChatThread';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { navForRole } from '../lib/nav';
import {
  fetchInbox,
  fetchTeacherProfile,
  openConversation,
  markConversationRead,
  type InboxConversation,
  type ChatParticipant,
} from '../lib/chat';

function initialsOf(name?: string | null): string {
  return name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
}

// ── Teacher view: inbox of student threads + the selected conversation ────────
function TeacherMessages({ me }: { me: ChatParticipant }) {
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [students, setStudents] = useState<ChatParticipant[]>([]);

  const load = async () => {
    try {
      const rows = await fetchInbox();
      setInbox(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('chat-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const selected = useMemo(() => inbox.find((c) => c.id === selectedId) ?? null, [inbox, selectedId]);

  const openThread = (conv: InboxConversation) => {
    setSelectedId(conv.id);
    if (conv.teacher_unread > 0) {
      markConversationRead(conv.id);
      setInbox((prev) => prev.map((c) => (c.id === conv.id ? { ...c, teacher_unread: 0 } : c)));
    }
  };

  const openPicker = async () => {
    setShowPicker(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, role')
      .in('role', ['student', 'student_group'])
      .order('full_name');
    setStudents((data as ChatParticipant[]) ?? []);
  };

  const startWith = async (student: ChatParticipant) => {
    const convId = await openConversation(student.id);
    setShowPicker(false);
    await load();
    setSelectedId(convId);
  };

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-9rem)] rounded-2xl border border-outline-variant/15 overflow-hidden bg-surface-container-lowest grid lg:grid-cols-[340px_1fr]">
      {/* Inbox list */}
      <div className={`flex flex-col min-h-0 border-r border-outline-variant/15 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15 shrink-0">
          <h2 className="font-extrabold text-primary">Messages</h2>
          <button
            onClick={openPicker}
            className="flex items-center gap-1.5 px-3 py-1.5 academic-gradient text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit_square</span>
            New
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">Loading…</div>
          ) : inbox.length === 0 ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              No conversations yet.<br />Tap <span className="font-bold">New</span> to message a student.
            </div>
          ) : (
            inbox.map((c) => (
              <button
                key={c.id}
                onClick={() => openThread(c)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-outline-variant/10 transition-colors ${
                  selectedId === c.id ? 'bg-primary/5' : 'hover:bg-surface-container/50'
                }`}
              >
                {c.student?.avatar_url ? (
                  <img src={c.student.avatar_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl academic-gradient flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {initialsOf(c.student?.full_name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm text-on-surface truncate">{c.student?.full_name || c.student?.email || 'Student'}</p>
                    <span className="text-[0.6rem] text-on-surface-variant/60 shrink-0">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-on-surface-variant truncate">
                      {c.last_sender_id === me.id ? 'You: ' : ''}{c.last_message_text || 'No messages yet'}
                    </p>
                    {c.teacher_unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[0.6rem] font-bold flex items-center justify-center shrink-0">
                        {c.teacher_unread > 9 ? '9+' : c.teacher_unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread pane */}
      <div className={`min-h-0 flex-col ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
        {selected && selected.student ? (
          <div className="flex flex-col h-full min-h-0">
            <button
              onClick={() => setSelectedId(null)}
              className="lg:hidden flex items-center gap-1 px-4 py-2 text-sm font-bold text-primary border-b border-outline-variant/15 shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>
              Inbox
            </button>
            <div className="flex-1 min-h-0">
              <ChatThread conversationId={selected.id} me={me} other={selected.student} />
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex h-full flex-col items-center justify-center text-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-6xl text-outline/20">chat</span>
            <p className="text-sm font-medium">Select a conversation to start chatting.</p>
          </div>
        )}
      </div>

      {/* Student picker */}
      {showPicker && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:px-4" onClick={() => setShowPicker(false)}>
          <div className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[80dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-primary mb-4 shrink-0">New message</h3>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-1">
              {students.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">No students found.</p>
              ) : (
                students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => startWith(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container text-left"
                  >
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg academic-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {initialsOf(s.full_name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{s.full_name || s.email}</p>
                      <p className="text-[0.6rem] uppercase tracking-widest text-secondary/60 font-bold">
                        {s.role === 'student_group' ? 'Masterclass' : 'Student'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Student view: a single thread with the teacher ───────────────────────────
function StudentMessages({ me }: { me: ChatParticipant }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<ChatParticipant | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, convId] = await Promise.all([
          fetchTeacherProfile(),
          openConversation(),
        ]);
        if (!active) return;
        setTeacher(t ?? { id: '', full_name: 'Teacher', email: null, avatar_url: null, role: 'teacher' });
        setConversationId(convId);
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    })();
    return () => { active = false; };
  }, []);

  if (error) {
    return <div className="rounded-2xl border border-outline-variant/15 p-8 text-center text-sm text-on-surface-variant">Couldn’t open chat: {error}</div>;
  }
  if (!conversationId || !teacher) {
    return <div className="h-[calc(100dvh-7.5rem)] rounded-2xl border border-outline-variant/15 flex items-center justify-center text-sm text-on-surface-variant">Loading chat…</div>;
  }

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-9rem)] rounded-2xl border border-outline-variant/15 overflow-hidden bg-surface-container-lowest">
      <ChatThread conversationId={conversationId} me={me} other={teacher} />
    </div>
  );
}

export default function Messages() {
  const { role, user, profile } = useAppStore();
  const nav = navForRole(role);

  const me: ChatParticipant | null = user
    ? {
        id: user.id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: profile?.role ?? role,
      }
    : null;

  return (
    <DashboardLayout title="Messages" navItems={nav}>
      {!me ? (
        <div className="text-center py-20 text-on-surface-variant">Loading…</div>
      ) : role === 'teacher' ? (
        <TeacherMessages me={me} />
      ) : (
        <StudentMessages me={me} />
      )}
    </DashboardLayout>
  );
}
