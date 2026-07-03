import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import { clsx } from 'clsx';

const SUGGESTIONS = [
  'Summarize this meeting',
  'List all action items',
  'What decisions were made?',
  'Generate tasks from transcript',
];

const AIAssistant = ({ meetingId }: { meetingId: string }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { assistantHistory, isAssistantLoading, sendAssistantMessage } = useAI(meetingId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [assistantHistory, isAssistantLoading]);

  const handleSend = async (text: string = input) => {
    const msg = text.trim();
    if (!msg || isAssistantLoading) return;
    setInput('');
    await sendAssistantMessage(msg);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {assistantHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center">
              <Bot size={24} className="text-[var(--color-primary)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-text)]">IntellMeet AI</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Ask anything about this meeting</p>
            </div>
            <div className="w-full flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 transition-all"
                >
                  <Sparkles size={10} className="inline mr-1.5 text-[var(--color-primary)]" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          assistantHistory.map((msg, i) => (
            <div key={i} className={clsx('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                msg.role === 'assistant'
                  ? 'bg-[var(--color-primary)]/15'
                  : 'bg-gradient-to-br from-[var(--color-primary)] to-purple-500'
              )}>
                {msg.role === 'assistant'
                  ? <Bot size={12} className="text-[var(--color-primary)]" />
                  : <span className="text-white text-[9px] font-bold">U</span>}
              </div>
              <div className={clsx(
                'max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-[var(--color-primary)] text-white rounded-tr-sm'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-tl-sm'
              )}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {isAssistantLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center flex-shrink-0">
              <Bot size={12} className="text-[var(--color-primary)]" />
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-2xl rounded-tl-sm px-3 py-2">
              <Loader2 size={13} className="text-[var(--color-primary)] animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask the AI assistant..."
            disabled={isAssistantLoading}
            className="input-dark py-2 text-xs flex-1"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isAssistantLoading}
            className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 transition-all"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
