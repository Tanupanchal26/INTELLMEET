import { useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '../store/meeting/meeting.store';
import { useAIStore } from '../store/ai/ai.store';
import { useAppSelector } from './useAppDispatch';
import { getSocket } from '../utils/socket';
import axios from 'axios';

const AUDIO_CHUNK_MS  = 5000;  // send a Whisper chunk every 5 s
const MIN_AUDIO_BYTES = 1000;  // skip silent/empty chunks
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export const useTranscription = (meetingId: string) => {
  const isMuted = useMeetingStore((s) => s.isMuted);
  const user    = useAppSelector((s) => s.auth.user);

  const setTranscribing  = useCallback((v: boolean) => useAIStore.getState().setTranscribing(meetingId, v),  [meetingId]);
  const appendTranscript = useCallback((chunk: string) => useAIStore.getState().appendTranscript(meetingId, chunk), [meetingId]);

  // ── Whisper audio streaming ──────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushAudio = useCallback(async (mimeType: string) => {
    if (!chunksRef.current.length || !meetingId) return;
    const blob = new Blob(chunksRef.current, { type: mimeType });
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
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let recorder: MediaRecorder;
    let mimeType = 'audio/webm';
    let capturedStream: MediaStream | null = null;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        capturedStream = stream;
        const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'audio/webm';

        recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(1000);

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
      // Stop all tracks to release the microphone hardware
      capturedStream?.getTracks().forEach(t => t.stop());
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
      const s = getSocket();
      if (s?.connected && meetingId) {
        s.emit('meeting:transcript-chunk', { meetingId, chunk });
      }
    };

    recognition.onerror = (event: any) => {
      const errName = String(event?.error ?? 'unknown').replace(/[\r\n]/g, '_');
      if (errName === 'not-allowed' || errName === 'service-not-allowed') {
        setTranscribing(false);
        recognition.onend = null;
        return;
      }
      console.warn('[SpeechRecognition] error:', errName);
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
    } catch {
      setTranscribing(false);
    }

    return () => {
      recognition.onend = null;
      try { recognition.stop(); } catch (_) {}
      setTranscribing(false);
    };
  }, [isMuted, meetingId, setTranscribing]);

  // ── Receive transcript chunks from all participants ───────────────────────
  // Single effect, single listener registration. Uses getSocket() inside the
  // handler (not as a dep) to avoid re-running when the socket reconnects.
  useEffect(() => {
    if (!meetingId) return;
    const socket = getSocket();
    if (!socket) return;

    const handleChunk = ({ chunk, speaker }: { chunk: string; speaker: string }) => {
      const prefix = speaker === user?.name ? 'You' : speaker;
      appendTranscript(`${prefix}: ${chunk}`);
    };

    socket.on('meeting:transcript-chunk', handleChunk);
    return () => { socket.off('meeting:transcript-chunk', handleChunk); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, user?.name, appendTranscript]);
};
