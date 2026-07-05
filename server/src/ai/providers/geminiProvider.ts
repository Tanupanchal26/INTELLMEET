/**
 * Gemini AI Provider
 * Thin wrapper around the existing gemini.ts helpers.
 * Activated when AI_MODE=gemini (default when a real API key is present).
 */
import type { AIProvider } from './demoProvider';
import { generate, embed as geminiEmbed, withRetry, parseJSON } from '../gemini';

export const geminiProvider: AIProvider = {

  async summarize(transcript, length) {
    const LENGTH_INSTRUCTION: Record<string, string> = {
      short:    'Be very concise — 3-5 bullet points per section maximum.',
      medium:   'Be balanced — cover all key points without excessive detail.',
      detailed: 'Be thorough — include all relevant context, nuances, and specifics.',
    };
    const prompt = `You are an expert meeting analyst. Produce a structured meeting summary in markdown.
${LENGTH_INSTRUCTION[length]}

Use exactly these sections:
## Executive Summary
## Key Highlights
## Discussion Points
## Important Decisions
## Meeting Outcome

Be factual, professional, and accurate. Do not invent information not present in the transcript.

Meeting transcript:

${transcript.slice(0, 40000)}`;
    return withRetry(() => generate(prompt));
  },

  async extractActionItems(transcript) {
    const { extractActionItems } = await import('../actionItems');
    return extractActionItems(transcript);
  },

  async extractDecisions(transcript) {
    const { extractDecisions } = await import('../actionItems');
    return extractDecisions(transcript);
  },

  async extractKeywords(transcript) {
    const { extractKeywords } = await import('../summarizer');
    return extractKeywords(transcript);
  },

  async extractFollowUpSuggestions(transcript) {
    const { extractFollowUpSuggestions } = await import('../summarizer');
    return extractFollowUpSuggestions(transcript);
  },

  async generateMinutes(opts) {
    const { generateMinutes } = await import('../minutesGenerator') as any;
    return generateMinutes(opts);
  },

  async generateSmartNotes(opts) {
    const { generateSmartNotes } = await import('../minutesGenerator') as any;
    return generateSmartNotes(opts);
  },

  async chat(message, context) {
    const { chat } = await import('../assistant') as any;
    return chat(message, context);
  },

  async generateTasks(prompt, transcript) {
    const { generateTasks } = await import('../assistant') as any;
    return generateTasks(prompt, transcript);
  },

  async semanticSearch(query, documents) {
    const { semanticSearch } = await import('../semanticSearch') as any;
    return semanticSearch(query, documents);
  },

  async embed(text) {
    return geminiEmbed(text);
  },
};
