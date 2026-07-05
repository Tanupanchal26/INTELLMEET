import { useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useAppSelector } from './useAppDispatch';
import { getSocket } from '../utils/socket';
import axios from 'axios';

const AUDIO_CHUNK_MS   = 5000;  // send a Whisper chunk every 5 s
const MIN_AUDIO_BYTES  = 1000;  // skip silent/empty chunks
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export const useTranscription = (meetingId: string) => {
  const isMuted = useMeetingStore((s) => s.isMuted);
  // Read actions directly from getState() so they are never in useCallback deps
  const setTranscribing  = useCallback((v: boolean) => useAIStore.getState().setTranscribing(meetingId, v),  [meetingId]);
  const appendTranscript = useCallback((chunk: string) => useAIStore.getState().appendTranscript(meetingId, chunk), [meetingId]);
  const user   = useAppSelector((s) => s.auth.user);
  const socket = getSocket();

  // ── Whisper audio streaming ──────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushAudio = useCallback(async (mimeType: string) => {
    if (!chunksRef.current.length || !meetingId) return;
    const blob  = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size < MIN_AUDIO_BYTES) return;

    const ext  = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('audio', blob, `chunk.${ext}`);

    try {
      await axios.post(`${API_BASE}/ai/${meetingId}/transcribe-audio`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      // Response is broadcast back via socket — no local append needed here
    } catch {
      // Silent fail — browser SpeechRecognition is the fallback
    }
  }, [meetingId]);

  useEffect(() => {
    if (isMuted || !meetingId) {
      // Stop recorder when muted
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let recorder: MediaRecorder;
    let mimeType = 'audio/webm';

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        // Pick best supported MIME type
        const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'audio/webm';

        recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(1000); // collect data every 1 s

        // Flush to Whisper every AUDIO_CHUNK_MS
        timerRef.current = setInterval(() => {
          if (recorder.state === 'recording') {
            recorder.requestData();
            flushAudio(mimeType);
          }
        }, AUDIO_CHUNK_MS);
      })
      .catch(() => {
        // Microphone access denied — fall through to SpeechRecognition only
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorder?.state === 'recording') recorder.stop();
    };
  }, [isMuted, meetingId, flushAudio]);

  // ── Browser SpeechRecognition (fallback + interim display) ──────────────
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isMuted) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setTranscribing(false);
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = false;
    recognition.lang           = 'en-US';

    recognition.onstart = () => setTranscribing(true);

    recognition.onresult = (event: any) => {
      const raw   = String(event.results[event.resultIndex]?.[0]?.transcript ?? '');
      // eslint-disable-next-line no-control-regex
      const chunk = raw.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').trim().slice(0, 2000);
      if (!chunk) return;
      if (socket?.connected && meetingId) {
        socket.emit('meeting:transcript-chunk', { meetingId, chunk });
      }
    };

    recognition.onerror = (event: any) => {
      const errName = String(event?.error ?? 'unknown').replace(/[\r\n]/g, '_');
      console.error('[SpeechRecognition] error:', errName);
    };

    recognition.onend = () => {
      if (!useMeetingStore.getState().isMuted) {
        try { recognition.start(); } catch (_) {}
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
      try { recognition.stop(); } catch (_) {}
      setTranscribing(false);
    };
  }, [isMuted, meetingId, socket, setTranscribing]);

  // ── Receive transcript chunks from all participants ───────────────────────
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
