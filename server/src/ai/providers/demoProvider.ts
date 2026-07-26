/**
 * AIProvider interface — implemented by grokProvider.
 */

interface MeetingContext {
  meetingId?:    string;
  title?:        string;
  participants?: string[];
  duration?:     number;
  date?:         string;
  host?:         string;
  transcript?:   string;
  summary?:      string;
}

export interface AIProvider {
  summarize(transcript: string, length: 'short' | 'medium' | 'detailed', ctx?: MeetingContext): Promise<string>;
  extractActionItems(transcript: string, ctx?: MeetingContext): Promise<any[]>;
  extractDecisions(transcript: string, ctx?: MeetingContext): Promise<any[]>;
  extractKeywords(transcript: string, ctx?: MeetingContext): Promise<any>;
  extractFollowUpSuggestions(transcript: string, ctx?: MeetingContext): Promise<any[]>;
  generateMinutes(opts: { transcript: string; title: string; participants: string[]; date: string }, ctx?: MeetingContext): Promise<string>;
  generateSmartNotes(opts: { transcript: string; title: string; agenda: string[] }, ctx?: MeetingContext): Promise<any>;
  chat(message: string, context: any): Promise<string>;
  generateTasks(prompt: string, transcript: string, ctx?: MeetingContext): Promise<any[]>;
  semanticSearch(query: string, documents: any[], topK?: number): Promise<any[]>;
  embed(text: string): Promise<number[]>;
}
