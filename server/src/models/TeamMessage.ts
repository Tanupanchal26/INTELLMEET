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

const teamMessageSchema = new mongoose.Schema({
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  team:      { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  
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

teamMessageSchema.index({ team: 1, createdAt: -1 });
teamMessageSchema.index({ tenantId: 1, team: 1, createdAt: -1 });
teamMessageSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('TeamMessage', teamMessageSchema);

export {};
