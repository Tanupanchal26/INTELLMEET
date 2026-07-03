// @ts-nocheck
const mongoose = require('mongoose');

// ── Agenda item sub-document ──────────────────────────────────────────────────
const agendaItemSchema = new mongoose.Schema({
  title:       { type: String, required: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 500 },
  duration:    { type: Number, default: 0 },  // minutes
  presenter:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isDone:      { type: Boolean, default: false },
  order:       { type: Number, default: 0 },
}, { _id: true });

// ── Action item sub-document ──────────────────────────────────────────────────
const actionItemSchema = new mongoose.Schema({
  text:       { type: String, required: true, maxlength: 300 },
  assignee:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dueDate:    { type: Date, default: null },
  isDone:     { type: Boolean, default: false },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true, timestamps: true });

const meetingNoteSchema = new mongoose.Schema({
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: false, default: null, index: true },
  meeting:     { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Pre-meeting agenda
  agenda:      { type: [agendaItemSchema], default: [] },

  // During/post-meeting notes (rich text stored as plain string / markdown)
  content:     { type: String, default: '', maxlength: 50000 },

  // Post-meeting action items (also populated by AI)
  actionItems: { type: [actionItemSchema], default: [] },

  // Visibility
  isPrivate:   { type: Boolean, default: false },
  sharedWith:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// One note doc per meeting (can be upserted)
meetingNoteSchema.index({ meeting: 1 }, { unique: true });

module.exports = mongoose.model('MeetingNote', meetingNoteSchema);

export {};
