import React from 'react';
import { Send } from 'lucide-react';

interface MessageInputProps {
  content: string;
  setContent: (value: string) => void;
  handleSend: () => void;
  handleTyping: () => void;
  showEmoji: string | null;
  setShowEmoji: (msgId: string | null) => void;
  emojis: string[];
}

export const MessageInput: React.FC<MessageInputProps> = ({
  content,
  setContent,
  handleSend,
  handleTyping,
  showEmoji,
  setShowEmoji,
  emojis,
}) => {
  return (
    <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/20 flex-shrink-0">
      <div className="flex items-end gap-3 bg-[var(--color-bg-tertiary)]/70 border border-[var(--color-border)] focus-within:border-[var(--color-border-strong)] focus-within:shadow-[0_0_0_3px_rgba(66,67,65,0.08)] rounded-2xl px-4 py-3 transition-all">
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
          placeholder="Message"
          rows={1}
          className="flex-1 bg-transparent text-[13px] text-[var(--color-text)] placeholder-[var(--color-text-dim)] resize-none outline-none max-h-32"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all flex-shrink-0 shadow-[0_2px_8px_rgba(99,102,241,0.2)] cursor-pointer"
        >
          <Send size={13} />
        </button>
        {/* Emoji picker toggle */}
        <div className="relative">
          <button
            onClick={() => setShowEmoji(showEmoji ? null : 'input')}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xs cursor-pointer"
          >
            😊
          </button>
          {showEmoji === 'input' && (
            <div className="absolute bottom-8 left-0 flex gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 shadow-lg z-20">
              {emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setContent(content + e);
                    setShowEmoji(null);
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
  );
};
