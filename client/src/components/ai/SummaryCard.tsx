import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, FileText } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import Button from '../common/Button';

const SummaryCard = ({ meetingId }: { meetingId: string }) => {
  const { summary, isGenerating, generateSummary } = useAI(meetingId);

  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      <Button onClick={generateSummary} loading={isGenerating} disabled={isGenerating} className="w-full gap-2">
        <Sparkles size={14} />
        {isGenerating ? 'Generating…' : 'Generate AI Summary'}
      </Button>

      {!summary && !isGenerating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Sparkles size={32} className="text-[var(--color-primary)] mx-auto mb-2 opacity-50" />
            <p className="text-sm text-[var(--color-text-dim)]">
              Click to generate an AI-powered meeting summary
            </p>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="flex-1 flex items-center justify-center gap-2">
          <Loader2 size={20} className="text-[var(--color-primary)] animate-spin" />
          <span className="text-sm text-[var(--color-text-muted)]">Analyzing transcript…</span>
        </div>
      )}

      {summary && !isGenerating && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={13} className="text-[var(--color-primary)]" />
            <span className="text-xs font-semibold text-[var(--color-text)]">AI Summary</span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-[var(--color-text-muted)] leading-relaxed [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:text-[var(--color-text)] [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:pl-4 [&_li]:mb-0.5">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryCard;
