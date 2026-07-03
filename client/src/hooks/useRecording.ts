import { useRef } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAppSelector } from './useAppDispatch';
import { recordingService } from '../api/recording.api';
import { getSocket } from '../utils/socket';
import toast from 'react-hot-toast';

export const useRecording = (meetingId: string, localStream: MediaStream | null) => {
  const { isRecording, toggleRecording } = useMeetingStore();
  const user = useAppSelector((s) => s.auth.user);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      if (!localStream) {
        toast.error('No stream available to record.');
        return;
      }

      // 2. Initialize MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(localStream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(1000); // chunk every second
      toggleRecording(); // update global state
      toast.success('Recording started');

      // Broadcast recording state to other participants
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('recording:started', { roomId: meetingId });
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not start recording. Permission denied?');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    mediaRecorderRef.current.onstop = async () => {
      toggleRecording(); // isRecording = false
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];

      // Broadcast recording stopped
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('recording:stopped', { roomId: meetingId });
      }

      await uploadRecording(blob);
    };

    mediaRecorderRef.current.stop();
  };

  const uploadRecording = async (blob: Blob) => {
    const toastId = toast.loading('Uploading recording...');
    try {
      await recordingService.uploadRecording(meetingId, blob);
      toast.success('Recording saved successfully!', { id: toastId });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload recording.', { id: toastId });
    }
  };

  return { startRecording, stopRecording };
};
