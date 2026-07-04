import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, MessageSquare } from 'lucide-react';
import { teamChatService, type TeamMessage } from '../../api/team.api';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { useSocket } from '../../hooks/useSocket';
import { TypingIndicator } from '../common/TypingIndicator';
import { clsx } from 'clsx';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];

interface TeamChatViewProps {
  teamId: string;
  teamName: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

export const TeamChatView = ({ teamId, teamName }: TeamChatViewProps) => {
  const user       = useAppSelector((s) => s.auth.user);
  const { socket } = useSocket();

  const [messages,    setMessages]    = useState<TeamMessage[]>([]);
  const [content,     setContent]     = useState('');
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
  const [showEmoji,   setShowEmoji]   = useState(false);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef  = useRef(false);

  /* ── Fetch history from REST ── */
  const { isLoading } = useQuery({
    queryKey: ['team-chat', teamId],
    queryFn: () =>
      teamChatService.getMessages(teamId).then((r: any) => {
        const msgs: TeamMessage[] = r.data?.data ?? r.data ?? [];
        setMessages(msgs);
        return msgs;
      }),
    staleTime: Infinity,
  });

  /* ── Socket room join/leave + reconnect re-join ── */
  useEffect(() => {
    if (!socket || !teamId) return;

    socket.emit('team-chat:join', teamId);

    // Re-join after reconnect
    const onReconnect = () => socket.emit('team-chat:join', teamId);

    const onMessage  = (msg: TeamMessage) => {
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    // Replace optimistic message with confirmed server message
    const onConfirmed = ({ tempId, message }: { tempId: string; message: TeamMessage }) => {
      setMessages(prev => {
        if (prev.some(m => m._id === message._id)) return prev;
        return prev.map(m => m._id === tempId ? { ...message, delivery: 'sent' as const } : m);
      });
    };

    const onTyping   = ({ userId: uid, name, isTyping }: { userId: string; name: string; isTyping: boolean }) => {
      if (uid === user?.id) return;
      setTypingUsers(prev =>
        isTyping
          ? prev.some(t => t.userId === uid) ? prev : [...prev, { userId: uid, name }]
          : prev.filter(t => t.userId !== uid)
      );
    };
    const onReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
    };

    socket.on('connect',                     onReconnect);
    socket.on('team-chat:message',           onMessage);
    socket.on('team-chat:message:confirmed', onConfirmed);
    socket.on('team-chat:typing',            onTyping);
    socket.on('team-chat:reaction',          onReaction);

    return () => {
      socket.off('connect',                     onReconnect);
      socket.off('team-chat:message',           onMessage);
      socket.off('team-chat:message:confirmed', onConfirmed);
      socket.off('team-chat:typing',            onTyping);
      socket.off('team-chat:reaction',          onReaction);
      socket.emit('team-chat:leave', teamId);
    };
  }, [socket, teamId, user?.id]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  /* ── Typing indicator ── */
  const handleTyping = useCallback(() => {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('team-chat:typing', { teamId, isTyping: true });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('team-chat:typing', { teamId, isTyping: false });
    }, 2000);
  }, [socket, teamId]);

  /* ── Send message ── */
  const handleSend = useCallback(() => {
    const text = content.trim();
    if (!text || !user || !socket) return;

    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('team-chat:typing', { teamId, isTyping: false });
      if (typingTimer.current) clearTimeout(typingTimer.current);
    }

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimistic: TeamMessage = {
      _id: tempId,
      team: teamId,
      content: text,
      sender: { _id: user.id, name: user.name },
      type: 'text',
      attachments: [],
      reactions: [],
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      delivery: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    setContent('');

    socket.emit('team-chat:message', { teamId, content: text, tempId });
  }, [content, user, teamId, socket]);

  /* ── React ── */
  const handleReact = useCallback((msgId: string, emoji: string) => {
    socket?.emit('team-chat:react', { teamId, messageId: msgId, emoji });
    setShowEmoji(false);
  }, [socket, teamId]);

  const typingNames = typingUsers.map(t => t.name);

