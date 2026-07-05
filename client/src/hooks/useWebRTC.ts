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

  // ── Stable store action refs ───────────────────────────────────────────────
  // NEVER pull store actions via selector — Zustand returns a new function
  // reference on every render, making every useCallback that depends on them
  // unstable, which cascades into infinite effect re-runs.
  // Access actions directly from getState() inside callbacks instead.

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

  // Read isVideoOff / isMuted via selectors — these are primitive booleans,
  // safe to use as effect deps because Zustand only re-renders when the value changes.
  const isVideoOff = useMeetingStore((s) => s.isVideoOff);
  const isMuted    = useMeetingStore((s) => s.isMuted);

  // ── Stable stream updater ─────────────────────────────────────────────────
  // Only calls setLocalStream when track composition actually changes.
  // Prevents new MediaStream object identity from triggering downstream effects.
  const updateLocalStream = useCallback((next: MediaStream | null) => {
    setLocalStream(prev => {
      if (!next && !prev) return prev;
      if (!next || !prev) return next;
      const prevIds = prev.getTracks().map(t => t.id).sort().join(',');
      const nextIds = next.getTracks().map(t => t.id).sort().join(',');
      return prevIds === nextIds ? prev : next;
    });
  }, []);

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
            useMeetingStore.getState().setLocalSpeaking(false);
            getSocket()?.emit('meeting:speaking', { roomId: roomIdRef.current, isSpeaking: false });
          }
          return;
        }
        analyser.getByteFrequencyData(data);
        const avg     = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 12;
        if (speaking !== speakingRef.current) {
          speakingRef.current = speaking;
          useMeetingStore.getState().setLocalSpeaking(speaking);
          getSocket()?.emit('meeting:speaking', { roomId: roomIdRef.current, isSpeaking: speaking });
        }
      }, 150);
      vadRef.current = { ctx, analyser, source, interval };
    } catch { /* AudioContext not available */ }
  }, []); // no deps — reads store via getState()

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
  }, []); // no deps — reads store via getState()

  const replaceVideoTrackInPeers = useCallback((track: MediaStreamTrack | null) => {
    peersRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(track).catch(() => {});
      } else if (track && localStreamRef.current) {
        pc.addTrack(track, localStreamRef.current);
      }
    });
  }, []); // no deps — reads refs directly

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

    pc.onnegotiationneeded = null;

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
        const { isMuted: initMuted } = useMeetingStore.getState();
        stream.getAudioTracks().forEach(t => { t.enabled = !initMuted; });
        localStreamRef.current = stream;
        mediaReadyRef.current  = true;
        setIsMediaReady(true);
        setLocalStream(stream); // direct set on init — no previous stream to compare
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
        setLocalStream(stream);
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
  const createPCRef  = useRef(createPeerConnection);
  const closePCRef   = useRef(closePeerConnection);
  const drainICERef  = useRef(drainIceCandidates);
  useEffect(() => { createPCRef.current = createPeerConnection; }, [createPeerConnection]);
  useEffect(() => { closePCRef.current  = closePeerConnection;  }, [closePeerConnection]);
  useEffect(() => { drainICERef.current = drainIceCandidates;   }, [drainIceCandidates]);

  const joinedRoomRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId || !isMediaReady) return;

    const socket = getSocket();
    if (!socket) return;

    const shouldInitiate = (remoteId: string): boolean => socket.id! > remoteId;

    const handleUserJoined = ({ socketId }: { socketId: string }) => {
      if (socketId === socket.id) return;
      createPCRef.current(socketId, shouldInitiate(socketId));
    };

    const handleParticipantsList = (list: { socketId: string }[]) => {
      list.forEach(({ socketId }) => {
        if (!socketId || socketId === socket.id) return;
        createPCRef.current(socketId, shouldInitiate(socketId));
      });
      const { isMuted: m, isVideoOff: v, isScreenSharing: ss } = useMeetingStore.getState();
      socket.emit('meeting:media-state', { roomId, isMuted: m, isVideoOff: v, isScreenSharing: ss });
    };

    const handleSignal = async ({ signal, from }: { signal: any; from: string }) => {
      if (signal.type === 'offer') {
        const existing = peersRef.current.get(from);
        if (existing && (existing.connectionState === 'failed' || existing.connectionState === 'closed')) {
          closePCRef.current(from);
        }
        let pc = peersRef.current.get(from);
        if (!pc) pc = createPCRef.current(from, false);

        try {
          if (pc.signalingState === 'have-local-offer') {
            if (socket.id! < from) {
              await pc.setLocalDescription({ type: 'rollback' });
            } else {
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

    const handleUserLeft    = ({ socketId }: { socketId: string }) => closePCRef.current(socketId);
    const handleReconnect   = () => {
      // Only re-join if we were previously in this room
      if (joinedRoomRef.current === roomId) {
        joinedRoomRef.current = null; // reset so the join below is allowed
        socket.emit('meeting:join', roomId);
      }
    };

    socket.on('meeting:user-joined',       handleUserJoined);
    socket.on('meeting:participants-list', handleParticipantsList);
    socket.on('meeting:signal',            handleSignal);
    socket.on('meeting:user-left',         handleUserLeft);
    socket.on('connect',                   handleReconnect);

    // Only emit join once per roomId
    if (joinedRoomRef.current !== roomId) {
      joinedRoomRef.current = roomId;
      socket.emit('meeting:join', roomId);
    }

    const { isMuted: m, isVideoOff: v, isScreenSharing: ss } = useMeetingStore.getState();
    socket.emit('meeting:media-state', { roomId, isMuted: m, isVideoOff: v, isScreenSharing: ss });

    return () => {
      socket.off('meeting:user-joined',       handleUserJoined);
      socket.off('meeting:participants-list', handleParticipantsList);
      socket.off('meeting:signal',            handleSignal);
      socket.off('meeting:user-left',         handleUserLeft);
      socket.off('connect',                   handleReconnect);
      socket.emit('meeting:leave', roomId);
      joinedRoomRef.current = null;
      peersRef.current.forEach((_, id) => closePCRef.current(id));
    };
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
        updateLocalStream(audio.length ? new MediaStream(audio) : null);
      } else {
        try {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const vTrack  = vStream.getVideoTracks()[0];
          if (!vTrack) return;
          if (!localStreamRef.current) localStreamRef.current = new MediaStream();
          localStreamRef.current.addTrack(vTrack);
          replaceVideoTrackInPeers(vTrack);
          updateLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        } catch {
          toast.error('Could not turn on camera. Check browser permissions.');
        }
      }
      const { isMuted: m, isVideoOff: v } = useMeetingStore.getState();
      broadcastMediaState(v, m);
    };

    toggleCamera();
  // replaceVideoTrackInPeers, updateLocalStream, broadcastMediaState are all
  // stable (empty dep arrays) so this effect only re-runs when isVideoOff changes.
  }, [isVideoOff, replaceVideoTrackInPeers, updateLocalStream, broadcastMediaState]);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  const prevMuted = useRef<boolean | null>(null);
  useEffect(() => {
    if (!mediaReadyRef.current) return;
    if (prevMuted.current === null) { prevMuted.current = isMuted; return; }
    if (prevMuted.current === isMuted) return;
    prevMuted.current = isMuted;

    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    const { isMuted: m, isVideoOff: v } = useMeetingStore.getState();
    broadcastMediaState(v, m);
  }, [isMuted, broadcastMediaState]);

  // ── Screen share ──────────────────────────────────────────────────────────
  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    useMeetingStore.getState().setScreenSharing(false);
    const s = getSocket();
    if (s?.connected && roomIdRef.current) {
      s.emit('meeting:screen-share', { roomId: roomIdRef.current, isSharing: false });
      const { isMuted: m, isVideoOff: v } = useMeetingStore.getState();
      s.emit('meeting:media-state', {
        roomId: roomIdRef.current, isMuted: m, isVideoOff: v, isScreenSharing: false,
      });
    }

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
          updateLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        })
        .catch(() => {
          replaceVideoTrackInPeers(null);
          updateLocalStream(new MediaStream(localStreamRef.current?.getAudioTracks() ?? []));
        });
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      replaceVideoTrackInPeers(null);
      updateLocalStream(new MediaStream(localStreamRef.current?.getTracks() ?? []));
    }
  }, [replaceVideoTrackInPeers, updateLocalStream]);

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

      updateLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      useMeetingStore.getState().setScreenSharing(true);
      const s = getSocket();
      if (s?.connected && roomIdRef.current) {
        s.emit('meeting:screen-share', { roomId: roomIdRef.current, isSharing: true });
        const { isMuted: m, isVideoOff: v } = useMeetingStore.getState();
        s.emit('meeting:media-state', {
          roomId: roomIdRef.current, isMuted: m, isVideoOff: v, isScreenSharing: true,
        });
      }
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        toast.error('Screen sharing failed. Please try again.');
      }
      useMeetingStore.getState().setScreenSharing(false);
    }
  }, [stopScreenShare, replaceVideoTrackInPeers, updateLocalStream]);

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
