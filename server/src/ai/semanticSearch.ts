import { getAIProvider } from './providers/providerFactory';

export const semanticSearch = (query: string, documents: any[], topK = 5) =>
  getAIProvider().semanticSearch(query, documents, topK);
