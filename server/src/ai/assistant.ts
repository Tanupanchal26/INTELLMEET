import { getAIProvider } from './providers/providerFactory';

const sanitize = (msg: string): string =>
  msg.replace(/\bsystem\b/gi, 'sys').replace(/\bignore previous\b/gi, '').slice(0, 2000);

export const chat = (
  userMessage: string,
  context: {
    transcript?:    string;
    summary?:       string;
    history?:       { role: string; content: string }[];
    meetingTitles?: string[];
    meetingTitle?:  string;
  } = {},
) => getAIProvider().chat(sanitize(userMessage), context);

export const generateTasks = (prompt: string, transcript = '') =>
  getAIProvider().generateTasks(sanitize(prompt), transcript);
