import { useEffect } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useSocket } from './useSocket';
import { meetingService } from '../api/meeting.api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants';
import { getSocket } from '../utils/socket';

/** Strip control characters to prevent log/XSS injection from socket payloads */
const sanitize = (v: unknown): string =>
  String(v ?? '').replace(/[\r\n\t\x00-\x1f\x7f<>"'`]/g, '_').slice(0, 256);

export const useMeeting = (roomId?: string) => {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { addParticipant, removeParticipant, setInCall, resetMeeting, updateParticipant, setParticipants } = useMeetingStore();
  const { appendTranscript } = useAIStore();

  useEffect(() => {
    if (!socket || !roomId) return;

    const onUserJoined  = (data: any) => addParticipant({
      id:       sanitize(data?.user?.id   ?? data?.id),
      name:     sanitize(data?.user?.name ?? data?.name ?? 'Unknown'),
      avatar:   data?.user?.avatar ?? data?.avatar,
      socketId: sanitize(data?.socketId),
      isMuted:    Boolean(data?.isMuted),
      isVideoOff: Boolean(data?.isVideoOff ?? true),
      isScreenSharing: Boolean(data?.isScreenSharing),
      isHost:   Boolean(data?.isHost),
    });
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
      setParticipants(list.map(p => ({
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
      toast('Meeting has ended.', { icon: '🔴', duration: 4000 });
      navigate(ROUTES.LOBBY);
    };

    socket.on('meeting:user-joined',  onUserJoined);
    socket.on('meeting:user-left',    onUserLeft);
    socket.on('ai:transcript',        onTranscript);
    socket.on('meeting:media-state',  onMediaState);
    socket.on('meeting:raise-hand',   onRaiseHand);
    socket.on('meeting:participants-list', onParticipantsList);
    socket.on('meeting:ended-by-host', onMeetingEndedByHost);
    setInCall(true);

    return () => {
      socket.off('meeting:user-joined',  onUserJoined);
      socket.off('meeting:user-left',    onUserLeft);
      socket.off('ai:transcript',        onTranscript);
      socket.off('meeting:media-state',  onMediaState);
      socket.off('meeting:raise-hand',   onRaiseHand);
      socket.off('meeting:participants-list', onParticipantsList);
      socket.off('meeting:ended-by-host', onMeetingEndedByHost);
    };
  }, [socket, roomId, addParticipant, removeParticipant, setInCall, appendTranscript, updateParticipant, resetMeeting, navigate]);

  const leaveMeeting = async (meetingId?: string) => {
    socket?.emit('meeting:leave', roomId);
    if (meetingId) await meetingService.end(meetingId).catch(() => {});
    resetMeeting();
    toast('You left the meeting', { icon: '👋' });
    navigate(ROUTES.LOBBY);
  };

  const endMeeting = (meetingId?: string) => {
    const s = getSocket();
    if (s?.connected && roomId) {
      s.emit('meeting:end', { roomId });
    }
    if (meetingId) meetingService.end(meetingId).catch(() => {});
  };

  return { leaveMeeting, endMeeting };
};
