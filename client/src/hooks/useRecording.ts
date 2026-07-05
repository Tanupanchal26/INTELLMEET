import { useRef, useCallback, useEffect } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { recordingService } from '../api/recording.api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

const SUPPORTED_MIME = (() => {
  for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
})();

export const useRecording = (
  meetingId: string,
  localStream: MediaStream | null,
  screenStreamRef?: React.RefObject<MediaStream | null>,
) => {
  const isRecording = useMeetingStore((s) => s.isRecording);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const isRecordingRef   = useRef(false);
  const uploadingRef     = useRef(false);

  // ── Build composite stream (screen video + mic audio) ────────────────────
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

  // ── Upload accumulated chunks ─────────────────────────────────────────────
  const doUpload = useCallback(async () => {
    if (chunksRef.current.length === 0 || uploadingRef.current) return;
    const chunks = [...chunksRef.current];
    chunksRef.current = [];
    const blob = new Blob(chunks, { type: SUPPORTED_MIME || 'video/webm' });
    if (blob.size < 1024) return; // skip empty/corrupt blobs

    uploadingRef.current = true;
    const toastId = toast.loading('Uploading recording…');
    try {
      await recordingService.uploadRecording(meetingId, blob);
      toast.success('Recording saved!', { id: toastId });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
      toast.error(`Upload failed: ${msg}`, { id: toastId });
    } finally {
      uploadingRef.current = false;
    }
  }, [meetingId]);

  // ── Create and wire a new MediaRecorder ──────────────────────────────────
  const createRecorder = useCallback((stream: MediaStream): MediaRecorder | null => {
    try {
      const recorder = new MediaRecorder(stream, SUPPORTED_MIME ? { mimeType: SUPPORTED_MIME } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e: any) => {
        console.error('[Recording] MediaRecorder error:', e?.error ?? e);
        // Attempt recovery: stop cleanly so onstop fires and we upload what we have
        if (recorder.state !== 'inactive') recorder.stop();
      };
      return recorder;
    } catch (err) {
      console.error('[Recording] Failed to create MediaRecorder:', err);
      return null;
    }
  }, []);

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    const stream = getRecordingStream();
    if (!stream || stream.getTracks().filter(t => t.readyState === 'live').length === 0) return;

    const recorder = createRecorder(stream);
    if (!recorder) return;

    recorder.onstop = async () => {
      isRecordingRef.current = false;
      // Use setState directly to SET a known value — never toggle, which can
      // cause an extra render cycle if the current value is already correct.
      useMeetingStore.setState({ isRecording: false });
      getSocket()?.emit('recording:stopped', { roomId: meetingId });
      await doUpload();
    };

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    recorder.start(1000);
    isRecordingRef.current = true;
    // SET to true directly — never toggle, avoids double-flip if already true.
    useMeetingStore.setState({ isRecording: true });
    getSocket()?.emit('recording:started', { roomId: meetingId });
  }, [getRecordingStream, createRecorder, meetingId, doUpload]);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        useMeetingStore.setState({ isRecording: false });
      }
      doUpload();
      return;
    }
    // onstop is already wired in startRecording / switchSource
    recorder.requestData();
    recorder.stop();
    mediaRecorderRef.current = null;
  }, [doUpload]);

  // ── Switch source seamlessly (screen ↔ camera) ────────────────────────────
  // Keeps accumulated chunks — no gap in the recording.
  const switchSource = useCallback((newStream: MediaStream) => {
    const old = mediaRecorderRef.current;
    if (!old || old.state === 'inactive') return;

    // Collect final chunk from old recorder without triggering upload
    old.onstop = null;
    old.requestData();
    old.stop();

    const recorder = createRecorder(newStream);
    if (!recorder) return;

    recorder.onstop = async () => {
      isRecordingRef.current = false;
      useMeetingStore.setState({ isRecording: false });
      getSocket()?.emit('recording:stopped', { roomId: meetingId });
      await doUpload();
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    // isRecordingRef stays true — no state flicker
  }, [createRecorder, meetingId, doUpload]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null; // prevent double-upload
        recorder.stop();
      }
    };
  }, []);

  return { startRecording, stopRecording, switchSource, isRecordingRef };
};
