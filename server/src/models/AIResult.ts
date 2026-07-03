// @ts-nocheck
const mongoose = require('mongoose');

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const transcriptChunkSchema = new mongoose.Schema({
  text:    { type: String, required: true, maxlength: 2000 },
  speaker: { type: String, default: '' },
  ts:      { type: Number, default: Date.now },
}, { _id: false });

const actionItemSchema = new mongoose.Schema({
  text:     { type: String, required: true, maxlength: 300 },
  assignee: { type: String, default: null },
  dueDate:  { type: String, default: null },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status:   { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
  done:     { type: Boolean, default: false },
}, { _id: true });

const decisionSchema = new mongoose.Schema({
  text:         { type: String, required: true, maxlength: 300 },
  type:         { type: String, enum: ['approved', 'rejected', 'pending'], default: 'pending' },
  owner:        { type: String, default: null },
  impact:       { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  risks:        [{ type: String, maxlength: 200 }],
  dependencies: [{ type: String, maxlength: 200 }],
}, { _id: true });

const keywordsSchema = new mongoose.Schema({
  topics:        [{ type: String, maxlength: 100 }],
  people:        [{ type: String, maxlength: 100 }],
  projects:      [{ type: String, maxlength: 100 }],
  technologies:  [{ type: String, maxlength: 100 }],
  frequentTerms: [{ type: String, maxlength: 100 }],
}, { _id: false });

const smartNotesSchema = new mongoose.Schema({
  topicsCovered:    [{ type: String, maxlength: 200 }],
  followUpItems:    [{ type: String, maxlength: 200 }],
  questionsAsked:   [{ type: String, maxlength: 300 }],
  answersGiven:     [{ type: String, maxlength: 300 }],
  agendaCompletion: { type: Number, default: 0, min: 0, max: 100 },
  notesMarkdown:    { type: String, default: '', maxlength: 20000 },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────

const aiResultSchema = new mongoose.Schema({
  meeting: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Meeting',
    required: true,
    unique:   true,
    index:    true,
  },

  // Transcript
  transcript:       { type: String, default: '' },
  transcriptChunks: { type: [transcriptChunkSchema], default: [] },

  // AI outputs
  summary:       { type: String, default: '' },
  summaryLength: { type: String, enum: ['short', 'medium', 'detailed'], default: 'medium' },
  minutes:       { type: String, default: '' },
  actionItems:   { type: [actionItemSchema], default: [] },
  decisions:     { type: [decisionSchema],   default: [] },
  keywords:      { type: keywordsSchema,     default: () => ({}) },
  smartNotes:    { type: smartNotesSchema,   default: () => ({}) },

  // Processing state
  processingStatus: {
    type:    String,
    enum:    ['idle', 'processing', 'completed', 'failed'],
    default: 'idle',
  },
  processingError: { type: String, default: null },

  // Version tracking for cache invalidation
  version: { type: Number, default: 1 },
}, { timestamps: true });

// Compound index for tenant-scoped queries via meeting join
aiResultSchema.index({ meeting: 1, updatedAt: -1 });

module.exports = mongoose.model('AIResult', aiResultSchema);

export {};
