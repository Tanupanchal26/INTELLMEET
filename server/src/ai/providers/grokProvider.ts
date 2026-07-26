/**
 * Grok AI Provider
 * Uses Groq's OpenAI-compatible API with the grok-4 model.
 * Requires: GROK_API_KEY in .env
 */
import type { AIProvider } from './demoProvider';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL         = 'grok-4';

const getApiKey  = () => process.env.GROK_API_KEY || '';
const getRetries = () => parseInt(process.env.AI_RETRIES  || '3', 10);
const getTimeout = () => parseInt(process.env.AI_TIMEOUT  || '30000', 10);

async function grokGenerate(prompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('GROK_API_KEY is not configured. Please add it to your .env file.');

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), getTimeout());

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model:       MODEL,
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens:  4096,
      }),
      signal: controller.signal,
    });

    if (res.status === 401) throw new Error('Invalid Grok API key. Please check GROK_API_KEY in .env.');
    if (res.status === 429) throw new Error('Grok API rate limit exceeded. Please try again later.');
    if (res.status === 503) throw new Error('Grok API is temporarily unavailable. Please try again.');
    if (!res.ok)            throw new Error(`Grok API error ${res.status}: ${await res.text()}`);

    const data    = await res.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) throw new Error('Grok returned an empty response.');
    return content;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error(`Grok API request timed out after ${getTimeout()}ms.`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const retries = getRetries();
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err: any) {
      const fatal = err.message?.includes('Invalid Grok API key') ||
                    err.message?.includes('GROK_API_KEY');
      if (fatal || i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Unreachable');
}

function parseJSON<T>(text: string): T {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  try {
    return JSON.parse(match ? match[1] : text);
  } catch {
    throw new Error(`Failed to parse Grok response as JSON. Raw: ${text.slice(0, 200)}`);
  }
}

export const grokProvider: AIProvider = {

  async summarize(transcript, length) {
    if (!transcript?.trim()) throw new Error('No transcript available to summarize.');
    const detail: Record<string, string> = {
      short:    'Be very concise — 3-5 bullet points per section maximum.',
      medium:   'Be balanced — cover all key points without excessive detail.',
      detailed: 'Be thorough — include all relevant context, nuances, and specifics.',
    };
    const prompt = `You are an expert meeting analyst. Produce a structured meeting summary in markdown.
${detail[length]}

Use exactly these sections:
## Executive Summary
## Key Highlights
## Discussion Points
## Important Decisions
## Meeting Outcome

Be factual and accurate. Do not invent information not present in the transcript.

Meeting transcript:
${transcript.slice(0, 40000)}`;
    return withRetry(() => grokGenerate(prompt));
  },

  async extractActionItems(transcript) {
    if (!transcript?.trim()) return [];
    const prompt = `Extract all action items from this meeting transcript. Return a JSON array with objects: text, assignee (string or null), dueDate (YYYY-MM-DD or null), priority ("high"|"medium"|"low"), status ("pending"|"in_progress"|"done"), done (boolean).

Transcript:
${transcript.slice(0, 40000)}

Return ONLY a valid JSON array, no markdown fences.`;
    const raw = await withRetry(() => grokGenerate(prompt));
    return parseJSON<any[]>(raw);
  },

  async extractDecisions(transcript) {
    if (!transcript?.trim()) return [];
    const prompt = `Extract all decisions made in this meeting transcript. Return a JSON array with objects: text, type ("approved"|"rejected"|"pending"), owner (string or null), impact ("high"|"medium"|"low"), risks (string[]), dependencies (string[]).

Transcript:
${transcript.slice(0, 40000)}

Return ONLY a valid JSON array, no markdown fences.`;
    const raw = await withRetry(() => grokGenerate(prompt));
    return parseJSON<any[]>(raw);
  },

  async extractKeywords(transcript) {
    if (!transcript?.trim()) return { topics: [], people: [], projects: [], technologies: [], frequentTerms: [] };
    const prompt = `Extract keywords from this meeting transcript. Return a JSON object with: topics (string[]), people (string[]), projects (string[]), technologies (string[]), frequentTerms (string[]).

Transcript:
${transcript.slice(0, 20000)}

Return ONLY a valid JSON object, no markdown fences.`;
    const raw = await withRetry(() => grokGenerate(prompt));
    return parseJSON<any>(raw);
  },

  async extractFollowUpSuggestions(transcript) {
    if (!transcript?.trim()) return [];
    const prompt = `Based on this meeting transcript, generate follow-up actions including emails, reminders, deadlines, and pending tasks. Return a JSON array with objects: text, priority ("high"|"medium"|"low"), owner (string or null).

Transcript:
${transcript.slice(0, 40000)}

Return ONLY a valid JSON array, no markdown fences.`;
    const raw = await withRetry(() => grokGenerate(prompt));
    return parseJSON<any[]>(raw);
  },

  async generateMinutes(opts) {
    if (!opts.transcript?.trim()) throw new Error('No transcript available to generate minutes.');
    const prompt = `Generate formal meeting minutes in markdown for:
Title: ${opts.title}
Date: ${opts.date}
Participants: ${opts.participants.join(', ')}

Transcript:
${opts.transcript.slice(0, 40000)}

Include sections: Meeting Details, Attendees, Agenda, Discussion Summary, Key Decisions, Action Items, Next Steps.`;
    return withRetry(() => grokGenerate(prompt));
  },

  async generateSmartNotes(opts) {
    if (!opts.transcript?.trim()) throw new Error('No transcript available to generate smart notes.');
    const prompt = `Generate smart notes for this meeting as JSON with fields: topicsCovered (string[]), followUpItems (string[]), questionsAsked (string[]), answersGiven (string[]), agendaCompletion (number 0-100), notesMarkdown (string).

Title: ${opts.title}
Agenda: ${opts.agenda.join(', ')}
Transcript:
${opts.transcript.slice(0, 40000)}

Return ONLY valid JSON, no markdown fences.`;
    const raw = await withRetry(() => grokGenerate(prompt));
    return parseJSON<any>(raw);
  },

  async chat(message, context) {
    if (!message?.trim()) throw new Error('Message cannot be empty.');
    const contextStr = context?.transcript
      ? `Meeting transcript (excerpt):\n${String(context.transcript).slice(0, 8000)}\n\n`
      : '';
    const summaryStr = context?.summary      ? `Summary: ${context.summary}\n\n`          : '';
    const titleStr   = context?.meetingTitle ? `Meeting: ${context.meetingTitle}\n`        : '';
    const prompt = `You are an AI Meeting Assistant.

${titleStr}${summaryStr}${contextStr}User Question:
${message}

Answer concisely and professionally based on the meeting context. If no context is available, say so politely.`;
    return withRetry(() => grokGenerate(prompt));
  },

  async generateTasks(prompt, transcript) {
    const fullPrompt = `Based on this request and meeting transcript, generate tasks as a JSON array with fields: title, description, priority ("high"|"medium"|"low"), estimatedHours (number).

Request: ${prompt}
Transcript:
${transcript.slice(0, 20000)}

Return ONLY a valid JSON array, no markdown fences.`;
    const raw = await withRetry(() => grokGenerate(fullPrompt));
    return parseJSON<any[]>(raw);
  },

  async semanticSearch(query, documents) {
    if (!documents?.length) return [];
    const docsText = documents
      .map((d, i) => `[${i}] Title: ${d.title}\nContent: ${String(d.content).slice(0, 500)}`)
      .join('\n\n');
    const prompt = `Find all sections related to the query below. Return the indices of the top 5 most relevant documents ranked by semantic relevance.

Query: "${query}"

Documents:
${docsText}

Return a JSON array of objects: index (number), score (0.0-1.0). Only include documents with score > 0.3.
Example: [{"index":0,"score":0.95},{"index":2,"score":0.72}]

Return ONLY valid JSON, no markdown fences.`;
    const raw    = await withRetry(() => grokGenerate(prompt));
    const ranked = parseJSON<{ index: number; score: number }[]>(raw);
    return ranked
      .filter(r => r.index >= 0 && r.index < documents.length && r.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => ({ ...documents[r.index], score: r.score }));
  },

  async embed(text) {
    // Grok does not provide an embeddings endpoint.
    // Returns a deterministic unit vector seeded from the text for cosine-similarity fallbacks.
    const s    = text.split('').reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
    const dim  = 768;
    const vec  = Array.from({ length: dim }, (_, i) => Math.sin(Math.abs(s) + i) * 0.1);
    const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
    return vec.map(v => v / norm);
  },
};
