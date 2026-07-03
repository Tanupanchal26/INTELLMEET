import { useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useAIStore } from '../store/ai/ai.store';
import { aiService } from '../api/ai.api';
import type { ActionItem } from '../api/ai.api';
import toast from 'react-hot-toast';

export const useAI = (meetingId: string) => {
  const { socket } = useSocket();
  const store = useAIStore();

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !meetingId) return;

    const onTranscriptChunk = ({ chunk }: { chunk: string }) => store.appendTranscript(chunk);
    const onSummaryReady = ({ summary, actionItems }: { summary: string; actionItems: ActionItem[] }) => {
      store.setSummary(summary);
      store.setActionItems(actionItems);
      store.setGenerating(false);
      toast.success('AI summary ready!');
    };
    const onMinutesReady = ({ minutes }: { minutes: string }) => {
      store.setMinutes(minutes);
      toast.success('Meeting minutes generated!');
    };
    const onProcessing = ({ step }: { step: string }) => {
      store.setGenerating(true);
      toast.loading(`AI is generating ${step}...`, { id: 'ai-processing' });
    };
    const onAIError = ({ message }: { message: string }) => {
      store.setGenerating(false);
      toast.error(message, { id: 'ai-processing' });
    };
    const onAssistantReply = ({ reply }: { reply: string }) => {
      store.addAssistantMessage({ role: 'assistant', content: reply });
      store.setAssistantLoading(false);
    };

    socket.on('meeting:transcript-chunk', onTranscriptChunk);
    socket.on('ai:summary-ready',        onSummaryReady);
    socket.on('ai:minutes-ready',        onMinutesReady);
    socket.on('ai:processing',           onProcessing);
    socket.on('ai:error',                onAIError);
    socket.on('ai:assistant-reply',      onAssistantReply);

    return () => {
      socket.off('meeting:transcript-chunk', onTranscriptChunk);
      socket.off('ai:summary-ready',        onSummaryReady);
      socket.off('ai:minutes-ready',        onMinutesReady);
      socket.off('ai:processing',           onProcessing);
      socket.off('ai:error',                onAIError);
      socket.off('ai:assistant-reply',      onAssistantReply);
    };
  }, [socket, meetingId, store]);

  // ── REST actions ────────────────────────────────────────────────────────────
  const generateSummary = useCallback(async () => {
    store.setGenerating(true);
    try {
      const { data: tData } = await aiService.getTranscript(meetingId);
      const transcript = tData?.transcript ?? '';
      if (!transcript.trim()) {
        toast.error('No transcript found. Please record or upload a transcript first.');
        return;
      }
      const { data } = await aiService.generateSummary(meetingId, transcript);
      store.setSummary(data.summary);
      const { data: ai } = await aiService.getActionItems(meetingId);
      store.setActionItems(ai.actionItems);
    } catch {
      toast.error('Failed to generate summary');
    } finally {
      store.setGenerating(false);
    }
  }, [meetingId, store]);

  const generateMinutes = useCallback(async () => {
    try {
      const { data } = await aiService.generateMinutes(meetingId);
      store.setMinutes(data.minutes);
    } catch {
      toast.error('Failed to generate minutes');
    }
  }, [meetingId, store]);

  const sendAssistantMessage = useCallback(async (message: string) => {
    store.addAssistantMessage({ role: 'user', content: message });
    store.setAssistantLoading(true);

    // Use socket if in-meeting, otherwise REST
    if (socket?.connected) {
      const history = store.assistantHistory.map(m => ({ role: m.role, content: m.content }));
      socket.emit('ai:assistant-message', { meetingId, message, history });
    } else {
      try {
        const history = store.assistantHistory.map(m => ({ role: m.role, content: m.content }));
        const { data } = await aiService.assistantChat(meetingId, message, history);
        store.addAssistantMessage({ role: 'assistant', content: data.reply });
      } catch {
        toast.error('Assistant unavailable');
      } finally {
        store.setAssistantLoading(false);
      }
    }
  }, [socket, meetingId, store]);

  const searchMeetings = useCallback(async (query: string) => {
    if (!query.trim()) return;
    store.setSearching(true);
    try {
      const { data } = await aiService.searchMeetings(query);
      store.setSearchResults(data.results);
    } catch {
      toast.error('Search failed');
    } finally {
      store.setSearching(false);
    }
  }, [store]);

  const sendTranscriptChunk = useCallback((chunk: string) => {
    if (!socket || !chunk.trim()) return;
    socket.emit('meeting:transcript-chunk', { meetingId, chunk });
  }, [socket, meetingId]);

  return {
    ...store,
    generateSummary,
    generateMinutes,
    sendAssistantMessage,
    searchMeetings,
    sendTranscriptChunk,
    setActionItems: store.setActionItems,
  };
};
