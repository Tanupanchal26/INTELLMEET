import { getAIProvider } from './providers/providerFactory';

export const summarize = (transcript: string, length: 'short' | 'medium' | 'detailed' = 'medium', ctx?: any) =>
  getAIProvider().summarize(transcript, length, ctx);

export const extractFollowUpSuggestions = (transcript: string, ctx?: any) =>
  getAIProvider().extractFollowUpSuggestions(transcript, ctx);

export const extractKeywords = (transcript: string, ctx?: any) =>
  getAIProvider().extractKeywords(transcript, ctx);
