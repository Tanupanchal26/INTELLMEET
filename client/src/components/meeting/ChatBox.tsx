import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { clsx } from 'clsx';

const fmt = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatBox = ({ meetingId }: { meetingId: string }) => {
  const [input, setInput] = useState('');
  const user = useAppSelector((s) => s.auth.user);
  const { messages, typingUsers, sendMessage, sendTyping } = useChat(meetingId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !user) return;
    sendMessage(input.trim());
    setInput('');
    sendTyping(user.name, false);
  };

  const handleTyping = (v: string) => {
    setInput(v);
    if (!user) return;
    sendTyping(user.name, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(user!.name, false), 1500);
  };

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
          return (
            <div key={msg.id} className={clsx('flex gap-2', isOwn && 'flex-row-reverse')}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5" aria-hidden="true">
                {msg.senderName.charAt(0).toUpperCase()}
              </div>
              <div className={clsx('max-w-[75%] flex flex-col gap-0.5', isOwn && 'items-end')}>
                <div className={clsx(
                  'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  isOwn ? 'bg-[var(--color-primary)] text-white rounded-tr-sm' : 'bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-tl-sm'
                )}>
                  <span className="sr-only">{msg.senderName}: </span>
                  {msg.content}
                </div>
                <span className="text-[10px] text-[var(--color-text-dim)] px-1" aria-label={`Sent at ${fmt(msg.timestamp)}`}>{fmt(msg.timestamp)}</span>
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2" aria-live="polite" aria-atomic="true">
            <div className="flex gap-1" aria-hidden="true">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
            <span className="text-xs text-[var(--color-text-dim)]">{typingUsers[0]} is typing…</span>
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
