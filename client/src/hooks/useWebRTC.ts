import { useEffect, useRef, useState, useCallback } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { getSocket } from '../utils/socket';
import { RTC_CONFIG } from '../utils/webrtc';
import toast from 'react-hot-toast';

interface WebRTCConfig { roomId: string; userId: string; }

export const useWebRTC = ({ roomId, userId }: WebRTCConfig) => {
  const localStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream]    = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  // keyed by remoteSocketId
  const peersRef          = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateQueue = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffers     = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());

  const mediaReadyRef = useRef(false);
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Track whether we are the initiator for each peer (for ICE restart)
  const initiatorMap = useRef<Map<string, boolean>>(new Map());

  // Stable refs so callbacks never go stale
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const { isVideoOff, isMuted, setScreenSharing, setLocalSpeaking } = useMeetingStore();

  // ── Voice Activity Detection ──────────────────────────────────────────────
  const vadRef = useRef<{
    ctx: AudioContext; analyser: AnalyserNode;
    source: MediaStreamAudioSourceNode; interval: ReturnType<typeof setInterval>;
  } | null>(null);
  const speakingRef = useRef(false);

  const startVAD = useCallback((stream: MediaStream) => {
    try {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const interval = setInterval(() => {
        const { isMuted: muted } = useMeetingStore.getState();
        if (muted) {
          if (speakingRef.current) {
            speakingRef.current = false;
            setLocalSpeaking(false);
            getSocket()?.emit('meeting:speaking', { roomId: roomIdRef.current, isSpeaking: false });
          }
          return;
        }
        analyser.getByteFrequencyData(data);
        const avg     = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 12;
        if (speaking !== speakingRef.current) {
          speakingRef.current = speaking;
          setLocalSpeaking(speaking);
          getSocket()?.emit('meeting:speaking', { roomId: roomIdRef.current, isSpeaking: speaking });
        }
      }, 150);
      vadRef.current = { ctx, analyser, source, interval };
    } catch { /* AudioContext not available */ }
  }, [setLocalSpeaking]);

  const stopVAD = useCallback(() => {
    if (!vadRef.current) return;
    clearInterval(vadRef.current.interval);
    vadRef.current.source.disconnect();
    vadRef.current.ctx.close().catch(() => {});
    vadRef.current = null;
    speakingRef.current = false;
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const broadcastMediaState = useCallback((videoOff: boolean, muted: boolean) => {
    const s = getSocket();
    if (s?.connected && roomIdRef.current) {
      const { isScreenSharing } = useMeetingStore.getState();
      s.emit('meeting:media-state', {
        roomId: roomIdRef.current, isMuted: muted, isVideoOff: videoOff, isScreenSharing,
      });
    }
  }, []);

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
    pc.onicecandidate          = null;
    pc.ontrack                 = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    pc.onnegotiationneeded     = null;
    pc.close();
    peersRef.current.delete(remoteSocketId);
    iceCandidateQueue.current.delete(remoteSocketId);
    initiatorMap.current.delete(remoteSocketId);
    pendingOffers.current.delete(remoteSocketId);
    setRemoteStreams(prev => {
      const next = new Map(prev);
      next.delete(remoteSocketId);
      return next;
    });
  }, []);

  // ── Create peer connection ─────────────────────────────────────────────────
  const createPeerConnection = useCallback((remoteSocketId: string, isInitiator: boolean): RTCPeerConnection => {
    // Reuse if healthy
    const existing = peersRef.current.get(remoteSocketId);
    if (existing && existing.connectionState !== 'failed' && existing.connectionState !== 'closed') {
      return existing;
    }
    if (existing) {
      existing.onicecandidate          = null;
      existing.ontrack                 = null;
      existing.oniceconnectionstatechange = null;
      existing.onconnectionstatechange = null;
      existing.onnegotiationneeded     = null;
      existing.close();
      peersRef.current.delete(remoteSocketId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(remoteSocketId, pc);
    initiatorMap.current.set(remoteSocketId, isInitiator);

    // Suppress automatic renegotiation — we manage offer/answer manually
    pc.onnegotiationneeded = null;

    // Add all local tracks immediately so the remote side gets them
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        const cur  = next.get(remoteSocketId);
        if (cur && event.streams[0]) {
          // Add any new tracks to the existing stream object so React refs stay stable
          event.streams[0].getTracks().forEach(t => {
            if (!cur.getTracks().find(x => x.id === t.id)) cur.addTrack(t);
          });
          next.set(remoteSocketId, cur);
        } else {
          next.set(remoteSocketId, stream);
        }
        return next;
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      getSocket()?.emit('meeting:signal', {
        roomId: roomIdRef.current,
        to: remoteSocketId,
        signal: { type: 'candidate', candidate: event.candidate },
      });
    };

    const doIceRestart = () => {
      if (!initiatorMap.current.get(remoteSocketId)) {
        getSocket()?.emit('meeting:signal', {
          roomId: roomIdRef.current, to: remoteSocketId,
          signal: { type: 'restart-request' },
        });
        return;
      }
      pc.createOffer({ iceRestart: true })
        .then(o => pc.setLocalDescription(o))
        .then(() => getSocket()?.emit('meeting:signal', {
          roomId: roomIdRef.current, to: remoteSocketId,
          signal: { type: 'offer', sdp: pc.localDescription },
        }))
        .catch(() => closePeerConnection(remoteSocketId));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') doIceRestart();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') doIceRestart();
        }, 4000);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .then(() => getSocket()?.emit('meeting:signal', {
          roomId: roomIdRef.current, to: remoteSocketId,
          signal: { type: 'offer', sdp: pc.localDescription },
        }))
        .catch(() => {});
    }

    return pc;
  }, [closePeerConnection]);

  // ── Media init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const initMedia = async () => {
      // 1. Try camera + mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        // Apply initial mute state from store
        const { isMuted: initMuted } = useMeetingStore.getState();
        stream.getAudioTracks().forEach(t => { t.enabled = !initMuted; });
        localStreamRef.current = stream;
        mediaReadyRef.current  = true;
        setIsMediaReady(true);
        setLocalStream(new MediaStream(stream.getTracks()));
        startVAD(stream);
        return;
      } catch { /* camera unavailable */ }

      // 2. Audio-only fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        const { isMuted: initMuted } = useMeetingStore.getState();
        stream.getAudioTracks().forEach(t => { t.enabled = !initMuted; });
        localStreamRef.current = stream;
        mediaReadyRef.current  = true;
        setIsMediaReady(true);
        setLocalStream(new MediaStream(stream.getTracks()));
        startVAD(stream);
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
      stopVAD();
      peersRef.current.forEach(pc => {
        pc.onicecandidate          = null;
        pc.ontrack                 = null;
        pc.oniceconnectionstatechange = null;
        pc.onconnectionstatechange = null;
        pc.close();
      });
      peersRef.current.clear();
      iceCandidateQueue.current.clear();
      initiatorMap.current.clear();
      pendingOffers.current.clear();
      mediaReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // ── Socket signaling ──────────────────────────────────────────────────────
  // Only re-runs when roomId or isMediaReady changes.
  // All callbacks are accessed via stable refs to avoid stale closures.

  const createPCRef       = useRef(createPeerConnection);
  const closePCRef        = useRef(closePeerConnection);
  const drainICERef       = useRef(drainIceCandidates);
  useEffect(() => { createPCRef.current = createPeerConnection; }, [createPeerConnection]);
  useEffect(() => { closePCRef.current  = closePeerConnection;  }, [closePeerConnection]);
  useEffect(() => { drainICERef.current = drainIceCandidates;   }, [drainIceCandidates]);

  useEffect(() => {
    if (!roomId || !isMediaReady) return;

    const socket = getSocket();
    if (!socket) return;

    // ── Deterministic initiator: lexicographically larger socket ID initiates.
    // This guarantees exactly one side sends the offer, preventing glare.
    const shouldInitiate = (remoteId: string): boolean => socket.id! > remoteId;

    const handleUserJoined = ({ socketId }: { socketId: string }) => {
      if (socketId === socket.id) return;
      createPCRef.current(socketId, shouldInitiate(socketId));
    };

    // New joiner receives the existing participants list and connects to each
    const handleParticipantsList = (list: { socketId: string }[]) => {
      list.forEach(({ socketId }) => {
        if (!socketId || socketId === socket.id) return;
        createPCRef.current(socketId, shouldInitiate(socketId));
      });
      // Broadcast our media state so existing participants see correct camera/mic
      const { isMuted: m, isVideoOff: v, isScreenSharing: ss } = useMeetingStore.getState();
      socket.emit('meeting:media-state', { roomId, isMuted: m, isVideoOff: v, isScreenSharing: ss });
    };

    const handleSignal = async ({ signal, from }: { signal: any; from: string }) => {
      if (signal.type === 'offer') {
        // Close failed/closed connections before re-creating
        const existing = peersRef.current.get(from);
        if (existing && (existing.connectionState === 'failed' || existing.connectionState === 'closed')) {
          closePCRef.current(from);
        }
        // Get or create — we are NOT the initiator when receiving an offer
        let pc = peersRef.current.get(from);
        if (!pc) pc = createPCRef.current(from, false);

        try {
          // Glare resolution: if we also sent an offer, the lower socket ID yields
          if (pc.signalingState === 'have-local-offer') {
            if (socket.id! < from) {
              // We yield — rollback our offer and accept theirs
              await pc.setLocalDescription({ type: 'rollback' });
            } else {
              // They should yield — ignore their offer
              return;
            }
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await drainICERef.current(from, pc);
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
            await drainICERef.current(from, pc);
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

    const handleUserLeft = ({ socketId }: { socketId: string }) => closePCRef.current(socketId);

    const handleReconnect = () => {
      // Re-join room after socket reconnects (socket.id changes on reconnect)
      socket.emit('meeting:join', roomId);
    };

    socket.on('meeting:user-joined',       handleUserJoined);
    socket.on('meeting:participants-list', handleParticipantsList);
    socket.on('meeting:signal',            handleSignal);
    socket.on('meeting:user-left',         handleUserLeft);
    socket.on('connect',                   handleReconnect);

    // Join the room — server sends meeting:participants-list back to us
    // and broadcasts meeting:user-joined to existing peers
    socket.emit('meeting:join', roomId);

    // Broadcast our initial media state so peers see correct camera/mic immediately
    const { isMuted: m, isVideoOff: v, isScreenSharing: ss } = useMeetingStore.getState();
    socket.emit('meeting:media-state', { roomId, isMuted: m, isVideoOff: v, isScreenSharing: ss });

    return () => {
      socket.off('meeting:user-joined',       handleUserJoined);
      socket.off('meeting:participants-list', handleParticipantsList);
      socket.off('meeting:signal',            handleSignal);
      socket.off('meeting:user-left',         handleUserLeft);
      socket.off('connect',                   handleReconnect);
      socket.emit('meeting:leave', roomId);
      peersRef.current.forEach((_, id) => closePCRef.current(id));
    };
  // Only re-run when roomId or media readiness changes — NOT on callback identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isMediaReady]);

  // ── Camera toggle ─────────────────────────────────────────────────────────
  const prevVideoOff = useRef<boolean | null>(null);
  useEffect(() => {
    if (!mediaReadyRef.current) return;
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
    if (s?.connected && roomIdRef.current) {
      s.emit('meeting:screen-share', { roomId: roomIdRef.current, isSharing: false });
      s.emit('meeting:media-state', {
        roomId: roomIdRef.current,
        isMuted: useMeetingStore.getState().isMuted,
        isVideoOff: useMeetingStore.getState().isVideoOff,
        isScreenSharing: false,
      });
    }

    // Restore camera track
    const { isVideoOff: vOff } = useMeetingStore.getState();
    if (!vOff) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(vStream => {
          const vTrack = vStream.getVideoTracks()[0];
          if (!localStreamRef.current) localStreamRef.current = new MediaStream();
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
      localStreamRef.current?.getVideoTracks().forEach(t => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      replaceVideoTrackInPeers(null);
      setLocalStream(new MediaStream(localStreamRef.current?.getTracks() ?? []));
    }
  }, [setScreenSharing, replaceVideoTrackInPeers]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, displaySurface: 'monitor' } as any,
        audio: false,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) { screenStream.getTracks().forEach(t => t.stop()); return; }

      screenTrack.onended = () => stopScreenShare();

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
      if (s?.connected && roomIdRef.current) {
        s.emit('meeting:screen-share', { roomId: roomIdRef.current, isSharing: true });
        s.emit('meeting:media-state', {
          roomId: roomIdRef.current,
          isMuted: useMeetingStore.getState().isMuted,
          isVideoOff: useMeetingStore.getState().isVideoOff,
          isScreenSharing: true,
        });
      }
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        toast.error('Screen sharing failed. Please try again.');
      }
      setScreenSharing(false);
    }
  }, [setScreenSharing, stopScreenShare, replaceVideoTrackInPeers]);

  // ── Clean leave ───────────────────────────────────────────────────────────
  const stopAllTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    stopVAD();
    peersRef.current.forEach((_, id) => closePeerConnection(id));
  }, [closePeerConnection, stopVAD]);

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
