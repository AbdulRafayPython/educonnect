import { useEffect, useMemo, useRef, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  CHAT_EMOJIS,
  fetchMessages,
  fetchReactions,
  sendMessage,
  toggleReaction,
  markConversationRead,
  groupReactions,
  type ChatMessage,
  type ChatReaction,
  type ChatParticipant,
} from '../lib/chat';

interface ChatThreadProps {
  conversationId: string;
  // The current signed-in user (for bubble alignment + reaction ownership).
  me: ChatParticipant;
  // The other side of the 1:1 thread (student for the teacher, teacher for a student).
  other: ChatParticipant;
}

function initialsOf(name?: string | null): string {
  return name ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';
}

function Avatar({ p, size = 'sm' }: { p: ChatParticipant; size?: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const cls = size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-[0.65rem]';
  return p.avatar_url && !failed ? (
    <img
      src={p.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${cls} rounded-xl object-cover shrink-0`}
    />
  ) : (
    <div className={`${cls} rounded-xl academic-gradient flex items-center justify-center text-white font-bold shrink-0`}>
      {initialsOf(p.full_name)}
    </div>
  );
}

export default function ChatThread({ conversationId, me, other }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ChatReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Live ref to message ids so the reactions realtime handler (which can't filter
  // by conversation server-side) can cheaply decide what belongs to this thread.
  const msgIdsRef = useRef<Set<string>>(new Set());

  const byId = useMemo(() => {
    const m = new Map<string, ChatMessage>();
    for (const msg of messages) m.set(msg.id, msg);
    return m;
  }, [messages]);

  const reactionsByMsg = useMemo(() => {
    const m: Record<string, ChatReaction[]> = {};
    for (const r of reactions) (m[r.message_id] ??= []).push(r);
    return m;
  }, [reactions]);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    });
  };

  // Load history + subscribe to realtime whenever the conversation changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReplyTo(null);
    setActiveMsg(null);

    (async () => {
      try {
        const [msgs, reacts] = await Promise.all([
          fetchMessages(conversationId),
          fetchReactions(conversationId),
        ]);
        if (!active) return;
        setMessages(msgs);
        msgIdsRef.current = new Set(msgs.map((m) => m.id));
        setReactions(reacts);
        setLoading(false);
        scrollToBottom(false);
        markConversationRead(conversationId);
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev; // dedupe own optimistic insert
          msgIdsRef.current.add(msg.id);
          return [...prev, msg];
        });
        // Someone else's message arriving means I've now "seen" it.
        if (msg.sender_id !== me.id) markConversationRead(conversationId);
        scrollToBottom();
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_reactions',
      }, (payload) => {
        const r = payload.new as ChatReaction;
        if (!msgIdsRef.current.has(r.message_id)) return; // not this thread
        // Replace any optimistic/temp entry (which carries a tmp- id) with the
        // canonical row, deduping by the (message,user,emoji) composite key.
        setReactions((prev) => [
          ...prev.filter((x) => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)),
          r,
        ]);
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'chat_reactions',
      }, (payload) => {
        const old = payload.old as Partial<ChatReaction>;
        if (!old.id) return;
        setReactions((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, me.id]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const reply = replyTo?.id ?? null;
    try {
      const msg = await sendMessage(conversationId, me.id, body, reply);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      msgIdsRef.current.add(msg.id);
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
    const mine = (reactionsByMsg[messageId] ?? []).some(
      (r) => r.user_id === me.id && r.emoji === emoji,
    );
    // Optimistic update; realtime reconciles by id afterwards.
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
      await toggleReaction(messageId, me.id, emoji, mine);
    } catch {
      // Roll back on failure by refetching the canonical set.
      fetchReactions(conversationId).then(setReactions).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-outline-variant/20 bg-surface-container-lowest shrink-0">
        <Avatar p={other} size="md" />
        <div className="min-w-0">
          <p className="font-bold text-sm text-on-surface truncate">{other.full_name || other.email || 'Conversation'}</p>
          <p className="text-[0.65rem] uppercase tracking-widest text-secondary/60 font-bold">
            {other.role === 'teacher' ? 'Teacher' : other.role === 'student_group' ? 'Masterclass' : 'Student'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-4 space-y-1.5 bg-background">
        {loading ? (
          <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="material-symbols-outlined text-5xl text-outline/30">forum</span>
            <p className="text-on-surface-variant text-sm font-medium">No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === me.id;
            const sender = mine ? me : other;
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
                <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                  {/* Avatar gutter (incoming only, once per group) */}
                  <div className="w-7 shrink-0">
                    {!mine && !grouped && <Avatar p={sender} />}
                  </div>

                  <div className={`group relative max-w-[78%] sm:max-w-[68%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {/* Bubble */}
                    <button
                      type="button"
                      onClick={() => setActiveMsg(isActive ? null : m.id)}
                      className={`text-left rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap transition-shadow ${
                        mine
                          ? 'academic-gradient text-white rounded-br-md'
                          : 'bg-surface-container text-on-surface rounded-bl-md'
                      } ${isActive ? 'shadow-md' : ''}`}
                    >
                      {repliedTo && (
                        <span className={`block mb-1.5 pl-2 border-l-2 text-xs rounded ${mine ? 'border-white/50 text-white/80' : 'border-primary/40 text-on-surface-variant'}`}>
                          <span className="font-bold">{repliedTo.sender_id === me.id ? 'You' : (other.full_name || 'Reply')}</span>
                          <span className="block truncate max-w-[200px] opacity-90">{repliedTo.deleted_at ? 'Message deleted' : repliedTo.body}</span>
                        </span>
                      )}
                      {m.deleted_at ? (
                        <span className="italic opacity-60">Message deleted</span>
                      ) : (
                        m.body
                      )}
                    </button>

                    {/* Reaction chips */}
                    {Object.keys(groups).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(groups).map(([emoji, users]) => {
                          const reactedByMe = users.includes(me.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReact(m.id, emoji)}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                reactedByMe
                                  ? 'bg-primary/10 border-primary/30 text-primary'
                                  : 'bg-surface-container-lowest border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-bold">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamp (revealed on group end / hover) */}
                    <span className={`text-[0.6rem] text-on-surface-variant/60 mt-0.5 px-1 ${mine ? 'text-right' : 'text-left'}`}>
                      {format(new Date(m.created_at), 'h:mm a')}
                    </span>

                    {/* Action toolbar (emoji palette + reply), toggled by tapping the bubble */}
                    {isActive && !m.deleted_at && (
                      <div
                        className={`absolute -top-9 z-10 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-surface-container-lowest shadow-lg border border-outline-variant/20 ${mine ? 'right-0' : 'left-0'}`}
                      >
                        {CHAT_EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => handleReact(m.id, e)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-base leading-none"
                          >
                            {e}
                          </button>
                        ))}
                        <span className="w-px h-5 bg-outline-variant/40 mx-0.5" />
                        <button
                          onClick={() => { setReplyTo(m); setActiveMsg(null); }}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant"
                          title="Reply"
                        >
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
              Replying to {replyTo.sender_id === me.id ? 'yourself' : (other.full_name || 'message')}
            </p>
            <p className="text-xs text-on-surface-variant truncate">{replyTo.body}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>close</span>
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-error-container text-on-error-container text-xs font-medium shrink-0">{error}</div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 px-3 sm:px-4 py-3 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="Type a message…"
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
    </div>
  );
}
