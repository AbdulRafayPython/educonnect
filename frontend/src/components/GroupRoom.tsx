import { useEffect, useMemo, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  CHAT_EMOJIS,
  fetchRoomMembers,
  fetchOneMember,
  fetchRoomMessages,
  fetchRoomReactions,
  sendRoomMessage,
  toggleRoomReaction,
  groupReactions,
  type RoomMessage,
  type RoomReaction,
  type ChatParticipant,
} from '../lib/chat';

interface GroupRoomProps {
  me: ChatParticipant;
}

function initialsOf(name?: string | null): string {
  return name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
}

// A stable, pleasant colour per sender so names/avatars are easy to tell apart.
const NAME_COLORS = ['#F97316', '#34D399', '#A78BFA', '#22D3EE', '#F472B6', '#FBBF24', '#60A5FA', '#F87171'];
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

function Avatar({ p, size = 'sm' }: { p: ChatParticipant; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const isTeacher = p.role === 'teacher';
  const cls = size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-[0.6rem]';
  const showImg = !!p.avatar_url && !failed;
  const inner = showImg ? (
    <img
      src={p.avatar_url!}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${cls} rounded-xl object-cover`}
    />
  ) : (
    <div
      className={`${cls} rounded-xl flex items-center justify-center text-white font-bold ${isTeacher ? 'academic-gradient' : ''}`}
      style={{ background: isTeacher ? undefined : colorFor(p.id) }}
    >
      {initialsOf(p.full_name)}
    </div>
  );
  // A small school-crest dot marks the teacher's avatar everywhere it appears.
  return (
    <div className="relative shrink-0">
      {inner}
      {isTeacher && (
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary border-2 border-surface-container-lowest flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary" style={{ fontSize: '0.55rem' }}>school</span>
        </span>
      )}
    </div>
  );
}

// Inline "Teacher" pill used beside the teacher's name. Uses primary/on-primary
// (not the fixed-navy academic-gradient) so it stays high-contrast in dark mode.
function TeacherTag() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[0.55rem] font-bold uppercase tracking-wider leading-none shrink-0">
      <span className="material-symbols-outlined" style={{ fontSize: '0.6rem' }}>school</span>
      Teacher
    </span>
  );
}

export default function GroupRoom({ me }: GroupRoomProps) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [reactions, setReactions] = useState<RoomReaction[]>([]);
  const [members, setMembers] = useState<Record<string, ChatParticipant>>({});
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [showRoster, setShowRoster] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef<Record<string, ChatParticipant>>({});

  const addMember = (p: ChatParticipant) => {
    membersRef.current = { ...membersRef.current, [p.id]: p };
    setMembers(membersRef.current);
  };

  const who = (id: string): ChatParticipant =>
    membersRef.current[id] ?? members[id] ?? { id, full_name: 'Member', email: null, avatar_url: null, role: 'student_group' };

  // Roster: teacher(s) first, then students alphabetically by name.
  const memberList = useMemo(() => {
    return Object.values(members).sort((a, b) => {
      if (a.role === 'teacher' && b.role !== 'teacher') return -1;
      if (b.role === 'teacher' && a.role !== 'teacher') return 1;
      return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '');
    });
  }, [members]);

  const teacher = useMemo(() => memberList.find((m) => m.role === 'teacher') ?? null, [memberList]);

  const byId = useMemo(() => {
    const m = new Map<string, RoomMessage>();
    for (const msg of messages) m.set(msg.id, msg);
    return m;
  }, [messages]);

  const reactionsByMsg = useMemo(() => {
    const m: Record<string, RoomReaction[]> = {};
    for (const r of reactions) (m[r.message_id] ??= []).push(r);
    return m;
  }, [reactions]);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [mem, msgs, reacts] = await Promise.all([
          fetchRoomMembers(),
          fetchRoomMessages(),
          fetchRoomReactions(),
        ]);
        if (!active) return;
        const map: Record<string, ChatParticipant> = {};
        for (const p of mem) map[p.id] = p;
        membersRef.current = map;
        setMembers(map);
        setMemberCount(mem.length);
        setMessages(msgs);
        setReactions(reacts);
        setLoading(false);
        scrollToBottom(false);
      } catch (e) {
        if (active) { setError((e as Error).message); setLoading(false); }
      }
    })();

    const channel = supabase
      .channel('masterclass-room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'masterclass_room_messages' }, (payload) => {
        const msg = payload.new as RoomMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (!membersRef.current[msg.sender_id]) {
          fetchOneMember(msg.sender_id).then((p) => { if (p) addMember(p); });
        }
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'masterclass_room_messages' }, (payload) => {
        const msg = payload.new as RoomMessage;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'masterclass_room_reactions' }, (payload) => {
        const r = payload.new as RoomReaction;
        setReactions((prev) => [
          ...prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)),
          r,
        ]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'masterclass_room_reactions' }, (payload) => {
        const old = payload.old as Partial<RoomReaction>;
        if (!old.id) return;
        setReactions((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const reply = replyTo?.id ?? null;
    try {
      const msg = await sendRoomMessage(me.id, body, reply);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft('');
      setReplyTo(null);
      scrollToBottom();
    } catch (e) {
      setError((e as Error).message || 'Could not send. Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    const mine = (reactionsByMsg[messageId] ?? []).some((r) => r.user_id === me.id && r.emoji === emoji);
    if (mine) {
      setReactions((prev) => prev.filter((r) => !(r.message_id === messageId && r.user_id === me.id && r.emoji === emoji)));
    } else {
      setReactions((prev) => [
        ...prev,
        { id: `tmp-${messageId}-${emoji}-${me.id}`, message_id: messageId, user_id: me.id, emoji, created_at: new Date().toISOString() },
      ]);
    }
    setActiveMsg(null);
    try {
      await toggleRoomReaction(messageId, me.id, emoji, mine);
    } catch {
      fetchRoomReactions().then(setReactions).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header — tap to open the members roster */}
      <button
        type="button"
        onClick={() => setShowRoster(true)}
        className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-outline-variant/20 bg-surface-container-lowest shrink-0 text-left hover:bg-surface-container/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl academic-gradient flex items-center justify-center text-white shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>groups</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-on-surface truncate">Masterclass Group Room</p>
          <p className="text-[0.7rem] text-on-surface-variant truncate">
            {memberCount} member{memberCount === 1 ? '' : 's'}
            {teacher && <> · Led by <span className="font-bold text-primary">{teacher.full_name || 'Teacher'}</span></>}
          </p>
        </div>
        {/* Avatar stack preview */}
        <div className="hidden sm:flex items-center -space-x-2 shrink-0">
          {memberList.slice(0, 4).map((p) => (
            <div key={p.id} className="ring-2 ring-surface-container-lowest rounded-xl">
              <Avatar p={p} />
            </div>
          ))}
          {memberCount > 4 && (
            <span className="w-7 h-7 rounded-xl bg-surface-container flex items-center justify-center text-[0.6rem] font-bold text-on-surface-variant ring-2 ring-surface-container-lowest">
              +{memberCount - 4}
            </span>
          )}
        </div>
        <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{ fontSize: '1.2rem' }}>chevron_right</span>
      </button>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 space-y-1.5 bg-background">
        {loading ? (
          <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">Loading room…</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="material-symbols-outlined text-5xl text-outline/30">groups</span>
            <p className="text-on-surface-variant text-sm font-medium">Welcome to the group room! Be the first to say hi 👋</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === me.id;
            const sender = who(m.sender_id);
            const prev = messages[i - 1];
            const showDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
            const grouped = !showDay && prev && prev.sender_id === m.sender_id;
            const repliedTo = m.reply_to ? byId.get(m.reply_to) : null;
            const groups = groupReactions(reactionsByMsg[m.id] ?? []);
            const isActive = activeMsg === m.id;

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-4">
                    <span className="px-3 py-1 rounded-full bg-surface-container text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">
                      {format(new Date(m.created_at), 'EEEE, MMM d')}
                    </span>
                  </div>
                )}
                <div className={`flex items-start gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                  <div className="w-7 shrink-0">
                    {!mine && !grouped && <Avatar p={sender} />}
                  </div>

                  <div className={`group relative max-w-[78%] sm:max-w-[68%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {/* Sender name + role (incoming, once per group) */}
                    {!mine && !grouped && (
                      <span className="flex items-center gap-1.5 mb-1 px-1">
                        <span
                          className={`text-[0.7rem] font-bold leading-none ${sender.role === 'teacher' ? 'text-on-surface' : ''}`}
                          style={{ color: sender.role === 'teacher' ? undefined : colorFor(sender.id) }}
                        >
                          {sender.full_name || sender.email || 'Member'}
                        </span>
                        {sender.role === 'teacher' && <TeacherTag />}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveMsg(isActive ? null : m.id)}
                      className={`text-left rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap transition-shadow ${
                        mine ? 'academic-gradient text-white rounded-br-md' : 'bg-surface-container text-on-surface rounded-bl-md'
                      } ${isActive ? 'shadow-md' : ''}`}
                    >
                      {repliedTo && (
                        <span className={`block mb-1.5 pl-2 border-l-2 text-xs rounded ${mine ? 'border-white/50 text-white/80' : 'border-primary/40 text-on-surface-variant'}`}>
                          <span className="font-bold">{repliedTo.sender_id === me.id ? 'You' : (who(repliedTo.sender_id).full_name || 'Reply')}</span>
                          <span className="block truncate max-w-[200px] opacity-90">{repliedTo.deleted_at ? 'Message deleted' : repliedTo.body}</span>
                        </span>
                      )}
                      {m.deleted_at ? <span className="italic opacity-60">Message deleted</span> : m.body}
                    </button>

                    {Object.keys(groups).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(groups).map(([emoji, users]) => {
                          const reactedByMe = users.includes(me.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReact(m.id, emoji)}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                reactedByMe ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-bold">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <span className={`text-[0.6rem] text-on-surface-variant/60 mt-0.5 px-1 ${mine ? 'text-right' : 'text-left'}`}>
                      {format(new Date(m.created_at), 'h:mm a')}
                    </span>

                    {isActive && !m.deleted_at && (
                      <div className={`absolute -top-9 z-10 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-surface-container-lowest shadow-lg border border-outline-variant/20 ${mine ? 'right-0' : 'left-0'}`}>
                        {CHAT_EMOJIS.map((e) => (
                          <button key={e} onClick={() => handleReact(m.id, e)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-base leading-none">
                            {e}
                          </button>
                        ))}
                        <span className="w-px h-5 bg-outline-variant/40 mx-0.5" />
                        <button onClick={() => { setReplyTo(m); setActiveMsg(null); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant" title="Reply">
                          <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>reply</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container border-t border-outline-variant/20 shrink-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.1rem' }}>reply</span>
          <div className="flex-1 min-w-0 border-l-2 border-primary/40 pl-2">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">
              Replying to {replyTo.sender_id === me.id ? 'yourself' : (who(replyTo.sender_id).full_name || 'message')}
            </p>
            <p className="text-xs text-on-surface-variant truncate">{replyTo.body}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>close</span>
          </button>
        </div>
      )}

      {error && <div className="px-4 py-2 bg-error-container text-on-error-container text-xs font-medium shrink-0">{error}</div>}

      {/* Composer */}
      <div className="flex items-end gap-2 px-3 sm:px-4 py-3 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          rows={1}
          placeholder="Message the group…"
          className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="w-11 h-11 shrink-0 rounded-2xl academic-gradient text-white flex items-center justify-center shadow-md hover:opacity-90 transition-all disabled:opacity-40"
          aria-label="Send message"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{sending ? 'hourglass_empty' : 'send'}</span>
        </button>
      </div>

      {/* Members roster */}
      {showRoster && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:px-4" onClick={() => setShowRoster(false)}>
          <div className="bg-surface-container-lowest w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15 shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-primary">Members</h3>
                <p className="text-xs text-on-surface-variant">{memberCount} in this room</p>
              </div>
              <button onClick={() => setShowRoster(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {memberList.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar p={p} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-on-surface truncate flex items-center gap-1.5">
                      {p.full_name || 'Member'}
                      {p.id === me.id && <span className="text-[0.6rem] font-bold text-on-surface-variant">(You)</span>}
                    </p>
                    <p className="text-[0.65rem] text-on-surface-variant truncate">
                      {p.role === 'teacher' ? 'Class teacher' : 'Masterclass student'}
                    </p>
                  </div>
                  {p.role === 'teacher' ? (
                    <TeacherTag />
                  ) : (
                    <span className="text-[0.6rem] font-bold uppercase tracking-wider text-secondary/60">Student</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
