// @ts-nocheck
const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  name:        { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  slug:        { type: String, required: true, lowercase: true, trim: true },
  description: { type: String, default: '', maxlength: 300 },
  topic:       { type: String, default: '', maxlength: 200 },
  type:        { type: String, enum: ['public', 'private', 'announcement', 'dm'], default: 'public' },
  isArchived:  { type: Boolean, default: false },
  isDefault:   { type: Boolean, default: false }, // default #general channel
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessageAt: { type: Date, default: null },
}, { timestamps: true });

channelSchema.index({ team: 1, slug: 1 }, { unique: true });
channelSchema.index({ team: 1, isArchived: 1 });
channelSchema.index({ tenantId: 1, team: 1 });

module.exports = mongoose.model('Channel', channelSchema);


