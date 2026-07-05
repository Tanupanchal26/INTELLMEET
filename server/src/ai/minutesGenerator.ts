// @ts-nocheck
const { getAIProvider } = require('./providers/providerFactory');

exports.generateMinutes = (opts: {
  transcript:   string;
  title:        string;
  participants: string[];
  date:         string;
}) => getAIProvider().generateMinutes(opts);

exports.generateSmartNotes = (opts: {
  transcript: string;
  title:      string;
  agenda:     string[];
}) => getAIProvider().generateSmartNotes(opts);

export {};
