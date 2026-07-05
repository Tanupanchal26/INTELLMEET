import { create } from 'zustand';
import type { ActionItem, SearchResult } from '../../api/ai.api';

export type { ActionItem };

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

// AISummary page state — persisted across navigation so the page never reloads
export type AISummaryTab = 'summary' | 'actions' | 'minutes' | 'followup';

// ── Per-meeting isolated state ────────────────────────────────────────────────
// Every field that belongs to a specific meeting is stored in a map keyed by
// meetingId. Global fields (search, page-level UI) remain flat.
interface MeetingAIData {
  transcript: string;
  summary: string;
  minutes: string;
  actionItems: ActionItem[];
  assistantHistory: AssistantMessage[];
  isGenerating: boolean;
  isTranscribing: boolean;
  isAssistantLoading: boolean;
}

const defaultMeetingData = (): MeetingAIData => ({
  transcript: '',
  summary: '',
  minutes: '',
  actionItems: [],
  assistantHistory: [],
  isGenerating: false,
  isTranscribing: false,
  isAssistantLoading: false,
});

interface AIState {
  // Per-meeting data — keyed by meetingId
  meetingData: Record<string, MeetingAIData>;

  // Global search state (not meeting-specific)
  searchResults: SearchResult[];
  isSearching: boolean;

  // AISummary page persistent state (page-level UI, not meeting-specific)
  aiPageSelectedId: string | null;
  aiPageActiveTab: AISummaryTab;
  aiPageChatHistory: Record<string, { role: string; content: string }[]>;
  aiPageSearchQuery: string;
  aiPageSearchResults: any[];
  aiPageFollowUpSuggestions: Record<string, any[]>;

  // ── Per-meeting accessors ──────────────────────────────────────────────────
  getMeetingData: (meetingId: string) => MeetingAIData;

  appendTranscript:     (meetingId: string, chunk: string) => void;
  setSummary:           (meetingId: string, s: string) => void;
  setMinutes:           (meetingId: string, m: string) => void;
  setActionItems:       (meetingId: string, items: ActionItem[]) => void;
  toggleActionItemDone: (meetingId: string, idx: number) => void;
  addAssistantMessage:  (meetingId: string, msg: AssistantMessage) => void;
  setGenerating:        (meetingId: string, v: boolean) => void;
  setTranscribing:      (meetingId: string, v: boolean) => void;
  setAssistantLoading:  (meetingId: string, v: boolean) => void;

  /** Wipe all AI data for a specific meeting (call on leave/end) */
  clearMeetingAI: (meetingId: string) => void;
  /** Legacy no-arg clearAI — clears the currently selected meeting */
  clearAI: () => void;

  // ── Global search ──────────────────────────────────────────────────────────
  setSearchResults: (r: SearchResult[]) => void;
  setSearching:     (v: boolean) => void;

  // ── AISummary page setters ─────────────────────────────────────────────────
  setAIPageSelectedId:          (id: string | null) => void;
  setAIPageActiveTab:           (tab: AISummaryTab) => void;
  getAIPageChatHistory:         (meetingId: string) => { role: string; content: string }[];
  setAIPageChatHistory:         (meetingId: string, h: { role: string; content: string }[]) => void;
  appendAIPageChatMessage:      (meetingId: string, msg: { role: string; content: string }) => void;
  setAIPageSearchQuery:         (q: string) => void;
  setAIPageSearchResults:       (r: any[]) => void;
  getAIPageFollowUpSuggestions: (meetingId: string) => any[];
  setAIPageFollowUpSuggestions: (meetingId: string, s: any[]) => void;
}

// ── Helper: immutably update a single meeting's data ─────────────────────────
const updateMeeting = (
  state: AIState,
  meetingId: string,
  patch: Partial<MeetingAIData>,
): Pick<AIState, 'meetingData'> => ({
  meetingData: {
    ...state.meetingData,
    [meetingId]: { ...(state.meetingData[meetingId] ?? defaultMeetingData()), ...patch },
  },
});

