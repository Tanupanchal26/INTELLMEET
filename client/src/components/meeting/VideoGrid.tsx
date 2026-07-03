import { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';
import { useMeetingStore } from '../../store/meeting/meeting.store';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { clsx } from 'clsx';

const VideoTile = ({ name, isMuted, isVideoOff, isScreenSharing, isActive, isLocal, stream, isSingle }: {
  name: string; isMuted: boolean; isVideoOff: boolean; isScreenSharing?: boolean; isActive?: boolean; isLocal?: boolean; stream?: MediaStream | null; isSingle?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (stream && !isVideoOff) {
      videoRef.current.srcObject = stream;
    } else {
      // Clear the video element so frozen frame doesn't linger
      videoRef.current.srcObject = null;
    }
  }, [stream, isVideoOff]);

  return (
    <article
      className={clsx(
        'video-tile relative flex items-center justify-center rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 transition-all duration-300 shadow-xl h-full w-full group',
        !isSingle && 'aspect-video',
        isActive
          ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg)]'
          : 'ring-1 ring-white/10'
      )}
      aria-label={`${name}${isLocal ? ' (You)' : ''} — ${isMuted ? 'muted' : 'unmuted'}${isVideoOff ? ', video off' : ''}`}
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
          {/* Animated glow effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
          <div className={clsx(
            "rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center text-white font-bold shadow-2xl border border-white/20 transition-all duration-500",
            isSingle ? "w-32 h-32 text-5xl" : "w-16 h-16 text-2xl"
          )} aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name Tag Overlay */}
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
        </div>
        <div className="flex gap-2">
          {isMuted    && <div className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg backdrop-blur-md border border-white/10"><MicOff  size={14} className="text-white" /></div>}
          {isVideoOff && <div className="w-8 h-8 rounded-full bg-slate-800/90 flex items-center justify-center shadow-lg backdrop-blur-md border border-white/10"><VideoOff size={14} className="text-white" /></div>}
        </div>
      </div>
    </article>
  );
};

const VideoGrid = ({ localStream, remoteStreams }: { localStream?: MediaStream | null; remoteStreams?: Map<string, MediaStream> }) => {
  const { participants, isVideoOff, isMuted, isScreenSharing } = useMeetingStore();
  const user = useAppSelector((s) => s.auth.user);
  
  // Filter out the local user from participants — they are rendered as the hardcoded local tile
  const remoteParticipants = participants.filter(p => p.id !== user?.id);
  
  const allTiles = [
    { id: 'local', name: user?.name || 'You', isMuted, isVideoOff, isScreenSharing, isLocal: true, isActive: true, stream: localStream },
    ...remoteParticipants.map(p => ({
      id: p.socketId,
      name: p.name,
      isMuted: p.isMuted,
      isVideoOff: p.isVideoOff,
      isScreenSharing: p.isScreenSharing,
      isLocal: false,
      isActive: false,
      stream: remoteStreams?.get(p.socketId) || null,
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
        allTiles.map(tile => <VideoTile key={tile.id} {...tile} isSingle={false} />)
      )}
    </div>
  );
};

export default VideoGrid;
