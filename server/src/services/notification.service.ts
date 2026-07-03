// @ts-nocheck
const notifRepo   = require('../repositories/notification.repository');
const emailService = require('./email.service');
const ApiError    = require('../utils/ApiError');
const { PAGINATION } = require('../constants');

/**
 * Module-level Socket.IO server instance.
 * Intentional mutable global — injected once at startup via init(io).
 * Must be set before any notification that requires real-time push.
 * @type {import('socket.io').Server | null}
 */
let _io = null;
const init = (io) => { _io = io; };

// ── Internal creator ──────────────────────────────────────────────────────────
const createNotification = async ({
  tenantId, recipient, actor = null,
  type, title, body = '',
  refModel = null, refId = null,
  channels = ['in_app'],
}) => {
  const notif = await notifRepo.create({
    tenantId, recipient, actor,
    type, title, body,
    refModel, refId,
    channels,
  });

  // Push real-time via socket.io if user is online
  if (_io && channels.includes('in_app')) {
    _io.to(`user:${recipient}`).emit('notification:new', notif);
  }

  // Fire-and-forget email
  if (channels.includes('email')) {
    emitEmail(notif).catch(() => {});
  }

  return notif;
};

// ── Email dispatcher ──────────────────────────────────────────────────────────
const emitEmail = async (notif) => {
  // Populate recipient email lazily
  const User = require('../models/User');
  const user = await User.findById(notif.recipient).select('name email');
  if (!user) return;

  await emailService.send({
    to: user.email,
    subject: `IntellMeet — ${notif.title}`,
    html: `
      <h2>Hi ${user.name},</h2>
      <p>${notif.body || notif.title}</p>
      <p style="color:#9CA3AF;font-size:12px;margin-top:24px">
        You received this notification from IntellMeet.
      </p>
    `,
  });

  await notifRepo.Model.findByIdAndUpdate(notif._id, {
    emailSent: true, emailSentAt: new Date(),
  });
};

// ── Batch notifications (e.g. meeting invite to many) ────────────────────────
const notifyMany = async (recipientIds, payload) => {
  return Promise.all(recipientIds.map(recipient =>
    createNotification({ ...payload, recipient }).catch(() => {})
  ));
};

// ── Meeting notification helpers ──────────────────────────────────────────────
const notifyMeetingInvite = (meeting, inviteeIds, actorId) =>
  notifyMany(inviteeIds, {
    tenantId: meeting.tenantId,
    actor:    actorId,
    type:     'meeting_invite',
    title:    `You've been invited to "${meeting.title}"`,
    body:     `Scheduled at ${meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : 'TBD'}.`,
    refModel: 'Meeting',
    refId:    meeting._id,
    channels: ['in_app', 'email'],
  });

const notifyMeetingStarted = (meeting, participantIds) =>
  notifyMany(participantIds, {
    tenantId: meeting.tenantId,
    type:     'meeting_started',
    title:    `"${meeting.title}" has started`,
    refModel: 'Meeting',
    refId:    meeting._id,
    channels: ['in_app'],
  });

// ── Team invite notification ──────────────────────────────────────────────────
const notifyTeamInvite = (team, newMemberId, actorId) =>
  createNotification({
    tenantId: team.tenantId,
    recipient: newMemberId,
    actor:    actorId,
    type:     'team_invite',
    title:    `You've been added to team "${team.name}"`,
    refModel: 'Team',
    refId:    team._id,
    channels: ['in_app', 'email'],
  });

// ── User query methods ────────────────────────────────────────────────────────
const getUserNotifications = async (userId, { page, limit, unreadOnly }) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(PAGINATION.MAX_LIMIT, parseInt(limit) || PAGINATION.DEFAULT_LIMIT);
  const [data, total, unread] = await Promise.all([
    notifRepo.findForUser(userId, { page: p, limit: l, unreadOnly }),
    notifRepo.count(null, { recipient: userId }),
    notifRepo.countUnread(userId),
  ]);
  return { data, total, unread, page: p, limit: l };
};

const markRead    = (notifId, userId) => notifRepo.markRead(notifId, userId);
const markAllRead = (userId) => notifRepo.markAllRead(userId);

module.exports = {
  init,
  createNotification,
  notifyMany,
  notifyMeetingInvite,
  notifyMeetingStarted,
  notifyTeamInvite,
  getUserNotifications,
  markRead,
  markAllRead,
};

export {};
