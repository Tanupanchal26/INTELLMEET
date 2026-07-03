import api from './axios';

export interface ActionItem {
  _id?: string;
  text: string;
  assignee: string | null;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done';
  done?: boolean;
}

export interface Decision {
  _id?: string;
  text: string;
  type: 'approved' | 'rejected' | 'pending';
  owner: string | null;
  impact: 'high' | 'medium' | 'low';
  risks: string[];
  dependencies: string[];
}

export interface Keywords {
  topics: string[];
  people: string[];
  projects: string[];
  technologies: string[];
  frequentTerms: string[];
}

export interface AIResult {
  meeting: string;
  transcript: string;
  summary: string;
  summaryLength: 'short' | 'medium' | 'detailed';
  minutes: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  keywords: Keywords;
  processingStatus: 'idle' | 'processing' | 'completed' | 'failed';
  version: number;
}

export interface SearchResult {
  id: string;
  title: string;
  date: string;
  score: number;
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedHours: number | null;
}

export const aiService = {
  getResult: (meetingId: string) =>
    api.get<AIResult>(`/ai/${meetingId}`),

  generateSummary: (meetingId: string, transcript: string, length: 'short' | 'medium' | 'detailed' = 'medium') =>
    api.post<{ summary: string }>(`/ai/${meetingId}/summary`, { transcript, length }),

  getSummary: (meetingId: string) =>
    api.get<{ summary: string; length: string }>(`/ai/${meetingId}/summary`),

  getTranscript: (meetingId: string) =>
    api.get<{ transcript: string; chunks: any[]; total: number }>(`/ai/${meetingId}/transcript`),

  saveTranscript: (meetingId: string, transcript: string) =>
    api.post(`/ai/${meetingId}/transcript`, { transcript }),

  getActionItems: (meetingId: string) =>
    api.get<{ actionItems: ActionItem[] }>(`/ai/${meetingId}/action-items`),

  updateActionItem: (meetingId: string, itemId: string, data: Partial<ActionItem>) =>
    api.put<ActionItem>(`/ai/${meetingId}/action-items/${itemId}`, data),

  deleteActionItem: (meetingId: string, itemId: string) =>
    api.delete(`/ai/${meetingId}/action-items/${itemId}`),

  getDecisions: (meetingId: string) =>
    api.get<{ decisions: Decision[] }>(`/ai/${meetingId}/decisions`),

  getKeywords: (meetingId: string) =>
    api.get<{ keywords: Keywords }>(`/ai/${meetingId}/keywords`),

  getSmartNotes: (meetingId: string) =>
    api.get<{ smartNotes: any }>(`/ai/${meetingId}/smart-notes`),

  generateMinutes: (meetingId: string) =>
    api.post<{ minutes: string }>(`/ai/${meetingId}/minutes`),

  assistantChat: (meetingId: string, message: string, history: { role: string; content: string }[] = []) =>
    api.post<{ reply: string }>(`/ai/${meetingId}/assistant`, { message, context: { history } }),

  generateTasks: (meetingId: string, prompt?: string) =>
    api.post<{ tasks: GeneratedTask[] }>(`/ai/${meetingId}/tasks`, { prompt }),

  extractAndSaveTasks: (meetingId: string) =>
    api.post<{ tasks: any[] }>(`/ai/${meetingId}/extract-tasks`),

  searchMeetings: (query: string) =>
    api.get<{ results: SearchResult[] }>('/ai/search', { params: { q: query } }),

  getMeetingHistory: (page = 1, limit = 20) =>
    api.get('/ai/history', { params: { page, limit } }),
};
