import { getClient, withRetry } from './openai';
import { AI_MODEL } from '../constants';

type SummaryLength = 'short' | 'medium' | 'detailed';

const LENGTH_TOKENS: Record<SummaryLength, number> = {
  short:    400,
  medium:   800,
  detailed: 1400,
};

const LENGTH_INSTRUCTION: Record<SummaryLength, string> = {
  short:    'Be very concise — 3-5 bullet points per section maximum.',
  medium:   'Be balanced — cover all key points without excessive detail.',
  detailed: 'Be thorough — include all relevant context, nuances, and specifics.',
};

export const summarize = async (transcript: string, length: SummaryLength = 'medium'): Promise<string> => {
  const client = getClient();
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: AI_MODEL.GPT4O,
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Produce a structured meeting summary in markdown.\n${LENGTH_INSTRUCTION[length]}\n\nUse exactly these sections:\n## Executive Summary\n## Key Highlights\n## Discussion Points\n## Important Decisions\n## Meeting Outcome\n\nBe factual, professional, and accurate. Do not invent information not present in the transcript.`,
        },
        { role: 'user', content: `Meeting transcript:\n\n${transcript.slice(0, 40000)}` },
      ],
      max_tokens:  LENGTH_TOKENS[length],
      temperature: 0.3,
    });
    return res.choices[0].message.content!.trim();
  });
};

export const extractKeywords = async (transcript: string): Promise<{
  topics: string[];
  people: string[];
  projects: string[];
  technologies: string[];
  frequentTerms: string[];
}> => {
  const client = getClient();
  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: AI_MODEL.GPT4O,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Extract structured keyword metadata from meeting transcripts.\nReturn JSON: {\n  "topics": string[],\n  "people": string[],\n  "projects": string[],\n  "technologies": string[],\n  "frequentTerms": string[]\n}\nKeep each array to the most relevant 5-10 items. Return empty arrays if nothing found.`,
        },
        { role: 'user', content: `Transcript:\n\n${transcript.slice(0, 20000)}` },
      ],
      max_tokens:  400,
      temperature: 0.2,
    });
    const raw = res.choices[0].message.content!;
    try {
      const parsed = JSON.parse(raw);
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
