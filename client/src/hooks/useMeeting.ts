import { useEffect } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useSocket } from './useSocket';
import { meetingService } from '../api/meeting.api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { getSocket } from '../utils/socket';
import { useQueryClient } from '@tanstack/react-query';

/** Strip control characters to prevent log/XSS injection from socket payloads */
const sanitize = (v: unknown): string =>
  // eslint-disable-next-line no-control-regex
  String(v ?? '').replace(/[\r\n\t\x00-\x1f\x7f<>"'`]/g, '_').slice(0, 256);

export const useMeeting = (roomId?: string, onBeforeLeave?: () => void) => {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addParticipant, removeParticipant, setInCall, resetMeeting, updateParticipant, setParticipants } = useMeetingStore();
  const { appendTranscript } = useAIStore();

  useEffect(() => {
    if (!socket || !roomId) return;

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
        isVideoOff: Boolean(data?.isVideoOff ?? true),
        isScreenSharing: Boolean(data?.isScreenSharing),
        isHost,
      });
    };
    const onUserLeft    = ({ socketId }: any)   => removeParticipant(sanitize(socketId));
    const onTranscript  = (chunk: string)       => appendTranscript(sanitize(chunk));
    const onMediaState  = ({ socketId, isMuted, isVideoOff, isScreenSharing }: any) =>
      updateParticipant(sanitize(socketId), {
        isMuted:         Boolean(isMuted),
        isVideoOff:      Boolean(isVideoOff),
        isScreenSharing: Boolean(isScreenSharing),
      });
    const onRaiseHand   = (_data: any) => { /* visual-only; no store mutation needed */ };
    const onParticipantsList = (list: any[]) => {
      // Filter out our own socket — the local tile is rendered separately
      const others = (list ?? []).filter(p => p.socketId !== socket.id);
      setParticipants(others.map(p => ({
        id: sanitize(p.id),
        name: sanitize(p.name),
        avatar: p.avatar,
        socketId: sanitize(p.socketId),
        isMuted: Boolean(p.isMuted),
        isVideoOff: Boolean(p.isVideoOff),
        isScreenSharing: Boolean(p.isScreenSharing),
        isHost: Boolean(p.isHost),
      })));
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

    const onMeetingError = ({ message }: { message: string }) => {
      toast.error(message || 'A meeting error occurred.');
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
    socket.on('meeting:participants-list', onParticipantsList);
    socket.on('meeting:ended-by-host', onMeetingEndedByHost);
    socket.on('meeting:force-end',    onForceEnd);
    socket.on('meeting:error',        onMeetingError);
    socket.on('connect',              onReconnect);
    setInCall(true);

    return () => {
      socket.off('meeting:user-joined',  onUserJoined);
      socket.off('meeting:user-left',    onUserLeft);
      socket.off('ai:transcript',        onTranscript);
      socket.off('meeting:media-state',  onMediaState);
      socket.off('meeting:raise-hand',   onRaiseHand);
      socket.off('meeting:participants-list', onParticipantsList);
      socket.off('meeting:ended-by-host', onMeetingEndedByHost);
      socket.off('meeting:force-end',    onForceEnd);
      socket.off('meeting:error',        onMeetingError);
      socket.off('connect',              onReconnect);
    };
  }, [socket, roomId, addParticipant, removeParticipant, setInCall, setParticipants, appendTranscript, updateParticipant, resetMeeting, navigate, qc]);

  const leaveMeeting = async (_meetingId?: string) => {
    // Only leave the socket room — do NOT call meetingService.end() which would
    // mark the meeting as ended for everyone when a participant simply leaves.
    socket?.emit('meeting:leave', roomId);
    resetMeeting();
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['meetings'] });
    toast('You left the meeting', { icon: '👋' });
    navigate(ROUTES.LOBBY);
  };

  const endMeeting = async (meetingId: string) => {
    // Emit meeting:end (host-only termination) — NOT meeting:ended (AI pipeline).
    // The server meeting:end handler updates DB status, closes the room, and
    // broadcasts meeting:ended-by-host to all participants.
    const { currentMeeting } = useMeetingStore.getState();
    socket?.emit('meeting:end', { roomId: currentMeeting?.roomId ?? roomId });
    // Also call REST so status is persisted even if socket ack is missed
    await meetingService.end(meetingId).catch(() => {});
    resetMeeting();
    toast('Meeting ended', { icon: '🔴' });
    navigate(ROUTES.LOBBY);
  };

  return { leaveMeeting, endMeeting };
};
