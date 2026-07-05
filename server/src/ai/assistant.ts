// @ts-nocheck
const { getAIProvider } = require('./providers/providerFactory');

const sanitizeUserMessage = (msg: string): string =>
  msg.replace(/\bsystem\b/gi, 'sys').replace(/\bignore previous\b/gi, '').slice(0, 2000);

exports.chat = (userMessage: string, context: {
  transcript?:    string;
  summary?:       string;
  history?:       { role: string; content: string }[];
  meetingTitles?: string[];
} = {}) => getAIProvider().chat(sanitizeUserMessage(userMessage), context);

exports.generateTasks = (prompt: string, transcript = '') =>
  getAIProvider().generateTasks(sanitizeUserMessage(prompt), transcript);

export {};
