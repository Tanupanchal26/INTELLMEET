// @ts-nocheck
const mongoose = require('mongoose');

const NOTIF_TYPES = [
  'meeting_invite',
  'meeting_started',
  'meeting_ended',
  'meeting_reminder',
  'team_invite',
  'team_role_changed',
  'channel_mention',
  'message_reply',
  'task_assigned',
  'task_due',
  'system',
];

const notificationSchema = new mongoose.Schema({
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  type:    { type: String, enum: NOTIF_TYPES, required: true },
  title:   { type: String, required: true, maxlength: 120 },
  body:    { type: String, default: '', maxlength: 500 },

  // Polymorphic reference — the resource this notification links to
  refModel: { type: String, enum: ['Meeting', 'Team', 'Channel', 'Message', 'Task'], default: null },
  refId:    { type: mongoose.Schema.Types.ObjectId, default: null },

  isRead:   { type: Boolean, default: false, index: true },
  readAt:   { type: Date, default: null },

  // Email delivery tracking
  emailSent:   { type: Boolean, default: false },
  emailSentAt: { type: Date, default: null },

  // Push / in-app channel
  channels: {
    type: [String],
    enum: ['in_app', 'email', 'push'],
    default: ['in_app'],
  },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Auto-expire notifications after 90 days to prevent unbounded collection growth
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);

export {};
