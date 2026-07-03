import { useEffect, useRef } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useAppSelector } from './useAppDispatch';
import { getSocket } from '../utils/socket';

export const useTranscription = (meetingId: string) => {
  const { isMuted } = useMeetingStore();
  const { setTranscribing, appendTranscript } = useAIStore();
  const user = useAppSelector((s) => s.auth.user);
  const recognitionRef = useRef<any>(null);
  const socket = getSocket();

  // 1. Capture local speech
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported in this browser.');
      return;
    }

    if (isMuted) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setTranscribing(false);
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setTranscribing(true);
    
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      // Sanitize transcript before emitting — prevents log injection
      const raw = String(event.results[current]?.[0]?.transcript ?? '');
      const chunk = raw.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').trim().slice(0, 2000);
      if (!chunk) return;
      // We do NOT append locally here because the socket will echo it back to us via meeting:transcript-chunk
      if (socket?.connected && meetingId) {
        socket.emit('meeting:transcript-chunk', { meetingId, chunk });
      }
    };

    recognition.onerror = (event: any) => {
      // Sanitize error name before logging to prevent log injection
      const errName = String(event?.error ?? 'unknown').replace(/[\r\n]/g, '_');
      console.error('[SpeechRecognition] error:', errName);
    };
    
    recognition.onend = () => {
      // Auto restart if still unmuted
      if (!useMeetingStore.getState().isMuted) {
        try { recognition.start(); } catch (e) {}
      } else {
        setTranscribing(false);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error(e);
    }

    return () => {
      recognition.onend = null;
      try { recognition.stop(); } catch (e) {}
      setTranscribing(false);
    };
  }, [isMuted, meetingId, socket, setTranscribing]);

  // 2. Listen for network transcripts (from everyone, including ourselves)
  useEffect(() => {
    if (!socket || !meetingId) return;

    const handleChunk = ({ chunk, speaker }: { chunk: string; speaker: string }) => {
      const prefix = speaker === user?.name ? 'You' : speaker;
      appendTranscript(`${prefix}: ${chunk}`);
    };

    socket.on('meeting:transcript-chunk', handleChunk);
    return () => { socket.off('meeting:transcript-chunk', handleChunk); };
  }, [socket, meetingId, user?.name, appendTranscript]);
};
