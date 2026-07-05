import { getAIProvider } from './providers/providerFactory';

export const summarize = (transcript: string, length: 'short' | 'medium' | 'detailed' = 'medium') =>
  getAIProvider().summarize(transcript, length);

export const extractFollowUpSuggestions = (transcript: string) =>
  getAIProvider().extractFollowUpSuggestions(transcript);

export const extractKeywords = (transcript: string) =>
  getAIProvider().extractKeywords(transcript);
