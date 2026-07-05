import { useAI } from '../../hooks/useAI';
import { Mic, MicOff } from 'lucide-react';
import { clsx } from 'clsx';

const TranscriptPanel = ({ meetingId }: { meetingId: string }) => {
  const { transcript, isTranscribing } = useAI(meetingId);
  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={clsx('w-2 h-2 rounded-full', isTranscribing ? 'bg-red-500 animate-pulse-dot' : 'bg-[var(--color-text-dim)]')} />
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            {isTranscribing ? 'Live Transcription' : 'Transcription Paused'}
          </span>
        </div>
        {isTranscribing ? <Mic size={14} className="text-red-400" /> : <MicOff size={14} className="text-[var(--color-text-dim)]" />}
      </div>
      <div className="flex-1 overflow-y-auto bg-[var(--color-surface-2)] rounded-xl p-3">
        {transcript ? (
          <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{transcript}</p>
        ) : (
          <p className="text-sm text-[var(--color-text-dim)] text-center mt-8">
            Transcript will appear here during the meeting...
          </p>
        )}
      </div>
    </div>
  );
};

export default TranscriptPanel;