export const useAIStore = create<AIState>((set, get) => ({
  meetingData: {},
  searchResults: [],
  isSearching: false,
  aiPageSelectedId: null,
  aiPageActiveTab: 'summary',
  aiPageChatHistory: {},
  aiPageSearchQuery: '',
  aiPageSearchResults: [],
  aiPageFollowUpSuggestions: {},

  getMeetingData: (meetingId) =>
    get().meetingData[meetingId] ?? defaultMeetingData(),

  appendTranscript: (meetingId, chunk) =>
    set((s) => updateMeeting(s, meetingId, {
      transcript: (s.meetingData[meetingId]?.transcript ?? '') + '\n' + chunk,
    })),

  setSummary: (meetingId, summary) =>
    set((s) => updateMeeting(s, meetingId, { summary })),

  setMinutes: (meetingId, minutes) =>
    set((s) => updateMeeting(s, meetingId, { minutes })),

  setActionItems: (meetingId, actionItems) =>
    set((s) => updateMeeting(s, meetingId, { actionItems })),

  toggleActionItemDone: (meetingId, idx) =>
    set((s) => {
      const items = [...(s.meetingData[meetingId]?.actionItems ?? [])];
      if (items[idx]) items[idx] = { ...items[idx], done: !items[idx].done };
      return updateMeeting(s, meetingId, { actionItems: items });
    }),

  addAssistantMessage: (meetingId, msg) =>
    set((s) => updateMeeting(s, meetingId, {
      assistantHistory: [...(s.meetingData[meetingId]?.assistantHistory ?? []), msg],
    })),

  setGenerating: (meetingId, isGenerating) =>
    set((s) => updateMeeting(s, meetingId, { isGenerating })),

  setTranscribing: (meetingId, isTranscribing) =>
    set((s) => updateMeeting(s, meetingId, { isTranscribing })),

  setAssistantLoading: (meetingId, isAssistantLoading) =>
    set((s) => updateMeeting(s, meetingId, { isAssistantLoading })),

  clearMeetingAI: (meetingId) =>
    set((s) => {
      const { [meetingId]: _removed, ...rest } = s.meetingData;
      const { [meetingId]: _chat, ...restChat } = s.aiPageChatHistory;
      const { [meetingId]: _fu, ...restFu } = s.aiPageFollowUpSuggestions;
      return { meetingData: rest, aiPageChatHistory: restChat, aiPageFollowUpSuggestions: restFu };
    }),

  clearAI: () => {
    const selectedId = get().aiPageSelectedId;
    if (selectedId) get().clearMeetingAI(selectedId);
  },

  setSearchResults: (searchResults) => set({ searchResults }),
  setSearching:     (isSearching)   => set({ isSearching }),

  setAIPageSelectedId: (aiPageSelectedId) => set({ aiPageSelectedId }),
  setAIPageActiveTab:  (aiPageActiveTab)  => set({ aiPageActiveTab }),

  getAIPageChatHistory: (meetingId) =>
    get().aiPageChatHistory[meetingId] ?? [],

  setAIPageChatHistory: (meetingId, h) =>
    set((s) => ({ aiPageChatHistory: { ...s.aiPageChatHistory, [meetingId]: h } })),

  appendAIPageChatMessage: (meetingId, msg) =>
    set((s) => ({
      aiPageChatHistory: {
        ...s.aiPageChatHistory,
        [meetingId]: [...(s.aiPageChatHistory[meetingId] ?? []), msg],
      },
    })),

  setAIPageSearchQuery:   (aiPageSearchQuery)   => set({ aiPageSearchQuery }),
  setAIPageSearchResults: (aiPageSearchResults) => set({ aiPageSearchResults }),

  getAIPageFollowUpSuggestions: (meetingId) =>
    get().aiPageFollowUpSuggestions[meetingId] ?? [],

  setAIPageFollowUpSuggestions: (meetingId, suggestions) =>
    set((s) => ({
      aiPageFollowUpSuggestions: { ...s.aiPageFollowUpSuggestions, [meetingId]: suggestions },
    })),
}));
