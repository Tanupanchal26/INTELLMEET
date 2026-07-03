import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

interface WebRTCConfig { roomId: string; userId: string; }

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export const useWebRTC = ({ roomId, userId }: WebRTCConfig) => {
  const localStreamRef   = useRef<MediaStream | null>(null);
  const screenStreamRef  = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // ICE candidate queue: buffer candidates that arrive before remote description is set
  const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Track whether initial media has been acquired
  const mediaReadyRef = useRef(false);

  const { isVideoOff, isMuted, setScreenSharing } = useMeetingStore();
  const socket = getSocket();

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const broadcastMediaState = useCallback((videoOff: boolean, muted: boolean) => {
    if (socket?.connected && roomId) {
      socket.emit('meeting:media-state', { roomId, isMuted: muted, isVideoOff: videoOff, isScreenSharing: false });
    }
  }, [socket, roomId]);

  const replaceVideoTrackInPeers = useCallback((track: MediaStreamTrack | null) => {
    peersRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(track).catch(() => {});
      } else if (track && localStreamRef.current) {
        pc.addTrack(track, localStreamRef.current);
      }
    });
  }, []);

  // ── Drain queued ICE candidates once remote description is set ────────────────

  const drainIceCandidates = useCallback(async (remoteSocketId: string, pc: RTCPeerConnection) => {
    const queued = iceCandidateQueue.current.get(remoteSocketId) ?? [];
    iceCandidateQueue.current.delete(remoteSocketId);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }, []);

  // ── Peer connection ───────────────────────────────────────────────────────────

  const closePeerConnection = useCallback((remoteSocketId: string) => {
    const pc = peersRef.current.get(remoteSocketId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(remoteSocketId);
      iceCandidateQueue.current.delete(remoteSocketId);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(remoteSocketId);
        return next;
      });
    }
  }, []);

  const createPeerConnection = useCallback((remoteSocketId: string, isInitiator: boolean) => {
    // Guard: never create duplicate connections
    if (peersRef.current.has(remoteSocketId)) return peersRef.current.get(remoteSocketId)!;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(remoteSocketId, pc);

    // Add current local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(remoteSocketId, remoteStream);
          return next;
        });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('meeting:signal', {
          roomId, to: remoteSocketId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // connectionstatechange is more reliable than iceconnectionstatechange
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (isInitiator) {
          pc.createOffer({ iceRestart: true })
            .then(o => pc.setLocalDescription(o))
            .then(() => socket.emit('meeting:signal', {
              roomId, to: remoteSocketId,
              signal: { type: 'offer', sdp: pc.localDescription },
            }))
            .catch(() => {});
        } else {
          closePeerConnection(remoteSocketId);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' && isInitiator) {
            pc.createOffer({ iceRestart: true })
              .then(o => pc.setLocalDescription(o))
              .then(() => socket.emit('meeting:signal', {
                roomId, to: remoteSocketId,
                signal: { type: 'offer', sdp: pc.localDescription },
              }))
              .catch(() => {});
          }
        }, 3000);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => socket.emit('meeting:signal', {
          roomId, to: remoteSocketId,
          signal: { type: 'offer', sdp: pc.localDescription },
        }))
        .catch(() => {});
    }

    return pc;
  }, [roomId, socket, closePeerConnection]);

  // ── Initial media setup ───────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;
    const initMedia = async () => {
      // Step 1: try camera + mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (!isMounted) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
        stream.getVideoTracks().forEach(t => { t.enabled = true; });
        localStreamRef.current = stream;
        mediaReadyRef.current = true;
        setLocalStream(new MediaStream(stream.getTracks()));
        return;
      } catch (err: unknown) {
        const e = err as DOMException;
        console.warn('[WebRTC] Camera+mic failed:', e?.name, e?.message);
      }

      // Step 2: try mic only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!isMounted) { audioStream.getTracks().forEach(t => t.stop()); return; }
        audioStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
        localStreamRef.current = audioStream;
        mediaReadyRef.current = true;
        setLocalStream(new MediaStream(audioStream.getTracks()));
        toast('No camera found — joined with audio only', { icon: '🎤' });
        return;
      } catch (err: unknown) {
        const e = err as DOMException;
        console.warn('[WebRTC] Audio-only failed:', e?.name, e?.message);
      }

      // Step 3: try camera only
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        if (!isMounted) { videoStream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = videoStream;
        mediaReadyRef.current = true;
        setLocalStream(new MediaStream(videoStream.getTracks()));
        toast('No microphone found — joined with video only', { icon: '📷' });
        return;
      } catch (err: unknown) {
        const e = err as DOMException;
        console.warn('[WebRTC] Video-only failed:', e?.name, e?.message);
      }

      // Step 4: all failed
      if (isMounted) {
        mediaReadyRef.current = true;
        toast(
          '🚫 Camera & mic blocked. In Chrome: click the 🔒 lock icon → allow Camera & Microphone → refresh.',
          { duration: 8000 }
        );
      }
    };
    initMedia();

    return () => {
      isMounted = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(pc => {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.oniceconnectionstatechange = null;
        pc.onconnectionstatechange = null;
        pc.close();
      });
      peersRef.current.clear();
      iceCandidateQueue.current.clear();
      mediaReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // ── Socket signaling ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleUserJoined = ({ socketId }: { socketId: string }) => {
      if (socketId !== socket.id) createPeerConnection(socketId, true);
    };

    const handleSignal = async ({ signal, from }: { signal: any; from: string }) => {
      if (signal.type === 'offer') {
        // Close stale connection if re-offer arrives (e.g. ICE restart)
        if (peersRef.current.has(from)) closePeerConnection(from);
        const pc = createPeerConnection(from, false);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await drainIceCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('meeting:signal', { roomId, to: from, signal: { type: 'answer', sdp: pc.localDescription } });
        } catch (err) { console.error('[WebRTC] Error handling offer:', err); }
      } else if (signal.type === 'answer') {
        const pc = peersRef.current.get(from);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await drainIceCandidates(from, pc);
          } catch {}
        }
      } else if (signal.type === 'candidate') {
        const pc = peersRef.current.get(from);
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
        } else {
          // Queue candidate until remote description is set
          const queue = iceCandidateQueue.current.get(from) ?? [];
          queue.push(signal.candidate);
          iceCandidateQueue.current.set(from, queue);
        }
      }
    };

    const handleUserLeft = ({ socketId }: { socketId: string }) => closePeerConnection(socketId);

    socket.on('meeting:user-joined', handleUserJoined);
    socket.on('meeting:signal', handleSignal);
    socket.on('meeting:user-left', handleUserLeft);
    socket.emit('meeting:join', roomId);

    return () => {
      socket.off('meeting:user-joined', handleUserJoined);
      socket.off('meeting:signal', handleSignal);
      socket.off('meeting:user-left', handleUserLeft);
      socket.emit('meeting:leave', roomId);
    };
  }, [socket, roomId, createPeerConnection, closePeerConnection, drainIceCandidates]);

  // ── Camera toggle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mediaReadyRef.current) return;

    const toggleCamera = async () => {
      if (isVideoOff) {
        const tracks = localStreamRef.current?.getVideoTracks() ?? [];
        tracks.forEach(t => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
        replaceVideoTrackInPeers(null);
        const audio = localStreamRef.current?.getAudioTracks() ?? [];
        setLocalStream(audio.length ? new MediaStream(audio) : null);
      } else {
        try {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const vTrack  = vStream.getVideoTracks()[0];
          if (!vTrack) return;
          if (!localStreamRef.current) localStreamRef.current = new MediaStream();
          localStreamRef.current.addTrack(vTrack);
          replaceVideoTrackInPeers(vTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        } catch {
          toast.error('Could not turn on camera. Check browser permissions.');
        }
      }
      broadcastMediaState(isVideoOff, isMuted);
    };

    toggleCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run on isVideoOff change
  }, [isVideoOff]);

  // ── Mic toggle ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mediaReadyRef.current) return;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    broadcastMediaState(isVideoOff, isMuted);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run on isMuted change
  }, [isMuted]);

  // ── Screen share ──────────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenSharing(false);
    if (socket?.connected && roomId) {
      socket.emit('meeting:screen-share', { roomId, isSharing: false });
    }
    if (localStreamRef.current) {
      replaceVideoTrackInPeers(localStreamRef.current.getVideoTracks()[0] ?? null);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }
  }, [socket, roomId, setScreenSharing, replaceVideoTrackInPeers]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      screenTrack.onended = () => stopScreenShare();

      replaceVideoTrackInPeers(screenTrack);

      const preview = new MediaStream([screenTrack]);
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) preview.addTrack(audioTrack);
      setLocalStream(preview);
      setScreenSharing(true);

      if (socket?.connected && roomId) {
        socket.emit('meeting:screen-share', { roomId, isSharing: true });
      }
    } catch {
      setScreenSharing(false);
    }
  }, [socket, roomId, setScreenSharing, stopScreenShare, replaceVideoTrackInPeers]);

  // ── Clean leave ───────────────────────────────────────────────────────────────

  const stopAllTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peersRef.current.forEach(pc => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });
    peersRef.current.clear();
    iceCandidateQueue.current.clear();
  }, []);

  return { localStreamRef, localStream, remoteStreams, peersRef, startScreenShare, stopScreenShare, stopAllTracks };
};
