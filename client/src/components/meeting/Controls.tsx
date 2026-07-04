import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Circle, StopCircle, PhoneOff, Hand, Smile, LogOut, XOctagon } from 'lucide-react';
import { useMeetingStore } from '../../store/meeting/meeting.store';
import { useMeeting } from '../../hooks/useMeeting';
import { useRecording } from '../../hooks/useRecording';
import { getSocket } from '../../utils/socket';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { clsx } from 'clsx';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface ControlBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  activeColor?: string;
}

const ControlBtn = ({ icon: Icon, label, onClick, active, danger, disabled, activeColor }: ControlBtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-pressed={active}
    title={label}
    className={clsx(
      'flex flex-col items-center justify-center gap-1 min-w-[56px] px-3 py-2.5 rounded-xl transition-all duration-150',
      'select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed active:scale-95',
      'focus-visible:ring-2 focus-visible:ring-white/40',
      danger
        ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_2px_12px_rgba(239,68,68,0.35)]'
        : active
        ? activeColor ?? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary-border)]'
        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-transparent hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
    )}
  >
    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    <span className="text-[9px] font-semibold leading-none tracking-wide" aria-hidden="true">{label}</span>
  </button>
);

const REACTIONS = ['👍', '❤️', '😂', '🎉', '👏', '🔥'];

interface ControlsProps {
  localStream?: MediaStream | null;
  screenStreamRef?: React.RefObject<MediaStream | null>;
  startScreenShare?: () => Promise<void>;
  stopScreenShare?: () => void;
  stopAllTracks?: () => void;
}

const Controls = ({ localStream, screenStreamRef, startScreenShare, stopScreenShare, stopAllTracks }: ControlsProps) => {
  const { id: meetingId } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const {
    isMuted, isVideoOff, isScreenSharing, isRecording,
    toggleMute, toggleVideo,
    currentMeeting,
  } = useMeetingStore();
  const isHost = currentMeeting?.host === user?.id || currentMeeting?.host?._id === user?.id;
  const { leaveMeeting, endMeeting } = useMeeting(currentMeeting?.roomId);
  const { startRecording, stopRecording } = useRecording(meetingId ?? '', localStream ?? null, screenStreamRef);
  const [handRaised, setHandRaised]   = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const handleMic = () => {
    toggleMute();
  };

  const handleCamera = () => {
    toggleVideo();
  };

  const handleRecordingToggle = async () => {
    try {
      if (isRecording) stopRecording();
      else await startRecording();
    } catch {
      toast.error('Failed to toggle recording');
    }
  };

  const handleScreenShareToggle = async () => {
    if (isScreenSharing) {
      stopScreenShare?.();
    } else {
      await startScreenShare?.();
    }
  };

  const handleRaiseHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    const socket = getSocket();
    if (socket?.connected && meetingId) {
      socket.emit('meeting:raise-hand', { roomId: meetingId, raised: next });
    }
    toast(next ? '✋ Hand raised' : '✋ Hand lowered', { duration: 2000 });
  };

  const sendReaction = (emoji: string) => {
    setShowReactions(false);
    const socket = getSocket();
    if (socket?.connected && meetingId) {
      socket.emit('meeting:reaction', { roomId: meetingId, emoji });
    }
    toast(emoji, { duration: 2000, position: 'top-center' });
  };

  const handleLeave = async () => {
    stopAllTracks?.();
    await leaveMeeting(meetingId);
  };

  return (
    <div className="px-4 pb-5 pt-2 shrink-0 relative z-20">
      {/* Reaction picker */}
      {showReactions && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex gap-2 p-2 rounded-2xl bg-[var(--color-surface)]/95 backdrop-blur-xl border border-[var(--color-border)] shadow-2xl">
          {REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform active:scale-95 select-none"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div
        className={clsx(
          'flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-4 sm:px-6 mx-auto w-fit flex-wrap',
          'bg-[var(--color-surface)]/90 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-2xl',
        )}
        role="toolbar"
        aria-label="Meeting controls"
      >
        {/* Mic */}
        <ControlBtn
          icon={isMuted ? MicOff : Mic}
          label={isMuted ? 'Unmute' : 'Mute'}
          onClick={handleMic}
          active={isMuted}
          activeColor="bg-red-500/15 text-red-400 border border-red-500/30"
        />

        {/* Camera */}
        <ControlBtn
          icon={isVideoOff ? VideoOff : Video}
          label={isVideoOff ? 'Start Cam' : 'Stop Cam'}
          onClick={handleCamera}
          active={isVideoOff}
          activeColor="bg-red-500/15 text-red-400 border border-red-500/30"
        />

        <div className="w-px h-8 bg-[var(--color-border)] mx-0.5" />

        {/* Screen share */}
        <ControlBtn
          icon={isScreenSharing ? MonitorOff : Monitor}
          label={isScreenSharing ? 'Stop Share' : 'Share'}
          onClick={handleScreenShareToggle}
          active={isScreenSharing}
        />

        {/* Record */}
        <ControlBtn
          icon={isRecording ? StopCircle : Circle}
          label={isRecording ? 'Stop Rec' : 'Record'}
          onClick={handleRecordingToggle}
          active={isRecording}
          activeColor="bg-red-500/15 text-red-400 border border-red-500/30"
        />

        {/* Raise hand */}
        <ControlBtn
          icon={Hand}
          label={handRaised ? 'Lower' : 'Raise'}
          onClick={handleRaiseHand}
          active={handRaised}
        />

        {/* Reactions */}
        <ControlBtn
          icon={Smile}
          label="React"
          onClick={() => setShowReactions(v => !v)}
          active={showReactions}
        />

        <div className="w-px h-8 bg-[var(--color-border)] mx-0.5" />

        {/* Leave / End */}
        <ControlBtn
          icon={PhoneOff}
          label="Leave"
          onClick={handleLeave}
          danger
        />

        {isHost && (
          <ControlBtn
            icon={XOctagon}
            label="End"
            onClick={() => endMeeting(meetingId!)}
            danger
          />
        )}
      </div>
    </div>
  );
};

export default Controls;
