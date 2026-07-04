import { useRef, useCallback } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { recordingService } from '../api/recording.api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

export const useRecording = (
  meetingId: string,
  localStream: MediaStream | null,
  screenStreamRef?: React.RefObject<MediaStream | null>,
) => {
  const { isRecording, toggleRecording, isScreenSharing } = useMeetingStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const getRecordingStream = useCallback((): MediaStream | null => {
    // Prefer screen share stream when active
    if (isScreenSharing && screenStreamRef?.current) {
      // Merge screen video with local audio
      const tracks: MediaStreamTrack[] = [
        ...screenStreamRef.current.getVideoTracks(),
        ...(localStream?.getAudioTracks() ?? []),
      ];
      return tracks.length ? new MediaStream(tracks) : screenStreamRef.current;
    }
    return localStream;
  }, [isScreenSharing, screenStreamRef, localStream]);

  const startRecording = useCallback(async () => {
    const stream = getRecordingStream();
    if (!stream) {
      toast.error('No stream available to record.');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(1000);
    toggleRecording();

    const socket = getSocket();
    if (socket?.connected) socket.emit('recording:started', { roomId: meetingId });
  }, [getRecordingStream, meetingId, toggleRecording]);

  // Switch recording source when screen share starts/stops without interrupting
  const switchSource = useCallback((newStream: MediaStream) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    // Stop current recorder, collect chunks, start new one on new stream
    recorder.onstop = null; // prevent upload on this intermediate stop
    recorder.stop();

    const mimeType = recorder.mimeType || 'video/webm';
    const newRecorder = new MediaRecorder(newStream, { mimeType });
    mediaRecorderRef.current = newRecorder;

    newRecorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };
    newRecorder.start(1000);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      toggleRecording();
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];

      const socket = getSocket();
      if (socket?.connected) socket.emit('recording:stopped', { roomId: meetingId });

      const toastId = toast.loading('Uploading recording...');
      try {
        await recordingService.uploadRecording(meetingId, blob);
        toast.success('Recording saved!', { id: toastId });
      } catch {
        toast.error('Failed to upload recording.', { id: toastId });
      }
    };

    recorder.stop();
  }, [meetingId, toggleRecording]);

  return { startRecording, stopRecording, switchSource };
};
