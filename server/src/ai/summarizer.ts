import { generate, withRetry, parseJSON } from './gemini';

type SummaryLength = 'short' | 'medium' | 'detailed';

const LENGTH_INSTRUCTION: Record<SummaryLength, string> = {
  short:    'Be very concise — 3-5 bullet points per section maximum.',
  medium:   'Be balanced — cover all key points without excessive detail.',
  detailed: 'Be thorough — include all relevant context, nuances, and specifics.',
};

export const summarize = async (transcript: string, length: SummaryLength = 'medium'): Promise<string> => {
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
};

export const extractFollowUpSuggestions = async (transcript: string): Promise<{
  text: string;
  priority: 'high' | 'medium' | 'low';
  owner: string | null;
}[]> => {
  const prompt = `Extract follow-up suggestions from this meeting transcript.
Return ONLY valid JSON (no markdown fences): { "suggestions": [{ "text": string, "priority": "high"|"medium"|"low", "owner": string|null }] }
Limit to the 10 most important. Return empty array if none found.

Transcript:

${transcript.slice(0, 20000)}`;

  return withRetry(async () => {
    const raw = await generate(prompt);
    try {
      const parsed = parseJSON<{ suggestions: any[] }>(raw);
      return (parsed.suggestions || []).map((s: any) => ({
        text:     String(s.text || '').slice(0, 300),
        priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
        owner:    s.owner || null,
      }));
    } catch {
      return [];
    }
  });
};

export const extractKeywords = async (transcript: string): Promise<{
  topics: string[];
  people: string[];
  projects: string[];
  technologies: string[];
  frequentTerms: string[];
}> => {
  const prompt = `Extract structured keyword metadata from this meeting transcript.
Return ONLY valid JSON (no markdown fences):
{
  "topics": string[],
  "people": string[],
  "projects": string[],
  "technologies": string[],
  "frequentTerms": string[]
}
Keep each array to the most relevant 5-10 items. Return empty arrays if nothing found.

Transcript:

${transcript.slice(0, 20000)}`;

  return withRetry(async () => {
    const raw = await generate(prompt);
    try {
      const parsed = parseJSON<any>(raw);
      return {
        topics:        parsed.topics        || [],
        people:        parsed.people        || [],
        projects:      parsed.projects      || [],
        technologies:  parsed.technologies  || [],
        frequentTerms: parsed.frequentTerms || [],
      };
    } catch {
      return { topics: [], people: [], projects: [], technologies: [], frequentTerms: [] };
    }
  });
};
