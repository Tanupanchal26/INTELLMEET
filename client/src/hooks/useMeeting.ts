import { useEffect, useRef } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useQueryClient } from '@tanstack/react-query';
import { meetingService } from '../api/meeting.api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';

/** Strip control characters to prevent log/XSS injection from socket payloads */
const sanitize = (v: unknown): string =>
  // eslint-disable-next-line no-control-regex
  String(v ?? '').replace(/[\r\n\t\x00-\x1f\x7f<>"'`]/g, '_').slice(0, 256);

export const useMeeting = (roomId?: string, onBeforeLeave?: () => void) => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Keep navigate and qc in refs so the effect never needs to re-run when
  // they change identity (navigate is stable from react-router but qc can
  // theoretically change if QueryClientProvider remounts).
  const navigateRef = useRef(navigate);
  const qcRef = useRef(qc);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { qcRef.current = qc; }, [qc]);

  const onBeforeLeaveRef = useRef(onBeforeLeave);
  useEffect(() => { onBeforeLeaveRef.current = onBeforeLeave; }, [onBeforeLeave]);

  const onBeforeLeaveStable = useCallback(() => onBeforeLeaveRef.current?.(), []);

  useEffect(() => {
    // Read the socket inside the effect — getSocket() returns the singleton,
    // never a new reference. This removes socket from the dep array entirely,
    // which was the primary risk of the effect re-running unexpectedly.
    const socket = getSocket();
    if (!socket || !roomId) return;

    const {
      addParticipant, removeParticipant, setInCall, resetMeeting,
      updateParticipant, setParticipants, setHandRaised, addReaction, removeReaction,
    } = useMeetingStore.getState();
    const { appendTranscript } = useAIStore.getState();

    const onUserJoined = (data: any) => {
      if (data?.socketId === socket.id) return;
      const userId = data?.user?.id ?? data?.id;
      const { currentMeeting } = useMeetingStore.getState();
      const isHost = currentMeeting?.host
        ? userId === currentMeeting.host
        : Boolean(data?.isHost);
      addParticipant({
        id:       sanitize(userId),
        name:     sanitize(data?.user?.name ?? data?.name ?? 'Unknown'),
        avatar:   data?.user?.avatar ?? data?.avatar,
        socketId: sanitize(data?.socketId),
        isMuted:    Boolean(data?.isMuted),
        isVideoOff: data?.isVideoOff != null ? Boolean(data.isVideoOff) : false,
        isScreenSharing: Boolean(data?.isScreenSharing),
        isHost,
      });
    };

    const onUserLeft  = ({ socketId }: any) => removeParticipant(sanitize(socketId));
    const onTranscript = (chunk: string)    => appendTranscript(roomId, sanitize(chunk));

    const onMediaState = ({ socketId, isMuted, isVideoOff, isScreenSharing }: any) =>
      updateParticipant(sanitize(socketId), {
        isMuted:         Boolean(isMuted),
        isVideoOff:      Boolean(isVideoOff),
        isScreenSharing: Boolean(isScreenSharing),
      });

    const onRaiseHand = ({ socketId, userId, name, raised }: any) => {
      setHandRaised(sanitize(socketId), Boolean(raised));
      updateParticipant(sanitize(socketId), { handRaised: Boolean(raised) });
      if (raised && sanitize(socketId) !== socket.id) {
        const { currentMeeting, participants } = useMeetingStore.getState();
        const localIsHost = currentMeeting?.host
          ? !participants.some(p => p.id === currentMeeting.host)
          : false;
        if (localIsHost) {
          toast(`✋ ${sanitize(name)} raised their hand`, {
            duration: 3000, position: 'top-right', style: { fontSize: '13px' },
          });
        }
      }
    };

    const onReaction = ({ socketId, userId, name, emoji }: any) => {
      const id = `${sanitize(socketId)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addReaction({
        id,
        socketId: sanitize(socketId),
        userId:   sanitize(userId),
        name:     sanitize(name),
        emoji:    sanitize(emoji),
      });
      setTimeout(() => removeReaction(id), 3000);
    };

    const onSpeaking = ({ socketId, isSpeaking }: any) =>
      updateParticipant(sanitize(socketId), { isSpeaking: Boolean(isSpeaking) });

    const onParticipantsList = (list: any[]) => {
      const others = (list ?? []).filter(p => p.socketId !== socket.id);
      const { participants: current } = useMeetingStore.getState();
      const mapped = others.map(p => {
        const existing = current.find(c => c.socketId === p.socketId);
        return {
          id:              sanitize(p.id),
          name:            sanitize(p.name),
          avatar:          p.avatar,
          socketId:        sanitize(p.socketId),
          isMuted:         Boolean(p.isMuted),
          isVideoOff:      Boolean(p.isVideoOff),
          isScreenSharing: Boolean(p.isScreenSharing),
          isHost:          Boolean(p.isHost),
          handRaised:      existing?.handRaised ?? Boolean(p.handRaised),
        };
      });
      // Skip update if participant list is identical — prevents spurious re-renders
      const isSame =
        mapped.length === current.length &&
        mapped.every((p, i) => {
          const c = current[i];
          return c &&
            c.socketId        === p.socketId &&
            c.isMuted         === p.isMuted &&
            c.isVideoOff      === p.isVideoOff &&
            c.isScreenSharing === p.isScreenSharing &&
            c.isHost          === p.isHost;
        });
      if (!isSame) setParticipants(mapped);
    };

    const onMeetingEndedByHost = () => {
      resetMeeting();
      qcRef.current.invalidateQueries({ queryKey: ['dashboard'] });
      qcRef.current.invalidateQueries({ queryKey: ['meetings'] });
      toast('Meeting has ended.', { icon: '🔴', duration: 4000 });
      navigateRef.current(ROUTES.LOBBY);
    };

    const onForceEnd = () => {
      resetMeeting();
      qcRef.current.invalidateQueries({ queryKey: ['dashboard'] });
      qcRef.current.invalidateQueries({ queryKey: ['meetings'] });
      toast('Meeting has ended.', { icon: '🔴', duration: 4000 });
      navigateRef.current(ROUTES.LOBBY);
    };

    const onDashboardRefresh = () => {
      qcRef.current.invalidateQueries({ queryKey: ['dashboard'] });
      qcRef.current.invalidateQueries({ queryKey: ['analytics'] });
    };

    const onMeetingError = ({ message }: { message: string }) => {
      toast.error(message || 'A meeting error occurred.');
    };

    const onRequestMediaState = () => {
      if (!socket.connected || !roomId) return;
      const { isMuted: m, isVideoOff: v, isScreenSharing: ss } = useMeetingStore.getState();
      socket.emit('meeting:media-state', { roomId, isMuted: m, isVideoOff: v, isScreenSharing: ss });
    };

    const onReconnect = () => {
      // Guard: only update store if not already in call — prevents spurious re-renders
      if (!useMeetingStore.getState().isInCall) setInCall(true);
    };

    socket.on('meeting:user-joined',          onUserJoined);
    socket.on('meeting:user-left',            onUserLeft);
    socket.on('ai:transcript',                onTranscript);
    socket.on('meeting:media-state',          onMediaState);
    socket.on('meeting:raise-hand',           onRaiseHand);
    socket.on('meeting:reaction',             onReaction);
    socket.on('meeting:speaking',             onSpeaking);
    socket.on('meeting:participants-list',    onParticipantsList);
    socket.on('meeting:ended-by-host',        onMeetingEndedByHost);
    socket.on('meeting:force-end',            onForceEnd);
    socket.on('meeting:error',                onMeetingError);
    socket.on('meeting:request-media-state',  onRequestMediaState);
    socket.on('connect',                      onReconnect);
    socket.on('dashboard:refresh',            onDashboardRefresh);

    // Guard: only set if not already true — avoids a Zustand notify when value unchanged
    if (!useMeetingStore.getState().isInCall) setInCall(true);

    return () => {
      socket.off('meeting:user-joined',         onUserJoined);
      socket.off('meeting:user-left',           onUserLeft);
      socket.off('ai:transcript',               onTranscript);
      socket.off('meeting:media-state',         onMediaState);
      socket.off('meeting:raise-hand',          onRaiseHand);
      socket.off('meeting:reaction',            onReaction);
      socket.off('meeting:speaking',            onSpeaking);
      socket.off('meeting:participants-list',   onParticipantsList);
      socket.off('meeting:ended-by-host',       onMeetingEndedByHost);
      socket.off('meeting:force-end',           onForceEnd);
      socket.off('meeting:error',               onMeetingError);
      socket.off('meeting:request-media-state', onRequestMediaState);
      socket.off('connect',                     onReconnect);
      socket.off('dashboard:refresh',           onDashboardRefresh);
    };
  // socket is intentionally omitted — we call getSocket() inside the effect.
  // navigate and qc are accessed via stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const leaveMeeting = async (meetingId?: string) => {
    onBeforeLeave?.();
    const socket = getSocket();
    socket?.emit('meeting:leave', roomId);
    const idToClear = meetingId ?? useMeetingStore.getState().currentMeeting?.id;
    if (idToClear) useAIStore.getState().clearMeetingAI(idToClear);
    useMeetingStore.getState().resetMeeting();
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['meetings'] });
    toast('You left the meeting', { icon: '👋' });
    navigate(ROUTES.LOBBY);
  };

  const endMeeting = async (meetingId: string) => {
    onBeforeLeave?.();
    const socket = getSocket();
    const { currentMeeting } = useMeetingStore.getState();
    socket?.emit('meeting:end', { roomId: currentMeeting?.roomId ?? roomId });
    await meetingService.end(meetingId).catch(() => {});
    useAIStore.getState().clearMeetingAI(meetingId);
    useMeetingStore.getState().resetMeeting();
    toast('Meeting ended', { icon: '🔴' });
    navigate(ROUTES.LOBBY);
  };

  return { leaveMeeting, endMeeting };
};
