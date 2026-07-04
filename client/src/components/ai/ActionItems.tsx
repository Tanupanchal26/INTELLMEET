import { useEffect } from 'react';
import { CheckSquare, User, Zap, Check, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAI } from '../../hooks/useAI';
import { aiService } from '../../api/ai.api';
import Badge from '../common/Badge';

const PRIORITY_BADGE = {
  high:   'danger',
  medium: 'warning',
  low:    'info',
} as const;

const ActionItems = ({ meetingId }: { meetingId: string }) => {
  const { actionItems, isGenerating, setActionItems, toggleActionItemDone } = useAI(meetingId);

  // Use TanStack Query so action items are cached — no re-fetch on panel switch
  const { data } = useQuery({
    queryKey: ['meeting-action-items', meetingId],
    queryFn: () => aiService.getActionItems(meetingId).then((r) => r.data),
    enabled: !!meetingId && actionItems.length === 0,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  // Sync fetched action items into the AI store once
  useEffect(() => {
    if (data?.actionItems?.length && actionItems.length === 0) {
      setActionItems(data.actionItems);
    }
  }, [data?.actionItems, actionItems.length, setActionItems]);

  if (isGenerating) return (
    <div className="flex items-center justify-center h-full gap-2">
      <Loader2 size={18} className="text-[var(--color-primary)] animate-spin" />
      <span className="text-sm text-[var(--color-text-muted)]">Extracting action items…</span>
    </div>
  );

  if (!actionItems.length) return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <Zap size={32} className="text-[var(--color-primary)] opacity-40 mb-2" />
      <p className="text-sm text-[var(--color-text-dim)]">Generate a summary first to extract AI action items</p>
    </div>
  );

  const done = actionItems.filter(i => i.done).length;

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <p className="text-xs text-[var(--color-text-muted)] font-medium">{actionItems.length} action items</p>
        <p className="text-xs text-[var(--color-text-dim)]">{done}/{actionItems.length} done</p>
      </div>
      {actionItems.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${item.done ? 'bg-green-500/5 border-green-500/20' : 'bg-[var(--color-surface-2)] border-transparent'}`}
        >
          <button
            onClick={() => toggleActionItemDone(idx)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${item.done ? 'bg-green-500 border-green-500' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'}`}
          >
            {item.done && <Check size={11} className="text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm leading-snug ${item.done ? 'line-through text-[var(--color-text-dim)]' : 'text-[var(--color-text)]'}`}>
              {item.text}
            </p>
            {item.assignee && (
              <div className="flex items-center gap-1 mt-1">
                <User size={10} className="text-[var(--color-text-dim)]" />
                <span className="text-[10px] text-[var(--color-text-dim)]">{item.assignee}</span>
              </div>
            )}
            {item.dueDate && (
              <p className="text-[10px] text-[var(--color-text-dim)] mt-0.5">Due: {item.dueDate}</p>
            )}
          </div>
          <Badge variant={PRIORITY_BADGE[item.priority as keyof typeof PRIORITY_BADGE]} className="flex-shrink-0 capitalize">
            {item.priority}
          </Badge>
        </div>
      ))}
    </div>
  );
};

export default ActionItems;
