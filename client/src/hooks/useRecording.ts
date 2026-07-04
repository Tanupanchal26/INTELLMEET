import { useRef, useCallback, useEffect } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { recordingService } from '../api/recording.api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

export const useRecording = (
  meetingId: string,
  localStream: MediaStream | null,
  screenStreamRef?: React.RefObject<MediaStream | null>,
) => {
  const { isRecording, toggleRecording } = useMeetingStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const isRecordingRef = useRef(false);

  const getRecordingStream = useCallback((): MediaStream | null => {
    const { isScreenSharing } = useMeetingStore.getState();
    if (isScreenSharing && screenStreamRef?.current) {
      const tracks: MediaStreamTrack[] = [
        ...screenStreamRef.current.getVideoTracks(),
        ...(localStream?.getAudioTracks() ?? []),
      ];
      return tracks.length ? new MediaStream(tracks) : screenStreamRef.current;
    }
    return localStream;
  }, [screenStreamRef, localStream]);

  const doUpload = useCallback(async () => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    chunksRef.current = [];
    if (blob.size < 1000) return; // skip empty/corrupt blobs

    const toastId = toast.loading('Uploading recording...');
    try {
      await recordingService.uploadRecording(meetingId, blob);
      toast.success('Recording saved!', { id: toastId });
    } catch (err: any) {
      toast.error(`Upload failed: ${err?.response?.data?.message ?? err?.message ?? 'Unknown error'}`, { id: toastId });
    }
  }, [meetingId]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    const stream = getRecordingStream();
    if (!stream || stream.getTracks().length === 0) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : '';

    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000);
      isRecordingRef.current = true;
      toggleRecording(); // set isRecording = true — safe: guarded by isRecordingRef above

      const socket = getSocket();
      if (socket?.connected) socket.emit('recording:started', { roomId: meetingId });
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
    }
  }, [getRecordingStream, meetingId, toggleRecording]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        toggleRecording(); // set isRecording = false
      }
      doUpload();
      return;
    }

    recorder.onstop = async () => {
      isRecordingRef.current = false;
      toggleRecording(); // set isRecording = false — safe: called exactly once here
      const socket = getSocket();
      if (socket?.connected) socket.emit('recording:stopped', { roomId: meetingId });
      await doUpload();
    };

    // Request final chunk before stopping
    recorder.requestData();
    recorder.stop();
    mediaRecorderRef.current = null;
  }, [meetingId, toggleRecording, doUpload]);

  // Switch recording source (screen share ↔ camera) without losing chunks
  const switchSource = useCallback((newStream: MediaStream) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = null; // don't upload on this intermediate stop
    recorder.requestData();
    recorder.stop();

    const mimeType = recorder.mimeType || 'video/webm';
    try {
      const newRecorder = new MediaRecorder(newStream, { mimeType });
      mediaRecorderRef.current = newRecorder;
      newRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      newRecorder.start(1000);
    } catch (err) {
      console.error('[Recording] Failed to switch source:', err);
    }
  }, []);

  // Cleanup: stop recorder on unmount without uploading twice
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
    };
  }, []);

  return { startRecording, stopRecording, switchSource, isRecordingRef };
};
