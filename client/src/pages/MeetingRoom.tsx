import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Users, Brain, FileText,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import VideoGrid from '../components/meeting/VideoGrid';
import Controls from '../components/meeting/Controls';
import ChatBox from '../components/meeting/ChatBox';
import ParticipantList from '../components/meeting/ParticipantList';
import TranscriptPanel from '../components/ai/TranscriptPanel';
import SummaryCard from '../components/ai/SummaryCard';
import ActionItems from '../components/ai/ActionItems';
import AIAssistant from '../components/ai/AIAssistant';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTranscription } from '../hooks/useTranscription';
import { useAppSelector } from '../hooks/useAppDispatch';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { meetingService } from '../api/meeting.api';
import Badge from '../components/common/Badge';
import Logo from '../components/common/Logo';

type Panel   = 'chat' | 'participants' | 'ai' | 'notes';
type AITab   = 'summary' | 'transcript' | 'actions' | 'assistant';

const PANELS: { id: Panel; label: string; icon: React.ElementType }[] = [
  { id: 'chat',         label: 'Chat',    icon: MessageSquare },
  { id: 'participants', label: 'People',  icon: Users         },
  { id: 'ai',          label: 'AI',      icon: Brain         },
  { id: 'notes',       label: 'Notes',   icon: FileText      },
];

const AI_TABS: { id: AITab; label: string }[] = [
  { id: 'summary',    label: 'Summary'    },
  { id: 'transcript', label: 'Transcript' },
  { id: 'actions',    label: 'Actions'    },
  { id: 'assistant',  label: 'Chat'       },
];

/* ── AI sub-panel ── */
const AIPanel = ({ meetingId }: { meetingId: string }) => {
  const [tab, setTab] = useState<AITab>('summary');
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-2)]/40">
      <div className="flex gap-1 px-2 pt-2 pb-1 shrink-0" role="tablist" aria-label="AI panel tabs">
        {AI_TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex-1 py-2.5 min-h-[44px] text-[10px] font-bold rounded-lg transition-all relative border border-transparent',
              tab === id
                ? 'text-[var(--color-primary)] bg-[var(--color-primary-light)] border-[var(--color-primary-border)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'transcript' && <TranscriptPanel />}
        {tab === 'summary'    && <SummaryCard meetingId={meetingId} />}
        {tab === 'actions'    && <ActionItems meetingId={meetingId} />}
        {tab === 'assistant'  && <AIAssistant meetingId={meetingId} />}
      </div>
    </div>
  );
};

/* ── Notes sub-panel ── */
const NotesPanel = ({ meetingId }: { meetingId: string }) => {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    try {
      const { getSocket } = await import('../utils/socket');
      getSocket().emit('notes:update', { meetingId, content: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // socket may not be ready
    }
  }, [meetingId, notes]);

  return (
    <div className="p-4 h-full flex flex-col gap-3 bg-[var(--color-surface-2)]/40">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.1em]">Meeting Notes</p>
        <button
          onClick={handleSave}
          className="text-[10px] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors font-semibold"
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type your notes here…"
        aria-label="Meeting notes"
        className={clsx(
          'flex-1 resize-none text-xs text-[var(--color-text)] leading-relaxed bg-transparent border-none outline-none placeholder:text-[var(--color-text-dim)]',
        )}
        style={{ minHeight: 200 }}
      />
    </div>
  );
};

