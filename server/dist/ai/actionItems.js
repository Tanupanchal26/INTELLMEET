"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDecisions = exports.extractActionItems = void 0;
const openai_1 = require("./openai");
const constants_1 = require("../constants");
const extractActionItems = async (transcript) => {
    const client = (0, openai_1.getClient)();
    return (0, openai_1.withRetry)(async () => {
        const res = await client.chat.completions.create({
            model: constants_1.AI_MODEL.GPT4O,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Extract all action items from the meeting transcript.\nReturn JSON: {\n  "actionItems": [\n    {\n      "text":     string,\n      "assignee": string | null,\n      "dueDate":  string | null,\n      "priority": "high" | "medium" | "low",\n      "status":   "pending" | "in_progress" | "done"\n    }\n  ]\n}\nRules:\n- Only include explicit tasks/commitments, not general discussion.\n- Set priority "high" for urgent/blocking items, "low" for nice-to-haves.\n- Set status "done" only if explicitly marked complete in the transcript.\n- Return empty array if no action items found.`,
                },
                { role: 'user', content: `Transcript:\n\n${transcript.slice(0, 30000)}` },
            ],
            max_tokens: 800,
            temperature: 0.2,
        });
        const raw = res.choices[0].message.content;
        try {
            const parsed = JSON.parse(raw);
            return (parsed.actionItems || []).map((item) => ({
                text: String(item.text || '').slice(0, 300),
                assignee: item.assignee ? String(item.assignee).slice(0, 100) : null,
                dueDate: item.dueDate ? String(item.dueDate).slice(0, 50) : null,
                priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
                status: ['pending', 'in_progress', 'done'].includes(item.status) ? item.status : 'pending',
            }));
        }
        catch {
            throw new Error(`AI returned invalid JSON for action items: ${raw?.slice(0, 100)}`);
        }
    });
};
exports.extractActionItems = extractActionItems;
const extractDecisions = async (transcript) => {
    const client = (0, openai_1.getClient)();
    return (0, openai_1.withRetry)(async () => {
        const res = await client.chat.completions.create({
            model: constants_1.AI_MODEL.GPT4O,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Extract all decisions made during the meeting.\nReturn JSON: {\n  "decisions": [\n    {\n      "text":         string,\n      "type":         "approved" | "rejected" | "pending",\n      "owner":        string | null,\n      "impact":       "high" | "medium" | "low",\n      "risks":        string[],\n      "dependencies": string[]\n    }\n  ]\n}\nRules:\n- Only include explicit decisions, not suggestions or discussions.\n- "approved" = agreed upon, "rejected" = explicitly declined, "pending" = deferred.\n- risks and dependencies should be concise strings (max 5 each).\n- Return empty array if no decisions found.`,
                },
                { role: 'user', content: `Transcript:\n\n${transcript.slice(0, 30000)}` },
            ],
            max_tokens: 800,
            temperature: 0.2,
        });
        const raw = res.choices[0].message.content;
        try {
            const parsed = JSON.parse(raw);
            return (parsed.decisions || []).map((d) => ({
                text: String(d.text || '').slice(0, 300),
                type: ['approved', 'rejected', 'pending'].includes(d.type) ? d.type : 'pending',
                owner: d.owner ? String(d.owner).slice(0, 100) : null,
                impact: ['high', 'medium', 'low'].includes(d.impact) ? d.impact : 'medium',
                risks: Array.isArray(d.risks) ? d.risks.slice(0, 5).map(String) : [],
                dependencies: Array.isArray(d.dependencies) ? d.dependencies.slice(0, 5).map(String) : [],
            }));
        }
        catch {
            throw new Error(`AI returned invalid JSON for decisions: ${raw?.slice(0, 100)}`);
        }
    });
};
exports.extractDecisions = extractDecisions;
