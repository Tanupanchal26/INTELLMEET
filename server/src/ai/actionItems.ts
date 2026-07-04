import { generate, withRetry, parseJSON } from './gemini';

export interface ActionItem {
  text: string;
  assignee: string | null;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done';
}

export interface Decision {
  text: string;
  type: 'approved' | 'rejected' | 'pending';
  owner: string | null;
  impact: 'high' | 'medium' | 'low';
  risks: string[];
  dependencies: string[];
}

export const extractActionItems = async (transcript: string): Promise<ActionItem[]> => {
  const prompt = `Extract all action items from the meeting transcript.
Return ONLY valid JSON (no markdown fences):
{
  "actionItems": [
    {
      "text":     string,
      "assignee": string | null,
      "dueDate":  string | null,
      "priority": "high" | "medium" | "low",
      "status":   "pending" | "in_progress" | "done"
    }
  ]
}
Rules:
- Only include explicit tasks/commitments, not general discussion.
- Set priority "high" for urgent/blocking items, "low" for nice-to-haves.
- Set status "done" only if explicitly marked complete in the transcript.
- Return empty array if no action items found.

Transcript:

${transcript.slice(0, 30000)}`;

  return withRetry(async () => {
    const raw = await generate(prompt);
    try {
      const parsed = parseJSON<{ actionItems: any[] }>(raw);
      return (parsed.actionItems || []).map((item: any) => ({
        text:     String(item.text     || '').slice(0, 300),
        assignee: item.assignee ? String(item.assignee).slice(0, 100) : null,
        dueDate:  item.dueDate  ? String(item.dueDate).slice(0, 50)   : null,
        priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
        status:   ['pending', 'in_progress', 'done'].includes(item.status) ? item.status : 'pending',
      }));
    } catch {
      throw new Error(`AI returned invalid JSON for action items: ${raw?.slice(0, 100)}`);
    }
  });
};

export const extractDecisions = async (transcript: string): Promise<Decision[]> => {
  const prompt = `Extract all decisions made during the meeting.
Return ONLY valid JSON (no markdown fences):
{
  "decisions": [
    {
      "text":         string,
      "type":         "approved" | "rejected" | "pending",
      "owner":        string | null,
      "impact":       "high" | "medium" | "low",
      "risks":        string[],
      "dependencies": string[]
    }
  ]
}
Rules:
- Only include explicit decisions, not suggestions or discussions.
- "approved" = agreed upon, "rejected" = explicitly declined, "pending" = deferred.
- risks and dependencies should be concise strings (max 5 each).
- Return empty array if no decisions found.

Transcript:

${transcript.slice(0, 30000)}`;

  return withRetry(async () => {
    const raw = await generate(prompt);
    try {
      const parsed = parseJSON<{ decisions: any[] }>(raw);
      return (parsed.decisions || []).map((d: any) => ({
        text:         String(d.text   || '').slice(0, 300),
        type:         ['approved', 'rejected', 'pending'].includes(d.type) ? d.type : 'pending',
        owner:        d.owner ? String(d.owner).slice(0, 100) : null,
        impact:       ['high', 'medium', 'low'].includes(d.impact) ? d.impact : 'medium',
        risks:        Array.isArray(d.risks)        ? d.risks.slice(0, 5).map(String)        : [],
        dependencies: Array.isArray(d.dependencies) ? d.dependencies.slice(0, 5).map(String) : [],
      }));
    } catch {
      throw new Error(`AI returned invalid JSON for decisions: ${raw?.slice(0, 100)}`);
    }
  });
};