/* ── Main component ── */
const MeetingRoom = () => {
  const { id }     = useParams<{ id: string }>();
  const user = useAppSelector((s) => s.auth.user);

  const [activePanel, setActivePanel] = useState<Panel>('chat');
  const [panelOpen,   setPanelOpen]   = useState(true);
  const [socketRoomId, setSocketRoomId] = useState<string>(id ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, panelOpen);

  const { setCurrentMeeting, isRecording, currentMeeting } = useMeetingStore();
  const { localStreamRef, localStream, remoteStreams, startScreenShare, stopScreenShare, stopAllTracks } = useWebRTC({ roomId: socketRoomId, userId: user?.id ?? '' });
  
  useTranscription(id ?? '');

  // Start meeting on mount, fetch real title + roomId, clean up on leave
  useEffect(() => {
    if (!id) return;
    const initMeeting = async () => {
      try {
        const res: any = await meetingService.start(id);
        // axios interceptor unwraps res.data → res is ApiResponse body {success, data: meeting}
        const meeting = res?.data ?? res;
        const roomId = meeting?.roomId || id;
        setSocketRoomId(roomId);
        setCurrentMeeting({
          id,
          title: meeting?.title || 'Live Meeting',
          roomId,
          host: meeting?.host?._id || meeting?.host || user?.id || '',
          startedAt: meeting?.startedAt,
        });
      } catch {
        // Meeting may already be started or user is joining (not host)
        setCurrentMeeting({ id, title: 'Live Meeting', roomId: id, host: user?.id ?? '' });
      }
    };
    initMeeting();
    return () => setCurrentMeeting(null);
  }, [id, user?.id, setCurrentMeeting]);

  const meetingTitle = currentMeeting?.title ?? 'Meeting';

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] overflow-hidden" style={{ zIndex: 'var(--z-max)' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-bg)]/90 backdrop-blur-md"
      >
        <div className="flex items-center gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.3)]">
              <Logo width={14} height={6} className="text-white" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-[var(--color-text)] hidden sm:block tracking-tight">IntellMeet</span>
          </div>

          <div className="w-px h-4 bg-[var(--color-border)]" aria-hidden="true" />

          {/* Meeting info */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text)] hidden sm:block tracking-tight">{meetingTitle}</p>
            {id && (
              <code className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-1.5 py-0.5 font-mono">
                #{id.slice(0, 8)}
              </code>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/22 bg-red-500/7 text-red-400 text-[10px] font-semibold" role="status" aria-live="polite">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-record" aria-hidden="true" />
              REC
            </div>
          )}

          {/* Live badge */}
          <Badge variant="live" dot pulse>Live</Badge>

          <span className="text-xs text-[var(--color-text-muted)] tabular-nums hidden sm:block font-medium" aria-label={`Current time: ${now}`}>
            {now}
          </span>

          {/* Toggle panel */}
          <button
            onClick={() => setPanelOpen(v => !v)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors"
            aria-label={panelOpen ? 'Close side panel' : 'Open side panel'}
            aria-expanded={panelOpen}
          >
            <ChevronRight size={14} className={clsx('transition-transform duration-200', panelOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Video area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 relative overflow-hidden">
            <VideoGrid localStream={localStream} remoteStreams={remoteStreams} />
          </div>
          <Controls localStream={localStream} startScreenShare={startScreenShare} stopScreenShare={stopScreenShare} stopAllTracks={stopAllTracks} />
        </div>

        {/* Right panel — hidden on mobile (xs), slides from right on sm+ */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              ref={panelRef}
              className="flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'clamp(0px, 100%, 304px)', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
              style={{ minWidth: 0 }}
              role="complementary"
              aria-label="Meeting side panel"
            >
              {/* Panel tab bar */}
              <div
                className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/30 shrink-0"
                role="tablist"
                aria-label="Panel sections"
              >
                {PANELS.map(({ id: pid, label, icon: Icon }) => (
                  <button
                    key={pid}
                    role="tab"
                    aria-selected={activePanel === pid}
                    onClick={() => setActivePanel(pid)}
                    className={clsx(
                      'flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[44px] transition-all relative',
                      activePanel === pid
                        ? 'text-[var(--color-primary)] font-semibold'
                        : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
                    )}
                    aria-label={label}
                  >
                    {activePanel === pid && (
                      <motion.span
                        layoutId="panelIndicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-[var(--color-primary)] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                      />
                    )}
                    <Icon size={14} aria-hidden="true" />
                    <span className="text-[9px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden" role="tabpanel">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePanel}
                    className="h-full"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activePanel === 'chat'         && <ChatBox meetingId={id ?? ''} />}
                    {activePanel === 'participants' && <ParticipantList />}
                    {activePanel === 'ai'           && <AIPanel meetingId={id ?? ''} />}
                    {activePanel === 'notes'        && <NotesPanel meetingId={id ?? ''} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MeetingRoom;
