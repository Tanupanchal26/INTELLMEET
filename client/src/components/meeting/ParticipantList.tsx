import { MicOff, Crown, UserX } from 'lucide-react';
import { useMeetingStore } from '../../store/meeting/meeting.store';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { clsx } from 'clsx';

const ParticipantList = () => {
  const { participants, currentMeeting, isMuted, isVideoOff } = useMeetingStore();
  const user = useAppSelector((s) => s.auth.user);
  const isHostUser = user?.id === currentMeeting?.host;

  const all = [
    { id: user?.id || 'local', name: user?.name || 'You', isMuted, isVideoOff, isHost: isHostUser ?? false, socketId: 'local', isLocal: true },
    ...participants.map(p => ({ ...p, isLocal: false }))
  ];

  return (
    <div className="p-3 flex flex-col gap-2">
      <p className="text-xs text-[var(--color-text-muted)] font-medium px-1">
        {all.length} participant{all.length !== 1 ? 's' : ''}
      </p>
      {all.map((p) => (
        <div key={p.socketId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] transition-colors">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <span className={clsx('status-dot absolute -bottom-0.5 -right-0.5 border-2 border-[var(--color-surface-2)]', 'status-dot--online')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)] truncate">
              {p.name} {p.isLocal && <span className="text-[var(--color-text-dim)] text-xs">(You)</span>}
            </p>
            {p.isHost && <p className="text-[10px] text-[var(--color-primary)]">Host</p>}
          </div>
          <div className="flex items-center gap-1">
            {p.isHost && <Crown size={13} className="text-yellow-400" />}
            {p.isMuted && <MicOff size={13} className="text-[var(--color-danger)]" />}
          </div>
          {isHostUser && !p.isLocal && (
            <button className="p-1 rounded text-[var(--color-text-dim)] hover:text-[var(--color-danger)] hover:bg-red-500/10 transition-colors">
              <UserX size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ParticipantList;
