import { create } from 'zustand';
import type { ActionItem, SearchResult } from '../../api/ai.api';

export type { ActionItem };

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

// AISummary page state — persisted across navigation so the page never reloads
export type AISummaryTab = 'summary' | 'actions' | 'minutes' | 'followup';

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

  // AISummary page persistent state
  aiPageSelectedId: string | null;
  aiPageActiveTab: AISummaryTab;
  aiPageChatHistory: { role: string; content: string }[];
  aiPageSearchQuery: string;
  aiPageSearchResults: any[];
  aiPageFollowUpSuggestions: any[];

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

  // AISummary page setters
  setAIPageSelectedId:          (id: string | null) => void;
  setAIPageActiveTab:           (tab: AISummaryTab) => void;
  setAIPageChatHistory:         (h: { role: string; content: string }[]) => void;
  appendAIPageChatMessage:      (msg: { role: string; content: string }) => void;
  setAIPageSearchQuery:         (q: string) => void;
  setAIPageSearchResults:       (r: any[]) => void;
  setAIPageFollowUpSuggestions: (s: any[]) => void;
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

  // AISummary page persistent state defaults
  aiPageSelectedId: null,
  aiPageActiveTab: 'summary',
  aiPageChatHistory: [],
  aiPageSearchQuery: '',
  aiPageSearchResults: [],
  aiPageFollowUpSuggestions: [],

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

  // AISummary page setters
  setAIPageSelectedId:          (aiPageSelectedId) => set({ aiPageSelectedId }),
  setAIPageActiveTab:           (aiPageActiveTab) => set({ aiPageActiveTab }),
  setAIPageChatHistory:         (aiPageChatHistory) => set({ aiPageChatHistory }),
  appendAIPageChatMessage:      (msg) => set((s) => ({ aiPageChatHistory: [...s.aiPageChatHistory, msg] })),
  setAIPageSearchQuery:         (aiPageSearchQuery) => set({ aiPageSearchQuery }),
  setAIPageSearchResults:       (aiPageSearchResults) => set({ aiPageSearchResults }),
  setAIPageFollowUpSuggestions: (aiPageFollowUpSuggestions) => set({ aiPageFollowUpSuggestions }),
}));
