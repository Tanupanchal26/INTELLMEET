import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import { useMeetingStore } from '../../store/meeting/meeting.store';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// ── Per-tile reaction overlay ─────────────────────────────────────────────────
// Reads only the reactions that belong to this tile's socketId/userId
const TileReactions = ({ tileSocketId, tileUserId }: { tileSocketId: string; tileUserId: string }) => {
  const reactions = useMeetingStore((s) =>
    s.reactions.filter(r => r.socketId === tileSocketId || r.userId === tileUserId)
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 text-4xl select-none drop-shadow-lg"
            initial={{ opacity: 1, y: 0, scale: 0.6 }}
            animate={{ opacity: 0, y: -80, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ── Individual video tile ─────────────────────────────────────────────────────
const VideoTile = ({
  tileId, name, isMuted, isVideoOff, isScreenSharing, isActive, isLocal,
  isHost, stream, isSingle, isSpeaking, handRaised, socketId, userId,
}: {
  tileId: string; name: string; isMuted: boolean; isVideoOff: boolean;
  isScreenSharing?: boolean; isActive?: boolean; isLocal?: boolean;
  isHost?: boolean; stream?: MediaStream | null; isSingle?: boolean;
  isSpeaking?: boolean; handRaised?: boolean; socketId: string; userId: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const hasVideo = !!stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
    if (hasVideo && !isVideoOff) {
      if (el.srcObject !== stream) el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream, isVideoOff]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const onTrackChange = () => {
      const el = videoRef.current;
      if (!el) return;
      const hasVideo = stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
      if (hasVideo && !isVideoOff) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play().catch(() => {});
      }
    };
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);
    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
    };
  }, [stream, isVideoOff]);

  return (
    <article
      className={clsx(
        'video-tile relative flex items-center justify-center rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 transition-all duration-300 shadow-xl h-full w-full group',
        !isSingle && 'aspect-video',
        isSpeaking
          ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-[var(--color-bg)]'
          : isActive
          ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg)]'
          : 'ring-1 ring-white/10'
      )}
      aria-label={`${name}${isLocal ? ' (You)' : ''} — ${isMuted ? 'muted' : 'unmuted'}${isVideoOff ? ', video off' : ''}${isSpeaking ? ', speaking' : ''}${handRaised ? ', hand raised' : ''}`}
    >
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={clsx(
            "absolute inset-0 w-full h-full object-cover",
            isLocal && !isScreenSharing && "scale-x-[-1]"
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
          <div className={clsx(
            "rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center text-white font-bold shadow-2xl border border-white/20 transition-all duration-500",
            isSingle ? "w-32 h-32 text-5xl" : "w-16 h-16 text-2xl"
          )} aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* ── Raise hand badge — top-right corner, always visible when raised ── */}
      <AnimatePresence>
        {handRaised && (
          <motion.div
            key="hand-badge"
            className="absolute top-3 right-3 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 backdrop-blur-sm shadow-lg border border-amber-400/40"
            initial={{ opacity: 0, scale: 0.5, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            aria-label="Hand raised"
          >
            <span className="text-sm leading-none">✋</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Per-tile floating reaction overlay ── */}
      <TileReactions tileSocketId={socketId} tileUserId={userId} />

      {/* ── Name tag overlay ── */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 sm:opacity-100" aria-hidden="true">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-white bg-black/50 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-lg border border-white/10">
            {name}{isLocal ? ' (You)' : ''}
          </span>
          {isScreenSharing && (
            <span className="text-xs font-bold text-white bg-[var(--color-primary)]/80 backdrop-blur-md rounded-xl px-2 py-1 shadow-lg border border-white/10">
              Presenter
            </span>
          )}
          {isHost && (
            <span className="text-xs font-bold text-white bg-yellow-500/80 backdrop-blur-md rounded-xl px-2 py-1 shadow-lg border border-white/10">
              Host
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isMuted    && <div className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg backdrop-blur-md border border-white/10"><MicOff  size={14} className="text-white" /></div>}
          {isVideoOff && <div className="w-8 h-8 rounded-full bg-slate-800/90 flex items-center justify-center shadow-lg backdrop-blur-md border border-white/10"><VideoOff size={14} className="text-white" /></div>}
        </div>
      </div>
    </article>
  );
};

// ── Grid ──────────────────────────────────────────────────────────────────────
const VideoGrid = ({ localStream, remoteStreams }: { localStream?: MediaStream | null; remoteStreams?: Map<string, MediaStream> }) => {
  const { participants, isVideoOff, isMuted, isScreenSharing, currentMeeting, isSpeaking, raisedHands, localHandRaised } = useMeetingStore();
  const user = useAppSelector((s) => s.auth.user);
  const isHostUser = user?.id === currentMeeting?.host;

  const socket = (() => {
    try { return (window as any).__intellmeet_socket_id__ as string | undefined; } catch { return undefined; }
  })();

  const allTiles = [
    {
      tileId: 'local',
      name: user?.name || 'You',
      isMuted,
      isVideoOff,
      isScreenSharing,
      isLocal: true,
      isActive: true,
      isHost: isHostUser,
      stream: localStream,
      isSpeaking,
      handRaised: localHandRaised,
      // For local tile reactions we match by userId since we don't expose socket.id here
      socketId: 'local',
      userId: user?.id || 'local',
    },
    ...participants.map(p => ({
      tileId: p.socketId,
      name: p.name,
      isMuted: p.isMuted,
      isVideoOff: p.isVideoOff ?? false,
      isScreenSharing: p.isScreenSharing,
      isLocal: false,
      isActive: false,
      isHost: p.isHost,
      stream: remoteStreams?.get(p.socketId) || null,
      isSpeaking: p.isSpeaking ?? false,
      handRaised: p.handRaised ?? raisedHands.has(p.socketId),
      socketId: p.socketId,
      userId: p.id,
    })),
  ];

  const isSingle = allTiles.length === 1;
  let gridCols = 'grid-cols-1';
  if (allTiles.length === 2) gridCols = 'grid-cols-2';
  else if (allTiles.length >= 3) gridCols = 'grid-cols-3';

  return (
    <div className={clsx(
      "h-full w-full p-4 md:p-6 transition-all duration-500 ease-in-out",
      isSingle ? "flex items-center justify-center" : `grid ${gridCols} gap-4 place-content-center`
    )} role="list" aria-label={`Participants (${allTiles.length})`}>
      {isSingle ? (
        <div className="w-full h-full max-w-6xl max-h-[85vh] mx-auto">
          <VideoTile {...allTiles[0]} isSingle={true} />
        </div>
      ) : (
        allTiles.map(tile => <VideoTile key={tile.tileId} {...tile} isSingle={false} />)
      )}
    </div>
  );
};

export default VideoGrid;
