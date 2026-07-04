"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const { getClient } = require('./openai');
const { getRedisClient } = require('../config/redis');
const EMBED_MODEL = 'text-embedding-3-small';
const CACHE_TTL = 86400; // 24h
// Float32Array is ~4x faster than plain array for dot-product loops
const cosineSimilarity = (a, b) => {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
const cacheKey = (text) => `embed:${Buffer.from(text.slice(0, 200)).toString('base64')}`;
const getCachedEmbedding = async (redis, key) => {
    if (!redis)
        return null;
    try {
        const hit = await redis.get(key);
        return hit ? new Float32Array(JSON.parse(hit)) : null;
    }
    catch {
        return null;
    }
};
const setCachedEmbedding = async (redis, key, vec) => {
    if (!redis)
        return;
    try {
        await redis.setEx(key, CACHE_TTL, JSON.stringify(Array.from(vec)));
    }
    catch { }
};
/**
 * Batch-embed all texts in a single OpenAI API call (up to 2048 inputs).
 * Falls back to individual calls for cache hits.
 */
const batchGetEmbeddings = async (texts) => {
    const redis = getRedisClient();
    const results = new Array(texts.length).fill(null);
    const missing = []; // { idx, text }
    // Check cache for each text
    await Promise.all(texts.map(async (text, idx) => {
        const key = cacheKey(text);
        const hit = await getCachedEmbedding(redis, key);
        if (hit)
            results[idx] = hit;
        else
            missing.push({ idx, text });
    }));
    if (missing.length > 0) {
        const client = getClient();
        const res = await client.embeddings.create({
            model: EMBED_MODEL,
            input: missing.map(m => m.text.slice(0, 8000)),
        });
        await Promise.all(res.data.map(async (item, i) => {
            const vec = new Float32Array(item.embedding);
            const { idx, text } = missing[i];
            results[idx] = vec;
            await setCachedEmbedding(redis, cacheKey(text), vec);
        }));
    }
    return results;
};
/**
 * Semantic search over meeting documents.
 * Uses a single batched OpenAI call instead of N+1 individual calls.
 */
exports.semanticSearch = async (query, documents, topK = 5) => {
    if (!documents.length)
        return [];
    const texts = [query, ...documents.map(d => `${d.title} ${d.content}`)];
    const embeddings = await batchGetEmbeddings(texts);
    const queryEmbed = embeddings[0];
    return documents
        .map((doc, i) => ({ ...doc, score: cosineSimilarity(queryEmbed, embeddings[i + 1]) }))
        .filter(d => d.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};