  /* ── Group messages by date ── */
  let lastDate = '';

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-white">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#e0e0e0] bg-white flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
          <MessageSquare size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-[#202124]">{teamName} Chat</p>
          <p className="text-[10px] text-[#80868b]">Team conversation</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0 min-h-0 scrollbar-thin">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 opacity-70">
            <MessageSquare size={36} className="text-[var(--color-text-dim)]" />
            <p className="text-sm text-[var(--color-text-muted)] font-semibold">No messages yet</p>
            <p className="text-xs text-[var(--color-text-dim)]">Start a conversation with your team!</p>
          </div>
        )}

        {messages.filter(m => !m.isDeleted).map((msg) => {
          const isMine   = msg.sender._id === user?.id;
          const dateStr  = formatDate(msg.createdAt);
          const showDate = dateStr !== lastDate;
          if (showDate) lastDate = dateStr;

          return (
            <div key={msg._id}>
              {showDate && (
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-[#e0e0e0]" />
                  <span className="text-[10px] font-medium text-[#80868b] uppercase tracking-wider">{dateStr}</span>
                  <div className="flex-1 h-px bg-[#e0e0e0]" />
                </div>
              )}
              {/* Google Meet-style message row */}
              <div className={clsx('flex items-start gap-2 mb-0.5 group', isMine ? 'flex-row-reverse' : 'flex-row')}>

                {/* Avatar — only for others */}
                {!isMine && (
                  <div className="flex-shrink-0 mt-0.5">
                    {msg.sender.avatar ? (
                      <img src={msg.sender.avatar} alt={msg.sender.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-bold select-none">
                        {msg.sender.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {/* Bubble + meta */}
                <div className={clsx('flex flex-col max-w-[68%]', isMine ? 'items-end' : 'items-start')}>

                  {/* Sender name — others only */}
                  {!isMine && (
                    <span className="text-[11px] font-semibold text-indigo-500 mb-1 ml-1 leading-none">
                      {msg.sender.name}
                    </span>
                  )}

                  {/* Bubble */}
                  <div className={clsx(
                    'relative px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words',
                    isMine
                      ? 'bg-[#1a73e8] text-white rounded-[20px] rounded-tr-[4px]'
                      : 'bg-[#f1f3f4] text-[#202124] rounded-[20px] rounded-tl-[4px]'
                  )}>
                    {msg.content}

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.reactions.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => handleReact(msg._id, r.emoji)}
                            className={clsx(
                              'text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer',
                              r.users.includes(user?.id || '')
                                ? 'bg-white/20 border-white/30 text-white'
                                : 'bg-white border-[#dadce0] text-[#3c4043]'
                            )}
                          >
                            {r.emoji} {r.users.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timestamp + status */}
                  <div className={clsx('flex items-center gap-1 mt-0.5 px-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
                    <span className="text-[10px] text-[#80868b]">{formatTime(msg.createdAt)}</span>
                    {msg.isEdited && <span className="text-[10px] text-[#80868b]">· edited</span>}
                    {isMine && msg.delivery === 'sending' && (
                      <span className="text-[10px] text-[#80868b]">· sending…</span>
                    )}
                  </div>

                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator names={typingNames} />

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#e0e0e0] bg-white flex-shrink-0">
        <div className="flex items-end gap-2 bg-[#f1f3f4] rounded-2xl px-4 py-2.5 transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-[#1a73e8] focus-within:shadow-sm">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${teamName}...`}
            rows={1}
            className="flex-1 bg-transparent text-[13.5px] text-[#202124] placeholder-[#80868b] resize-none outline-none max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim()}
            className="p-2 rounded-full bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-30 disabled:hover:bg-[#1a73e8] transition-all flex-shrink-0 cursor-pointer"
          >
            <Send size={13} />
          </button>
          {/* Emoji picker */}
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xs cursor-pointer"
            >
              😊
            </button>
            {showEmoji && (
              <div className="absolute bottom-8 left-0 flex gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 shadow-lg z-20">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setContent(content + e);
                      setShowEmoji(false);
                    }}
                    className="text-base hover:scale-125 transition-transform cursor-pointer"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
