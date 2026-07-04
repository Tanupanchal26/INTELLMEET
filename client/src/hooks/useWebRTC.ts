import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { getSocket } from '../utils/socket';
import { RTC_CONFIG } from '../utils/webrtc';
import toast from 'react-hot-toast';

interface WebRTCConfig { roomId: string; userId: string; }

export const useWebRTC = ({ roomId, userId }: WebRTCConfig) => {
  const localStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream]   = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // keyed by remoteSocketId
  const peersRef          = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Prevent camera-toggle effect from firing on first mount
  const mediaReadyRef    = useRef(false);
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Track whether we are the initiator for each peer (for ICE restart)
  const initiatorMap = useRef<Map<string, boolean>>(new Map());

  const { isVideoOff, isMuted, setScreenSharing } = useMeetingStore();

  // ── Helpers ──────────────────────────────────────────────────────────────

  const broadcastMediaState = useCallback((videoOff: boolean, muted: boolean) => {
    const s = getSocket();
    if (s?.connected && roomId) {
      s.emit('meeting:media-state', { roomId, isMuted: muted, isVideoOff: videoOff, isScreenSharing: false });
    }
  }, [roomId]);

  // Always-fresh reader so toggle effects don't need isMuted/isVideoOff in their deps
  const getCurrentMediaState = useCallback(() => {
    const { isMuted: m, isVideoOff: v } = useMeetingStore.getState();
    return { isMuted: m, isVideoOff: v };
  }, []);

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

  const drainIceCandidates = useCallback(async (remoteSocketId: string, pc: RTCPeerConnection) => {
    const queued = iceCandidateQueue.current.get(remoteSocketId) ?? [];
    iceCandidateQueue.current.delete(remoteSocketId);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }, []);

  const closePeerConnection = useCallback((remoteSocketId: string) => {
    const pc = peersRef.current.get(remoteSocketId);
    if (!pc) return;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    pc.close();
    peersRef.current.delete(remoteSocketId);
    iceCandidateQueue.current.delete(remoteSocketId);
    initiatorMap.current.delete(remoteSocketId);
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(remoteSocketId);
      return next;
    });
  }, []);

  // ── Create peer connection ────────────────────────────────────────────────
  // NOTE: does NOT close existing — caller must call closePeerConnection first if re-creating.

  const createPeerConnection = useCallback((remoteSocketId: string, isInitiator: boolean): RTCPeerConnection => {
    // Deduplicate: if a connection already exists and is not failed/closed, reuse it
    const existing = peersRef.current.get(remoteSocketId);
    if (existing && existing.connectionState !== 'failed' && existing.connectionState !== 'closed') {
      return existing;
    }
    if (existing) {
      existing.onicecandidate = null;
      existing.ontrack = null;
      existing.oniceconnectionstatechange = null;
      existing.onconnectionstatechange = null;
      existing.close();
      peersRef.current.delete(remoteSocketId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(remoteSocketId, pc);
    initiatorMap.current.set(remoteSocketId, isInitiator);

    // Suppress automatic renegotiation — we manage offer/answer manually
    pc.onnegotiationneeded = null;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(remoteSocketId, stream);
        return next;
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      getSocket()?.emit('meeting:signal', {
        roomId,
        to: remoteSocketId,
        signal: { type: 'candidate', candidate: event.candidate },
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed') {
        // Both sides attempt ICE restart — initiator sends new offer
        if (initiatorMap.current.get(remoteSocketId)) {
          pc.createOffer({ iceRestart: true })
            .then(o => pc.setLocalDescription(o))
            .then(() => getSocket()?.emit('meeting:signal', {
              roomId, to: remoteSocketId,
              signal: { type: 'offer', sdp: pc.localDescription },
            }))
            .catch(() => closePeerConnection(remoteSocketId));
        } else {
          // Non-initiator: signal the initiator to restart
          getSocket()?.emit('meeting:signal', {
            roomId, to: remoteSocketId,
            signal: { type: 'restart-request' },
          });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        // Give 4 s for transient disconnection before restarting
        setTimeout(() => {
          if (pc.iceConnectionState !== 'disconnected') return;
          if (initiatorMap.current.get(remoteSocketId)) {
            pc.createOffer({ iceRestart: true })
              .then(o => pc.setLocalDescription(o))
              .then(() => getSocket()?.emit('meeting:signal', {
                roomId, to: remoteSocketId,
                signal: { type: 'offer', sdp: pc.localDescription },
              }))
              .catch(() => {});
          }
        }, 4000);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => getSocket()?.emit('meeting:signal', {
          roomId, to: remoteSocketId,
          signal: { type: 'offer', sdp: pc.localDescription },
        }))
        .catch(() => {});
    }

    return pc;
  }, [roomId, closePeerConnection]);

  // ── Media init ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const initMedia = async () => {
      // 1. Try camera + mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
        localStreamRef.current = stream;
        mediaReadyRef.current  = true;
        setIsMediaReady(true);
        setLocalStream(new MediaStream(stream.getTracks()));
        return;
      } catch { /* camera unavailable */ }

      // 2. Audio-only fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
        localStreamRef.current = stream;
        mediaReadyRef.current  = true;
        setIsMediaReady(true);
        setLocalStream(new MediaStream(stream.getTracks()));
        toast('No camera found — joined with audio only', { icon: '🎤' });
        return;
      } catch { /* mic also unavailable */ }

      // 3. No media — still join
      if (!cancelled) {
        mediaReadyRef.current = true;
        setIsMediaReady(true);
        toast('🚫 Camera & mic blocked. Click the 🔒 lock icon → allow Camera & Microphone → refresh.', { duration: 8000 });
      }
    };

    initMedia();

    return () => {
      cancelled = true;
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
      initiatorMap.current.clear();
      mediaReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once — isMuted initial value captured intentionally

  // ── Socket signaling ──────────────────────────────────────────────────────
  // Re-runs when roomId changes or media becomes ready.
  // Uses getSocket() inside handlers (not captured at effect time) so we always
  // have the live socket reference even after reconnects.

  useEffect(() => {
    if (!roomId || !isMediaReady) return;

    const socket = getSocket();
    if (!socket) return;

    const handleUserJoined = ({ socketId }: { socketId: string }) => {
      if (socketId === socket.id) return;
      createPeerConnection(socketId, true);
    };

    const handleSignal = async ({ signal, from }: { signal: any; from: string }) => {
      if (signal.type === 'offer') {
        // Close any failed/closed existing connection before re-creating
        const existing = peersRef.current.get(from);
        if (existing && (existing.connectionState === 'failed' || existing.connectionState === 'closed')) {
          closePeerConnection(from);
        }
        const pc = peersRef.current.get(from) ?? createPeerConnection(from, false);
        try {
          // Handle offer glare: if we already have a local offer pending, roll back
          if (pc.signalingState === 'have-local-offer') {
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await drainIceCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('meeting:signal', {
            roomId, to: from,
            signal: { type: 'answer', sdp: pc.localDescription },
          });
        } catch (err) {
          console.error('[WebRTC] offer handling error:', err);
        }
      } else if (signal.type === 'answer') {
        const pc = peersRef.current.get(from);
        if (!pc) return;
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await drainIceCandidates(from, pc);
          }
        } catch {}
      } else if (signal.type === 'candidate') {
        const pc = peersRef.current.get(from);
        if (pc?.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
        } else {
          const queue = iceCandidateQueue.current.get(from) ?? [];
          queue.push(signal.candidate);
          iceCandidateQueue.current.set(from, queue);
        }
      } else if (signal.type === 'restart-request') {
        // Non-initiator asked us to restart — we are the initiator
        const pc = peersRef.current.get(from);
        if (pc) {
          pc.createOffer({ iceRestart: true })
            .then(o => pc.setLocalDescription(o))
            .then(() => socket.emit('meeting:signal', {
              roomId, to: from,
              signal: { type: 'offer', sdp: pc.localDescription },
            }))
            .catch(() => {});
        }
      }
    };

    const handleUserLeft = ({ socketId }: { socketId: string }) => closePeerConnection(socketId);

    const handleReconnect = () => {
      // Re-join room after socket reconnects (socket.id changes on reconnect)
      socket.emit('meeting:join', roomId);
    };

    socket.on('meeting:user-joined', handleUserJoined);
    socket.on('meeting:signal',      handleSignal);
    socket.on('meeting:user-left',   handleUserLeft);
    socket.on('connect',             handleReconnect);

    // Join the room — server will broadcast meeting:user-joined to existing peers
    // and send back meeting:participants-list to us
    socket.emit('meeting:join', roomId);

    return () => {
      socket.off('meeting:user-joined', handleUserJoined);
      socket.off('meeting:signal',      handleSignal);
      socket.off('meeting:user-left',   handleUserLeft);
      socket.off('connect',             handleReconnect);
      socket.emit('meeting:leave', roomId);
      // Close all peer connections on room leave
      peersRef.current.forEach((pc, id) => closePeerConnection(id));
    };
  }, [roomId, isMediaReady, createPeerConnection, closePeerConnection, drainIceCandidates]);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  // Guard with mediaReadyRef so this doesn't fire on mount before media is acquired

  const prevVideoOff = useRef<boolean | null>(null);
  useEffect(() => {
    if (!mediaReadyRef.current) return;
    // Skip the very first run after media is ready (state hasn't changed)
    if (prevVideoOff.current === null) { prevVideoOff.current = isVideoOff; return; }
    if (prevVideoOff.current === isVideoOff) return;
    prevVideoOff.current = isVideoOff;

    const toggleCamera = async () => {
      if (isVideoOff) {
        localStreamRef.current?.getVideoTracks().forEach(t => {
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
      broadcastMediaState(isVideoOff, getCurrentMediaState().isMuted);
    };

    toggleCamera();
  }, [isVideoOff, broadcastMediaState, getCurrentMediaState, replaceVideoTrackInPeers]);

  // ── Mic toggle ────────────────────────────────────────────────────────────

  const prevMuted = useRef<boolean | null>(null);
  useEffect(() => {
    if (!mediaReadyRef.current) return;
    if (prevMuted.current === null) { prevMuted.current = isMuted; return; }
    if (prevMuted.current === isMuted) return;
    prevMuted.current = isMuted;

    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    broadcastMediaState(getCurrentMediaState().isVideoOff, isMuted);
  }, [isMuted, broadcastMediaState, getCurrentMediaState]);

  // ── Screen share ──────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenSharing(false);
    const s = getSocket();
    if (s?.connected && roomId) s.emit('meeting:screen-share', { roomId, isSharing: false });

    // Restore camera track
    if (!isVideoOff) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(vStream => {
          const vTrack = vStream.getVideoTracks()[0];
          if (!localStreamRef.current) localStreamRef.current = new MediaStream();
          // Remove any existing video tracks first
          localStreamRef.current.getVideoTracks().forEach(t => {
            t.stop();
            localStreamRef.current!.removeTrack(t);
          });
          localStreamRef.current.addTrack(vTrack);
          replaceVideoTrackInPeers(vTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        })
        .catch(() => {
          replaceVideoTrackInPeers(null);
          setLocalStream(new MediaStream(localStreamRef.current?.getAudioTracks() ?? []));
        });
    } else {
      // Remove screen track, keep audio
      localStreamRef.current?.getVideoTracks().forEach(t => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      replaceVideoTrackInPeers(null);
      setLocalStream(new MediaStream(localStreamRef.current?.getTracks() ?? []));
    }
  }, [roomId, setScreenSharing, replaceVideoTrackInPeers, isVideoOff]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => stopScreenShare();

      // Replace camera track with screen track in all peers
      replaceVideoTrackInPeers(screenTrack);

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => {
          t.stop();
          localStreamRef.current!.removeTrack(t);
        });
        localStreamRef.current.addTrack(screenTrack);
      } else {
        localStreamRef.current = new MediaStream([screenTrack]);
      }

      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setScreenSharing(true);
      const s = getSocket();
      if (s?.connected && roomId) s.emit('meeting:screen-share', { roomId, isSharing: true });
    } catch {
      setScreenSharing(false);
    }
  }, [roomId, setScreenSharing, stopScreenShare, replaceVideoTrackInPeers]);

  // ── Clean leave ───────────────────────────────────────────────────────────

  const stopAllTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peersRef.current.forEach((_, id) => closePeerConnection(id));
  }, [closePeerConnection]);

  return {
    localStreamRef,
    localStream,
    remoteStreams,
    peersRef,
    screenStreamRef,
    startScreenShare,
    stopScreenShare,
    stopAllTracks,
  };
};
