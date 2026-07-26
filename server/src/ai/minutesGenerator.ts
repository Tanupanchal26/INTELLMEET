import { getAIProvider } from './providers/providerFactory';

export const generateMinutes = (opts: {
  transcript:   string;
  title:        string;
  participants: string[];
  date:         string;
}) => getAIProvider().generateMinutes(opts);

export const generateSmartNotes = (opts: {
  transcript: string;
  title:      string;
  agenda:     string[];
}) => getAIProvider().generateSmartNotes(opts);
