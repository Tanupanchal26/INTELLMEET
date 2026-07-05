import { useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useAIStore } from '../store/ai/ai.store';
import { aiService } from '../api/ai.api';
import type { ActionItem } from '../api/ai.api';
import toast from 'react-hot-toast';

export const useAI = (meetingId: string) => {
  const { socket } = useSocket();

  // Fine-grained selectors — only re-render when this meeting's specific data changes
  const meetingData        = useAIStore((s) => s.meetingData[meetingId]);
  const transcript         = meetingData?.transcript        ?? '';
  const summary            = meetingData?.summary           ?? '';
  const minutes            = meetingData?.minutes           ?? '';
  const actionItems        = meetingData?.actionItems       ?? [];
  const assistantHistory   = meetingData?.assistantHistory  ?? [];
  const isGenerating       = meetingData?.isGenerating      ?? false;
  const isTranscribing     = meetingData?.isTranscribing    ?? false;
  const isAssistantLoading = meetingData?.isAssistantLoading ?? false;
  const searchResults      = useAIStore((s) => s.searchResults);
  const isSearching        = useAIStore((s) => s.isSearching);

  // ── Socket listeners — scoped to this meetingId ───────────────────────────
  useEffect(() => {
    if (!socket || !meetingId) return;

    const onTranscriptChunk = ({ chunk }: { chunk: string }) =>
      useAIStore.getState().appendTranscript(meetingId, chunk);

    const onSummaryReady = ({ summary: s, actionItems: ai }: { summary: string; actionItems: ActionItem[] }) => {
      useAIStore.getState().setSummary(meetingId, s);
      useAIStore.getState().setActionItems(meetingId, ai);
      useAIStore.getState().setGenerating(meetingId, false);
      toast.success('AI summary ready!');
    };

    const onMinutesReady = ({ minutes: m }: { minutes: string }) => {
      useAIStore.getState().setMinutes(meetingId, m);
      toast.success('Meeting minutes generated!');
    };

    const onProcessing = ({ step }: { step: string }) => {
      useAIStore.getState().setGenerating(meetingId, true);
      toast.loading(`AI is generating ${step}...`, { id: 'ai-processing' });
    };

    const onAIError = ({ message }: { message: string }) => {
      useAIStore.getState().setGenerating(meetingId, false);
      toast.error(message, { id: 'ai-processing' });
    };

    const onAssistantReply = ({ reply }: { reply: string }) => {
      useAIStore.getState().addAssistantMessage(meetingId, { role: 'assistant', content: reply });
      useAIStore.getState().setAssistantLoading(meetingId, false);
    };

    socket.on('meeting:transcript-chunk', onTranscriptChunk);
    socket.on('ai:summary-ready',         onSummaryReady);
    socket.on('ai:minutes-ready',         onMinutesReady);
    socket.on('ai:processing',            onProcessing);
    socket.on('ai:error',                 onAIError);
    socket.on('ai:assistant-reply',       onAssistantReply);

    return () => {
      socket.off('meeting:transcript-chunk', onTranscriptChunk);
      socket.off('ai:summary-ready',         onSummaryReady);
      socket.off('ai:minutes-ready',         onMinutesReady);
      socket.off('ai:processing',            onProcessing);
      socket.off('ai:error',                 onAIError);
      socket.off('ai:assistant-reply',       onAssistantReply);
    };
  }, [socket, meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── REST actions ──────────────────────────────────────────────────────────
  const generateSummary = useCallback(async () => {
    useAIStore.getState().setGenerating(meetingId, true);
    try {
      const { data: tData } = await aiService.getTranscript(meetingId);

      let tx = tData?.transcript?.trim() ?? '';
      if (!tx) {
        const chunks = tData?.allChunks ?? tData?.chunks ?? [];
        if (chunks.length > 0) {
          tx = chunks.map((c: any) => `${c.speaker ?? 'Speaker'}: ${c.text}`).join('\n');
        }
      }
      if (!tx) tx = transcript?.trim() ?? '';

      if (!tx) {
        toast.error('No transcript available yet. Start speaking or enable transcription first.');
        useAIStore.getState().setGenerating(meetingId, false);
        return;
      }

      const res = await aiService.generateSummary(meetingId, tx);
      const s: string = (res as any)?.data?.summary ?? (res as any)?.summary ?? '';

      if (!s) {
        toast.error('Summary generation failed — the AI returned an empty response.');
        useAIStore.getState().setGenerating(meetingId, false);
        return;
      }

      useAIStore.getState().setSummary(meetingId, s);

      aiService.getActionItems(meetingId)
        .then(({ data: ai }) => useAIStore.getState().setActionItems(meetingId, ai.actionItems ?? []))
        .catch(() => {});

      toast.success('Summary generated!');
    } catch (err: any) {
      const raw = err?.response?.data?.message || err?.message || '';
      const msg = raw.includes('429') || raw.includes('quota')
        ? 'AI quota exceeded. Please check your OpenAI billing at platform.openai.com/settings/billing'
        : raw || 'Failed to generate summary';
      toast.error(msg, { duration: 6000 });
    } finally {
      useAIStore.getState().setGenerating(meetingId, false);
    }
  }, [meetingId, transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateMinutes = useCallback(async () => {
    try {
      const res = await aiService.generateMinutes(meetingId);
      const m: string = (res as any)?.data?.minutes ?? (res as any)?.minutes ?? '';
      useAIStore.getState().setMinutes(meetingId, m);
    } catch {
      toast.error('Failed to generate minutes');
    }
  }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendAssistantMessage = useCallback(async (message: string) => {
    useAIStore.getState().addAssistantMessage(meetingId, { role: 'user', content: message });
    useAIStore.getState().setAssistantLoading(meetingId, true);

    if (socket?.connected) {
      const history = assistantHistory.map((m) => ({ role: m.role, content: m.content }));
      socket.emit('ai:assistant-message', { meetingId, message, history });
    } else {
      try {
        const history = assistantHistory.map((m) => ({ role: m.role, content: m.content }));
        const { data } = await aiService.assistantChat(meetingId, message, history);
        useAIStore.getState().addAssistantMessage(meetingId, { role: 'assistant', content: data.reply });
      } catch {
        toast.error('Assistant unavailable');
      } finally {
        useAIStore.getState().setAssistantLoading(meetingId, false);
      }
    }
  }, [socket, meetingId, assistantHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchMeetings = useCallback(async (query: string) => {
    if (!query.trim()) return;
    useAIStore.getState().setSearching(true);
    try {
      const { data } = await aiService.searchMeetings(query);
      useAIStore.getState().setSearchResults(data.results);
    } catch {
      toast.error('Search failed');
    } finally {
      useAIStore.getState().setSearching(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendTranscriptChunk = useCallback((chunk: string) => {
    if (!socket || !chunk.trim()) return;
    socket.emit('meeting:transcript-chunk', { meetingId, chunk });
  }, [socket, meetingId]);

  return {
    transcript, summary, minutes, actionItems, assistantHistory,
    isGenerating, isTranscribing, isAssistantLoading,
    searchResults, isSearching,
    generateSummary, generateMinutes, sendAssistantMessage, searchMeetings, sendTranscriptChunk,
    setSummary:           (s: string)           => useAIStore.getState().setSummary(meetingId, s),
    setMinutes:           (m: string)           => useAIStore.getState().setMinutes(meetingId, m),
    setActionItems:       (items: ActionItem[]) => useAIStore.getState().setActionItems(meetingId, items),
    toggleActionItemDone: (idx: number)         => useAIStore.getState().toggleActionItemDone(meetingId, idx),
    setGenerating:        (v: boolean)          => useAIStore.getState().setGenerating(meetingId, v),
    setTranscribing:      (v: boolean)          => useAIStore.getState().setTranscribing(meetingId, v),
    setAssistantLoading:  (v: boolean)          => useAIStore.getState().setAssistantLoading(meetingId, v),
    clearMeetingAI:       ()                    => useAIStore.getState().clearMeetingAI(meetingId),
  };
};
