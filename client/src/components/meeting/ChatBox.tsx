import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Check, CheckCheck } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { useMeetingStore } from '../../store/meeting/meeting.store';
import { clsx } from 'clsx';

const fmt = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Format typing indicator: "Alice is typing…" / "Alice and Bob are typing…" / "3 people are typing…" */
const fmtTyping = (users: string[]): string => {
  if (users.length === 1) return `${users[0]} is typing…`;
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing…`;
  return `${users.length} people are typing…`;
};

const ChatBox = ({ meetingId }: { meetingId: string }) => {
  const [input, setInput] = useState('');
  const user = useAppSelector((s) => s.auth.user);
  const participants = useMeetingStore((s) => s.participants);
  const { messages, typingUsers, sendMessage, sendTyping, sendRead } = useChat(meetingId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Mark last message as read when it comes in from someone else
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.senderId !== user?.id) {
      sendRead(last.id);
    }
  }, [messages, user?.id, sendRead]);

  const handleSend = () => {
    if (!input.trim() || !user) return;
    sendMessage(input.trim());
    setInput('');
    clearTimeout(typingTimeout.current);
    sendTyping(user.name, false);
  };

  const handleTyping = (v: string) => {
    setInput(v);
    if (!user) return;
    sendTyping(user.name, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(user!.name, false), 1500);
  };

  /** Resolve how many participants (excluding self) have read a message */
  const getReadCount = useCallback((readBy: string[] = []) => {
    // readBy contains socketIds; participants store has socketIds for remote users
    return readBy.filter(sid => sid !== 'local').length;
  }, []);

  return (
    <div className="flex flex-col h-full" role="log" aria-label="Meeting chat" aria-live="polite">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--color-text-dim)]">No messages yet. Say hello! 👋</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.id;
          const readCount = getReadCount(msg.readBy);
          const totalRemote = participants.length;
          const allRead = totalRemote > 0 && readCount >= totalRemote;

          return (
            <div key={msg.id} className={clsx('flex gap-2', isOwn && 'flex-row-reverse')}>
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                aria-hidden="true"
              >
                {msg.senderName.charAt(0).toUpperCase()}
              </div>
              <div className={clsx('max-w-[75%] flex flex-col gap-0.5', isOwn && 'items-end')}>
                {!isOwn && (
                  <span className="text-[10px] text-[var(--color-text-dim)] px-1 font-medium">{msg.senderName}</span>
                )}
                <div className={clsx(
                  'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  isOwn
                    ? 'bg-[var(--color-primary)] text-white rounded-tr-sm'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-tl-sm'
                )}>
                  <span className="sr-only">{msg.senderName}: </span>
                  {msg.content}
                </div>
                <div className={clsx('flex items-center gap-1 px-1', isOwn && 'flex-row-reverse')}>
                  <span className="text-[10px] text-[var(--color-text-dim)]" aria-label={`Sent at ${fmt(msg.timestamp)}`}>
                    {fmt(msg.timestamp)}
                  </span>
                  {/* Read receipt — only shown on own messages */}
                  {isOwn && (
                    <span
                      className={clsx('transition-colors', allRead ? 'text-blue-400' : 'text-[var(--color-text-dim)]')}
                      title={allRead ? 'Read by everyone' : readCount > 0 ? `Read by ${readCount}` : 'Delivered'}
                      aria-label={allRead ? 'Read by everyone' : readCount > 0 ? `Read by ${readCount}` : 'Delivered'}
                    >
                      {allRead ? <CheckCheck size={12} /> : <Check size={12} />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2" aria-live="polite" aria-atomic="true">
            <div className="flex gap-1" aria-hidden="true">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
            <span className="text-xs text-[var(--color-text-dim)]">{fmtTyping(typingUsers)}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[var(--color-border)]">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          aria-label="Send a message"
        >
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message…"
            className="input-dark py-2 text-sm flex-1"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 transition-all"
            aria-label="Send message"
          >
            <Send size={15} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatBox;
