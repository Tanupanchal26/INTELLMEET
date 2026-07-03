import { create } from 'zustand';
import type { ActionItem, SearchResult } from '../../api/ai.api';

export type { ActionItem };

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIState {
  transcript: string;
  summary: string;
  minutes: string;
  actionItems: ActionItem[];
  assistantHistory: AssistantMessage[];
  searchResults: SearchResult[];
  isGenerating: boolean;
  isTranscribing: boolean;
  isSearching: boolean;
  isAssistantLoading: boolean;

  appendTranscript:     (chunk: string) => void;
  setSummary:           (s: string) => void;
  setMinutes:           (m: string) => void;
  setActionItems:       (items: ActionItem[]) => void;
  toggleActionItemDone: (idx: number) => void;
  addAssistantMessage:  (msg: AssistantMessage) => void;
  setSearchResults:     (r: SearchResult[]) => void;
  setGenerating:        (v: boolean) => void;
  setTranscribing:      (v: boolean) => void;
  setSearching:         (v: boolean) => void;
  setAssistantLoading:  (v: boolean) => void;
  clearAI:              () => void;
}

export const useAIStore = create<AIState>((set) => ({
  transcript: '',
  summary: '',
  minutes: '',
  actionItems: [],
  assistantHistory: [],
  searchResults: [],
  isGenerating: false,
  isTranscribing: false,
  isSearching: false,
  isAssistantLoading: false,

  appendTranscript:     (chunk) => set((s) => ({ transcript: s.transcript + '\n' + chunk })),
  setSummary:           (summary) => set({ summary }),
  setMinutes:           (minutes) => set({ minutes }),
  setActionItems:       (actionItems) => set({ actionItems }),
  toggleActionItemDone: (idx) => set((s) => {
    const actionItems = [...s.actionItems];
    if (actionItems[idx]) actionItems[idx] = { ...actionItems[idx], done: !actionItems[idx].done };
    return { actionItems };
  }),
  addAssistantMessage:  (msg) => set((s) => ({ assistantHistory: [...s.assistantHistory, msg] })),
  setSearchResults:     (searchResults) => set({ searchResults }),
  setGenerating:        (isGenerating) => set({ isGenerating }),
  setTranscribing:      (isTranscribing) => set({ isTranscribing }),
  setSearching:         (isSearching) => set({ isSearching }),
  setAssistantLoading:  (isAssistantLoading) => set({ isAssistantLoading }),
  clearAI: () => set({
    transcript: '', summary: '', minutes: '', actionItems: [],
    assistantHistory: [], searchResults: [],
    isGenerating: false, isTranscribing: false, isSearching: false, isAssistantLoading: false,
  }),
}));
