"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractKeywords = exports.extractFollowUpSuggestions = exports.summarize = void 0;
const openai_1 = require("./openai");
const constants_1 = require("../constants");
const LENGTH_TOKENS = {
    short: 400,
    medium: 800,
    detailed: 1400,
};
const LENGTH_INSTRUCTION = {
    short: 'Be very concise — 3-5 bullet points per section maximum.',
    medium: 'Be balanced — cover all key points without excessive detail.',
    detailed: 'Be thorough — include all relevant context, nuances, and specifics.',
};
const summarize = async (transcript, length = 'medium') => {
    const client = (0, openai_1.getClient)();
    return (0, openai_1.withRetry)(async () => {
        const res = await client.chat.completions.create({
            model: constants_1.AI_MODEL.GPT4O,
            messages: [
                {
                    role: 'system',
                    content: `You are an expert meeting analyst. Produce a structured meeting summary in markdown.\n${LENGTH_INSTRUCTION[length]}\n\nUse exactly these sections:\n## Executive Summary\n## Key Highlights\n## Discussion Points\n## Important Decisions\n## Meeting Outcome\n\nBe factual, professional, and accurate. Do not invent information not present in the transcript.`,
                },
                { role: 'user', content: `Meeting transcript:\n\n${transcript.slice(0, 40000)}` },
            ],
            max_tokens: LENGTH_TOKENS[length],
            temperature: 0.3,
        });
        return res.choices[0].message.content.trim();
    });
};
exports.summarize = summarize;
const extractFollowUpSuggestions = async (transcript) => {
    const client = (0, openai_1.getClient)();
    return (0, openai_1.withRetry)(async () => {
        const res = await client.chat.completions.create({
            model: constants_1.AI_MODEL.GPT4O,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Extract follow-up suggestions from this meeting transcript.\nReturn JSON: { "suggestions": [{ "text": string, "priority": "high"|"medium"|"low", "owner": string|null }] }\nLimit to the 10 most important. Return empty array if none found.`,
                },
                { role: 'user', content: `Transcript:\n\n${transcript.slice(0, 20000)}` },
            ],
            max_tokens: 500,
            temperature: 0.2,
        });
        const raw = res.choices[0].message.content;
        try {
            const parsed = JSON.parse(raw);
            return (parsed.suggestions || []).map((s) => ({
                text: String(s.text || '').slice(0, 300),
                priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
                owner: s.owner || null,
            }));
        }
        catch {
            return [];
        }
    });
};
exports.extractFollowUpSuggestions = extractFollowUpSuggestions;
const extractKeywords = async (transcript) => {
    const client = (0, openai_1.getClient)();
    return (0, openai_1.withRetry)(async () => {
        const res = await client.chat.completions.create({
            model: constants_1.AI_MODEL.GPT4O,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Extract structured keyword metadata from meeting transcripts.\nReturn JSON: {\n  "topics": string[],\n  "people": string[],\n  "projects": string[],\n  "technologies": string[],\n  "frequentTerms": string[]\n}\nKeep each array to the most relevant 5-10 items. Return empty arrays if nothing found.`,
                },
                { role: 'user', content: `Transcript:\n\n${transcript.slice(0, 20000)}` },
            ],
            max_tokens: 400,
            temperature: 0.2,
        });
        const raw = res.choices[0].message.content;
        try {
            const parsed = JSON.parse(raw);
            return {
                topics: parsed.topics || [],
                people: parsed.people || [],
                projects: parsed.projects || [],
                technologies: parsed.technologies || [],
                frequentTerms: parsed.frequentTerms || [],
            };
        }
        catch {
            return { topics: [], people: [], projects: [], technologies: [], frequentTerms: [] };
        }
    });
};
exports.extractKeywords = extractKeywords;
