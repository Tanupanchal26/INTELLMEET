import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, FileText, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAI } from '../../hooks/useAI';
import { aiService } from '../../api/ai.api';
import Button from '../common/Button';

const SummaryCard = ({ meetingId }: { meetingId: string }) => {
  const { summary, isGenerating, generateSummary, setSummary } = useAI(meetingId);

  // Use TanStack Query so the result is cached — no re-fetch on panel switch
  const { data } = useQuery({
    queryKey: ['meeting-summary', meetingId],
    queryFn: () => aiService.getSummary(meetingId).then((r) => r.data),
    enabled: !!meetingId && !summary,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });

  // Sync fetched summary into the AI store once
  useEffect(() => {
    if (data?.summary && !summary) setSummary(data.summary);
  }, [data?.summary, summary, setSummary]);

  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      <Button
        onClick={generateSummary}
        loading={isGenerating}
        disabled={isGenerating}
        className="w-full gap-2"
      >
        <Sparkles size={14} />
        {isGenerating ? 'Generating…' : summary ? 'Regenerate Summary' : 'Generate AI Summary'}
      </Button>

      {!summary && !isGenerating && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <Sparkles size={32} className="text-[var(--color-primary)] mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
              No summary yet
            </p>
            <p className="text-xs text-[var(--color-text-dim)] leading-relaxed">
              Click the button above to generate an AI-powered summary.
              Make sure transcription is running during the meeting.
            </p>
            <div className="mt-3 flex items-start gap-2 text-left bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
              <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300 leading-relaxed">
                Summary requires a transcript. If generation fails, ensure the meeting has spoken content or transcription is enabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="text-[var(--color-primary)] animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-muted)]">Analyzing transcript…</p>
            <p className="text-xs text-[var(--color-text-dim)] mt-0.5">This may take up to 30 seconds</p>
          </div>
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
