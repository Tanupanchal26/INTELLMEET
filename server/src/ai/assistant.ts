// @ts-nocheck
const { getClient, withRetry } = require('./openai');
const { AI_MODEL } = require('../constants');

const SYSTEM_PROMPT = `You are IntellMeet AI Assistant, an intelligent meeting co-pilot. You can:
- Summarize meetings or specific sections
- Extract and generate action items / tasks
- Answer questions about meeting content
- Search across meeting history when context is provided
- Provide insights and recommendations

Be concise, structured, and helpful. Use bullet points and markdown when appropriate.
IMPORTANT: Only answer questions related to meetings, productivity, and work. Decline unrelated requests politely.`;

// Guard against prompt injection in user messages
const sanitizeUserMessage = (msg: string): string =>
  msg.replace(/\bsystem\b/gi, 'sys').replace(/\bignore previous\b/gi, '').slice(0, 2000);

/**
 * AI assistant chat with meeting context.
 */
exports.chat = async (userMessage: string, context: {
  transcript?:    string;
  summary?:       string;
  history?:       { role: string; content: string }[];
  meetingTitles?: string[];
} = {}): Promise<string> => {
  const client = getClient();
  const safeMessage = sanitizeUserMessage(userMessage);

  const contextBlock = [
    context.transcript ? `CURRENT TRANSCRIPT:\n${context.transcript.slice(0, 6000)}` : '',
    context.summary    ? `CURRENT SUMMARY:\n${context.summary.slice(0, 2000)}`        : '',
    context.meetingTitles?.length
      ? `AVAILABLE MEETINGS:\n${context.meetingTitles.slice(0, 20).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + (contextBlock ? `\n\nCONTEXT:\n${contextBlock}` : '') },
    ...(context.history || []).slice(-8),
    { role: 'user', content: safeMessage },
  ];

  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model:       AI_MODEL.GPT4O,
      messages,
      max_tokens:  700,
      temperature: 0.4,
    });
    return res.choices[0].message.content.trim();
  });
};

/**
 * Generate structured tasks from a prompt or transcript.
 */
exports.generateTasks = async (prompt: string, transcript = ''): Promise<Array<{
  title:          string;
  description:    string;
  priority:       'high' | 'medium' | 'low';
  estimatedHours: number | null;
}>> => {
  const client = getClient();
  const safePrompt = sanitizeUserMessage(prompt);

  return withRetry(async () => {
    const res = await client.chat.completions.create({
      model: AI_MODEL.GPT4O,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Generate project tasks from the given input.
Return JSON: {
  "tasks": [
    {
      "title":          string,
      "description":    string,
      "priority":       "high" | "medium" | "low",
      "estimatedHours": number | null
    }
  ]
}
Only generate tasks directly related to the input. Return empty array if nothing actionable.`,
        },
        {
          role: 'user',
          content: `Request: ${safePrompt}${transcript ? `\n\nTranscript context:\n${transcript.slice(0, 3000)}` : ''}`,
        },
      ],
      max_tokens:  600,
      temperature: 0.3,
    });
    const raw = res.choices[0].message.content;
    try {
      const parsed = JSON.parse(raw);
      return (parsed.tasks || []).map((t: any) => ({
        title:          String(t.title       || '').slice(0, 200),
        description:    String(t.description || '').slice(0, 500),
        priority:       ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
        estimatedHours: typeof t.estimatedHours === 'number' ? t.estimatedHours : null,
      }));
    } catch {
      throw new Error(`AI returned invalid JSON for tasks: ${raw?.slice(0, 100)}`);
    }
  });
};

export {};
