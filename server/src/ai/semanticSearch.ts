// @ts-nocheck
const { embed }          = require('./gemini');
const { getRedisClient } = require('../config/redis');

const CACHE_TTL = 86400; // 24h

// Float32Array is ~4x faster than plain array for dot-product loops
const cosineSimilarity = (a, b) => {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
};

const cacheKey = (text) => `gembed:${Buffer.from(text.slice(0, 200)).toString('base64')}`;

const getCachedEmbedding = async (redis, key) => {
  if (!redis) return null;
  try {
    const hit = await redis.get(key);
    return hit ? new Float32Array(JSON.parse(hit)) : null;
  } catch { return null; }
};

const setCachedEmbedding = async (redis, key, vec) => {
  if (!redis) return;
  try { await redis.setEx(key, CACHE_TTL, JSON.stringify(Array.from(vec))); } catch {}
};

const getEmbedding = async (text) => {
  const redis = getRedisClient();
  const key   = cacheKey(text);
  const hit   = await getCachedEmbedding(redis, key);
  if (hit) return hit;

  const raw = await embed(text.slice(0, 8000));
  const vec = new Float32Array(raw);
  await setCachedEmbedding(redis, key, vec);
  return vec;
};

/**
 * Semantic search over meeting documents using Gemini embeddings.
 */
exports.semanticSearch = async (query, documents, topK = 5) => {
  if (!documents.length) return [];

  // Embed query + all documents in parallel (each call is individually cached)
  const [queryEmbed, ...docEmbeds] = await Promise.all([
    getEmbedding(query),
    ...documents.map(d => getEmbedding(`${d.title} ${d.content}`)),
  ]);

  return documents
    .map((doc, i) => ({ ...doc, score: cosineSimilarity(queryEmbed, docEmbeds[i]) }))
    .filter(d => d.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

export {};
