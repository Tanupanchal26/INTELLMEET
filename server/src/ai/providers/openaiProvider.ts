/**
 * OpenAI Provider (stub)
 * ─────────────────────────────────────────────────────────────────────────────
 * Activated when AI_MODE=openai.
 * Replace the stub bodies below with real openai SDK calls.
 *
 * Install: npm install openai
 * Then set OPENAI_API_KEY in .env
 */
import type { AIProvider } from './demoProvider';

const notImplemented = (fn: string) => {
  throw new Error(`OpenAI provider: ${fn} not yet implemented. Set AI_MODE=demo or AI_MODE=gemini.`);
};

export const openaiProvider: AIProvider = {
  async summarize()                  { notImplemented('summarize'); return ''; },
  async extractActionItems()         { notImplemented('extractActionItems'); return []; },
  async extractDecisions()           { notImplemented('extractDecisions'); return []; },
  async extractKeywords()            { notImplemented('extractKeywords'); return { topics: [], people: [], projects: [], technologies: [], frequentTerms: [] }; },
  async extractFollowUpSuggestions() { notImplemented('extractFollowUpSuggestions'); return []; },
  async generateMinutes()            { notImplemented('generateMinutes'); return ''; },
  async generateSmartNotes()         { notImplemented('generateSmartNotes'); return {}; },
  async chat()                       { notImplemented('chat'); return ''; },
  async generateTasks()              { notImplemented('generateTasks'); return []; },
  async semanticSearch()             { notImplemented('semanticSearch'); return []; },
  async embed()                      { notImplemented('embed'); return []; },
};
