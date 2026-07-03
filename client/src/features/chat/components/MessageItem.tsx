import React from 'react';
import { clsx } from 'clsx';
import { Circle, Trash2 } from 'lucide-react';


interface MessageItemProps {
  msg: any; // replace with proper type if available
  userId?: string;
  isMine: boolean;
  onReact: (msgId: string, emoji: string) => void;
  onDelete?: (msgId: string) => void;
  isOnline?: (userId: string) => boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, userId, isMine, onReact, onDelete, isOnline }) => {
  return (
    <div key={msg._id} className={clsx('flex gap-3 group relative', isMine && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366F1] to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {msg.sender.name.charAt(0).toUpperCase()}
        </div>
        {isOnline && isOnline(msg.sender._id) && (
          <Circle size={8} className="absolute -bottom-0.5 -right-0.5 text-emerald-500 fill-emerald-500 ring-2 ring-[var(--color-bg-secondary)]" />
        )}
      </div>

      <div className={clsx('flex flex-col gap-1 max-w-[70%]', isMine && 'items-end')}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{msg.sender.name}</span>
          <span className="text-[10px] text-[var(--color-text-dim)]">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isMine && <DeliveryIcon state={msg.delivery} />}
        </div>

        <div
          className={clsx(
            'px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed transition-all border',
            msg.isDeleted
              ? 'italic text-[var(--color-text-dim)] bg-transparent border-dashed border-[var(--color-border)]'
              : isMine
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm rounded-tr-none'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border-[var(--color-border)] rounded-tl-none'
          )}
        >
          {msg.content}
          {msg.isEdited && !msg.isDeleted && (
            <span className="text-[10px] opacity-60 ml-1.5">(edited)</span>
          )}
        </div>

        {/* Reactions */}
        {msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {msg.reactions.map((r: any) => (
              <button
                key={r.emoji}
                onClick={() => onReact(msg._id, r.emoji)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[11px] hover:border-[var(--color-border-strong)] text-[var(--color-text-secondary)] transition-colors cursor-pointer"
              >
                <span>{r.emoji}</span>
                <span className="text-[var(--color-text-muted)] font-bold">{r.users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        {!msg.isDeleted && (
          <div
            className={clsx(
              'absolute top-2.5 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2 py-1 shadow-md transition-opacity z-10',
              isMine ? 'right-10' : 'left-10'
            )}
          >
            {/* Emoji quick‑pick */}
            <div className="relative">
              <button
                onClick={() => onReact(msg._id, '😊')}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xs cursor-pointer"
              >
                😊
              </button>
              {/* For brevity the emoji picker is omitted – you can integrate the existing picker if needed */}
            </div>
            {isMine && onDelete && (
              <button onClick={() => onDelete(msg._id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-650 transition-colors cursor-pointer">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// DeliveryIcon component (moved here for reuse)
const DeliveryIcon = ({ state }: { state?: string }) => {
  if (state === 'sending') return <span className="text-[9px] text-[var(--color-text-dim)]">⏳</span>;
  if (state === 'sent') return <span className="text-[9px] text-[var(--color-text-dim)]">✓</span>;
  if (state === 'delivered') return <span className="text-[9px] text-[var(--color-text-muted)]">✓✓</span>;
  if (state === 'read') return <span className="text-[9px] text-indigo-650">✓✓</span>;
  if (state === 'failed') return <span className="text-[9px] text-red-500 font-bold">!</span>;
  return null;
};
