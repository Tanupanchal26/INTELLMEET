// @ts-nocheck
const { getAIProvider } = require('./providers/providerFactory');

exports.semanticSearch = (query: string, documents: any[], topK = 5) =>
  getAIProvider().semanticSearch(query, documents, topK);

export {};
