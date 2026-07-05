import { useEffect } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { meetingService } from '../api/meeting.api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { getSocket } from '../utils/socket';

/** Strip control characters to prevent log/XSS injection from socket payloads */
const sanitize = (v: unknown): string =>
  // eslint-disable-next-line no-control-regex
  String(v ?? '').replace(/[\r\n\t\x00-\x1f\x7f<>"'`]/g, '_').slice(0, 256);

export const useMeeting = (roomId?: string, onBeforeLeave?: () => void) => {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket || !roomId) return;
    const { addParticipant, removeParticipant, setInCall, resetMeeting, updateParticipant, setParticipants, setHandRaised, addReaction, removeReaction } = useMeetingStore.getState();
    const { appendTranscript } = useAIStore.getState();

    const onUserJoined  = (data: any) => {
      // Never add ourselves — the local tile is rendered separately
      if (data?.socketId === socket.id) return;
      // Prefer server-sent isHost; fall back to comparing against currentMeeting.host
      // Use a getter so we always read the latest value even if currentMeeting was set
      // after this handler was registered.
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
        // Default camera to ON (false = not off) — real state arrives via meeting:media-state
        isVideoOff: data?.isVideoOff != null ? Boolean(data.isVideoOff) : false,
        isScreenSharing: Boolean(data?.isScreenSharing),
        isHost,
      });
    };
    const onUserLeft    = ({ socketId }: any)   => removeParticipant(sanitize(socketId));
    const onTranscript  = (chunk: string)       => appendTranscript(roomId, sanitize(chunk));
    const onMediaState  = ({ socketId, isMuted, isVideoOff, isScreenSharing }: any) =>
      updateParticipant(sanitize(socketId), {
        isMuted:         Boolean(isMuted),
        isVideoOff:      Boolean(isVideoOff),
        isScreenSharing: Boolean(isScreenSharing),
      });
    const onRaiseHand = ({ socketId, userId, name, raised }: any) => {
      setHandRaised(sanitize(socketId), Boolean(raised));
      updateParticipant(sanitize(socketId), { handRaised: Boolean(raised) });
      // One-time host-only toast — NOT a chat message, NOT a notification
      // Only the host sees "✋ X raised their hand"; everyone else just sees the tile badge
      if (raised && sanitize(socketId) !== socket.id) {
        const { currentMeeting, participants } = useMeetingStore.getState();
        // Determine if the current client is the host by checking if any local participant
        // entry has isHost=true, or by matching currentMeeting.host against the local user.
        // We use participants list: the local user is NOT in participants (filtered out),
        // so we check currentMeeting.host against the userId of the raiser — if they differ
        // and the current user IS the host, show the toast.
        const localIsHost = currentMeeting?.host
          ? !participants.some(p => p.id === currentMeeting.host) // host is not in remote list = local user is host
          : false;
        if (localIsHost) {
          toast(`✋ ${sanitize(name)} raised their hand`, {
            duration: 3000,
            position: 'top-right',
            style: { fontSize: '13px' },
          });
        }
      }
    };
    const onReaction = ({ socketId, userId, name, emoji }: any) => {
      const id = `${sanitize(socketId)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addReaction({
        id,
        socketId: sanitize(socketId),
        userId: sanitize(userId),
        name: sanitize(name),
        emoji: sanitize(emoji),
      });
      // Auto-remove after 3 seconds — reaction is ephemeral, never persisted
      setTimeout(() => removeReaction(id), 3000);
    };
    const onSpeaking    = ({ socketId, isSpeaking }: any) =>
      updateParticipant(sanitize(socketId), { isSpeaking: Boolean(isSpeaking) });
    const onParticipantsList = (list: any[]) => {
      // Filter out our own socket — the local tile is rendered separately
      const others = (list ?? []).filter(p => p.socketId !== socket.id);
      // Preserve existing handRaised state — the participants-list snapshot doesn't include it
      const { participants: current } = useMeetingStore.getState();
      setParticipants(others.map(p => {
        const existing = current.find(c => c.socketId === p.socketId);
        return {
          id: sanitize(p.id),
          name: sanitize(p.name),
          avatar: p.avatar,
          socketId: sanitize(p.socketId),
          isMuted: Boolean(p.isMuted),
          isVideoOff: Boolean(p.isVideoOff),
          isScreenSharing: Boolean(p.isScreenSharing),
          isHost: Boolean(p.isHost),
          handRaised: existing?.handRaised ?? Boolean(p.handRaised),
        };
      }));
    };
    const onMeetingEndedByHost = () => {
      resetMeeting();
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Meeting has ended.', { icon: '🔴', duration: 4000 });
      navigate(ROUTES.LOBBY);
    };

    const onForceEnd = () => {
      resetMeeting();
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Meeting has ended.', { icon: '🔴', duration: 4000 });
      navigate(ROUTES.LOBBY);
    };

    const onDashboardRefresh = () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    };

    const onMeetingError = ({ message }: { message: string }) => {
      toast.error(message || 'A meeting error occurred.');
    };

    // When a new participant joins, re-broadcast our media state so they see correct camera/mic
    const onRequestMediaState = ({ socketId: _requesterId }: { socketId: string }) => {
      const s = getSocket();
      if (!s?.connected || !roomId) return;
      const { isMuted: m, isVideoOff: v, isScreenSharing: ss } = useMeetingStore.getState();
      s.emit('meeting:media-state', { roomId, isMuted: m, isVideoOff: v, isScreenSharing: ss });
    };

    // Re-register listeners and re-emit join after socket reconnects
    const onReconnect = () => {
      // Socket event listeners survive reconnect on the same socket object,
      // but we need to re-join the room since the server drops us on disconnect.
      // meeting:join is handled by useWebRTC; here we just ensure setInCall stays true.
      setInCall(true);
    };

    socket.on('meeting:user-joined',  onUserJoined);
    socket.on('meeting:user-left',    onUserLeft);
    socket.on('ai:transcript',        onTranscript);
    socket.on('meeting:media-state',  onMediaState);
    socket.on('meeting:raise-hand',   onRaiseHand);
    socket.on('meeting:reaction',      onReaction);
    socket.on('meeting:speaking',     onSpeaking);
    socket.on('meeting:participants-list', onParticipantsList);
    socket.on('meeting:ended-by-host', onMeetingEndedByHost);
    socket.on('meeting:force-end',    onForceEnd);
    socket.on('meeting:error',        onMeetingError);
    socket.on('meeting:request-media-state', onRequestMediaState);
    socket.on('connect',              onReconnect);
    socket.on('dashboard:refresh',    onDashboardRefresh);
    setInCall(true);

    return () => {
      socket.off('meeting:user-joined',  onUserJoined);
      socket.off('meeting:user-left',    onUserLeft);
      socket.off('ai:transcript',        onTranscript);
      socket.off('meeting:media-state',  onMediaState);
      socket.off('meeting:raise-hand',   onRaiseHand);
      socket.off('meeting:reaction',      onReaction);
      socket.off('meeting:speaking',     onSpeaking);
      socket.off('meeting:participants-list', onParticipantsList);
      socket.off('meeting:ended-by-host', onMeetingEndedByHost);
      socket.off('meeting:force-end',    onForceEnd);
      socket.off('meeting:error',        onMeetingError);
      socket.off('meeting:request-media-state', onRequestMediaState);
      socket.off('connect',              onReconnect);
      socket.off('dashboard:refresh',    onDashboardRefresh);
    };
  }, [socket, roomId, navigate, qc]);

  const leaveMeeting = async (meetingId?: string) => {
    onBeforeLeave?.();
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
