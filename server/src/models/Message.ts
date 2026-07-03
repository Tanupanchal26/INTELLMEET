// @ts-nocheck
const mongoose = require('mongoose');

// ── Attachment sub-document ───────────────────────────────────────────────────
const attachmentSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  name:     { type: String, required: true },
  mimeType: { type: String, default: '' },
  size:     { type: Number, default: 0 }, // bytes
}, { _id: false });

// ── Reaction sub-document ─────────────────────────────────────────────────────
const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const messageSchema = new mongoose.Schema({
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  // Context — either channel OR meeting (not both)
  channel:   { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', index: true },
  meeting:   { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', index: true },
  // Thread support
  parentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null, index: true },
  threadCount: { type: Number, default: 0 },

  sender:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:     { type: String, required: true, maxlength: 4000 },
  type:        { type: String, enum: ['text', 'file', 'system', 'announcement'], default: 'text' },
  attachments: { type: [attachmentSchema], default: [] },
  reactions:   { type: [reactionSchema],   default: [] },
  mentions:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  isEdited:  { type: Boolean, default: false },
  editedAt:  { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ channel: 1, createdAt: -1 });
messageSchema.index({ meeting: 1, createdAt: -1 });
messageSchema.index({ parentId: 1, createdAt: 1 });
messageSchema.index({ tenantId: 1, channel: 1, createdAt: -1 });
// Filter index so queries with isDeleted: false stay fast as collection grows
messageSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

export {};
