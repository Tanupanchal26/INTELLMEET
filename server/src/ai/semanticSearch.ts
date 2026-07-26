import { getAIProvider } from './providers/providerFactory';

export const semanticSearch = (query: string, documents: any[]) =>
  getAIProvider().semanticSearch(query, documents);
