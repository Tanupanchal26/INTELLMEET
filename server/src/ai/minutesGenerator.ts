// @ts-nocheck
const { generate, withRetry, parseJSON } = require('./gemini');

/**
 * Generate formal meeting minutes in markdown.
 */
exports.generateMinutes = async ({ transcript, title, participants = [], date }: {
  transcript:   string;
  title:        string;
  participants: string[];
  date:         string;
}): Promise<string> => {
  const context = `Meeting: "${title}"\nDate: ${date}\nParticipants: ${participants.join(', ') || 'Unknown'}`;

  const prompt = `You are a professional meeting secretary. Generate formal meeting minutes in markdown.

Use exactly these sections:
# Meeting Minutes
## Meeting Details
## Attendees
## Agenda Items Discussed
## Key Decisions
## Action Items
| Task | Owner | Due Date | Priority | Status |
|------|-------|----------|----------|--------|
## Questions & Answers
## Follow-up Items
## Next Steps

Be concise, professional, and accurate. Only include information from the transcript.

${context}

Transcript:
${transcript.slice(0, 40000)}`;

  return withRetry(() => generate(prompt));
};

/**
 * Generate smart meeting notes with topics, follow-ups, Q&A, and agenda completion.
 */
exports.generateSmartNotes = async ({ transcript, title, agenda = [] }: {
  transcript: string;
  title:      string;
  agenda:     string[];
}): Promise<{
  topicsCovered:    string[];
  followUpItems:    string[];
  questionsAsked:   string[];
  answersGiven:     string[];
  agendaCompletion: number;
  notesMarkdown:    string;
}> => {
  const prompt = `Analyze the meeting transcript and generate smart notes.
Return ONLY valid JSON (no markdown fences):
{
  "topicsCovered":    string[],
  "followUpItems":    string[],
  "questionsAsked":   string[],
  "answersGiven":     string[],
  "agendaCompletion": number (0-100, percentage of agenda items covered),
  "notesMarkdown":    string (organized markdown notes)
}
Keep arrays to the most relevant 10 items each. Be concise and factual.

Meeting: "${title}"
Agenda: ${agenda.join(', ') || 'Not specified'}

Transcript:
${transcript.slice(0, 30000)}`;

  return withRetry(async () => {
    const raw = await generate(prompt);
    try {
      const parsed = parseJSON(raw);
      return {
        topicsCovered:    Array.isArray(parsed.topicsCovered)  ? parsed.topicsCovered  : [],
        followUpItems:    Array.isArray(parsed.followUpItems)  ? parsed.followUpItems  : [],
        questionsAsked:   Array.isArray(parsed.questionsAsked) ? parsed.questionsAsked : [],
        answersGiven:     Array.isArray(parsed.answersGiven)   ? parsed.answersGiven   : [],
        agendaCompletion: typeof parsed.agendaCompletion === 'number' ? Math.min(100, Math.max(0, parsed.agendaCompletion)) : 0,
        notesMarkdown:    typeof parsed.notesMarkdown === 'string' ? parsed.notesMarkdown : '',
      };
    } catch {
      throw new Error(`AI returned invalid JSON for smart notes: ${raw?.slice(0, 100)}`);
    }
  });
};

export {};
