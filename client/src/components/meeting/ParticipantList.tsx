import { MicOff, VideoOff, Crown, UserX, Hand } from 'lucide-react';
import { useMeetingStore } from '../../store/meeting/meeting.store';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { clsx } from 'clsx';

const ParticipantList = () => {
  const { participants, currentMeeting, isMuted, isVideoOff, isSpeaking, raisedHands } = useMeetingStore();
  const user = useAppSelector((s) => s.auth.user);
  const isHostUser = user?.id === currentMeeting?.host;

  const all = [
    {
      id: user?.id || 'local',
      name: user?.name || 'You',
      isMuted,
      isVideoOff,
      isHost: isHostUser ?? false,
      socketId: 'local',
      isLocal: true,
      isSpeaking,
      handRaised: raisedHands.has('local'),
    },
    ...participants.map(p => ({ ...p, isLocal: false })),
  ];

  return (
    <div className="p-3 flex flex-col gap-2">
      <p className="text-xs text-[var(--color-text-muted)] font-medium px-1">
        {all.length} participant{all.length !== 1 ? 's' : ''}
      </p>
      {all.map((p) => (
        <div
          key={p.socketId}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] transition-colors"
        >
          {/* Avatar with speaking ring */}
          <div className="relative shrink-0">
            <div className={clsx(
              'w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center text-white text-sm font-bold transition-all duration-200',
              p.isSpeaking && 'ring-2 ring-green-400 ring-offset-1 ring-offset-[var(--color-surface-2)]'
            )}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            {/* Presence dot — green = online/speaking, yellow = muted */}
            <span className={clsx(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface-2)]',
              p.isSpeaking ? 'bg-green-400' : p.isMuted ? 'bg-yellow-400' : 'bg-green-400'
            )} aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">
              {p.name}{p.isLocal && <span className="text-[var(--color-text-dim)] text-xs ml-1">(You)</span>}
            </p>
            <p className="text-[10px] text-[var(--color-text-dim)] leading-none mt-0.5">
              {p.isSpeaking ? (
                <span className="text-green-400 font-medium">Speaking…</span>
              ) : p.isHost ? (
                <span className="text-[var(--color-primary)]">Host</span>
              ) : (
                <span>Online</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {p.handRaised && (
              <span title="Hand raised" className="text-yellow-400" aria-label="Hand raised">
                <Hand size={13} />
              </span>
            )}
            {p.isHost && <Crown size={13} className="text-yellow-400" aria-hidden="true" />}
            {p.isMuted && <MicOff size={13} className="text-[var(--color-danger,#ef4444)]" aria-label="Muted" />}
            {p.isVideoOff && <VideoOff size={13} className="text-[var(--color-text-dim)]" aria-label="Camera off" />}
          </div>

          {isHostUser && !p.isLocal && (
            <button
              className="p-1 rounded text-[var(--color-text-dim)] hover:text-[var(--color-danger,#ef4444)] hover:bg-red-500/10 transition-colors"
              aria-label={`Remove ${p.name}`}
            >
              <UserX size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ParticipantList;
