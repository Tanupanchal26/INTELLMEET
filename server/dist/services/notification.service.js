"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const notifRepo = require('../repositories/notification.repository');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');
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
const createNotification = async ({ tenantId, recipient, actor = null, type, title, body = '', refModel = null, refId = null, channels = ['in_app'], }) => {
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
        emitEmail(notif).catch(() => { });
    }
    return notif;
};
// ── Email dispatcher ──────────────────────────────────────────────────────────
const emitEmail = async (notif) => {
    // Populate recipient email lazily
    const User = require('../models/User');
    const user = await User.findById(notif.recipient).select('name email');
    if (!user)
        return;
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
    return Promise.all(recipientIds.map(recipient => createNotification({ ...payload, recipient }).catch(() => { })));
};
// ── Meeting notification helpers ──────────────────────────────────────────────
const notifyMeetingInvite = (meeting, inviteeIds, actorId) => notifyMany(inviteeIds, {
    tenantId: meeting.tenantId,
    actor: actorId,
    type: 'meeting_invite',
    title: `You've been invited to "${meeting.title}"`,
    body: `Scheduled at ${meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : 'TBD'}.`,
    refModel: 'Meeting',
    refId: meeting._id,
    channels: ['in_app', 'email'],
});
const notifyMeetingStarted = (meeting, participantIds) => notifyMany(participantIds, {
    tenantId: meeting.tenantId,
    type: 'meeting_started',
    title: `"${meeting.title}" has started`,
    refModel: 'Meeting',
    refId: meeting._id,
    channels: ['in_app'],
});
// ── Meeting reminder notification ───────────────────────────────────────────
const notifyMeetingReminder = (meeting, participantIds) => notifyMany(participantIds, {
    tenantId: meeting.tenantId,
    type: 'meeting_reminder',
    title: `Reminder: "${meeting.title}" starts in 15 minutes`,
    body: `Scheduled at ${meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : 'TBD'}.`,
    refModel: 'Meeting',
    refId: meeting._id,
    link: `/lobby?join=${meeting.meetingId}`,
    channels: ['in_app'],
});
// ── Task assignment notification ──────────────────────────────────────────────
const notifyTaskAssigned = (task, assigneeId, actorId) => createNotification({
    tenantId: task.tenantId,
    recipient: assigneeId,
    actor: actorId,
    type: 'task_assigned',
    title: `You've been assigned a task: "${task.title}"`,
    body: task.description ? task.description.slice(0, 120) : '',
    refModel: 'Task',
    refId: task._id,
    link: `/tasks?highlight=${task._id}`,
    channels: ['in_app'],
});
// ── Action item assigned notification ────────────────────────────────────────
const notifyActionItemAssigned = (meeting, actionItem, assigneeId, actorId) => createNotification({
    tenantId: meeting.tenantId,
    recipient: assigneeId,
    actor: actorId,
    type: 'action_item_assigned',
    title: `Action item assigned: "${actionItem.text || actionItem.title || 'New action item'}"`,
    body: `From meeting: "${meeting.title}"`,
    refModel: 'Meeting',
    refId: meeting._id,
    link: `/ai-summary/${meeting._id}?tab=action-items`,
    channels: ['in_app'],
});
// ── AI summary ready notification ─────────────────────────────────────────────
const notifyAISummaryReady = (meeting, participantIds) => notifyMany(participantIds, {
    tenantId: meeting.tenantId,
    type: 'ai_summary_ready',
    title: `AI summary ready for "${meeting.title}"`,
    body: 'Your meeting summary, action items, and decisions are ready to review.',
    refModel: 'Meeting',
    refId: meeting._id,
    link: `/ai-summary/${meeting._id}`,
    channels: ['in_app'],
});
// ── Channel mention notification ──────────────────────────────────────────────
const notifyChannelMention = (channel, mentionedUserIds, actorId, messagePreview) => notifyMany(mentionedUserIds, {
    tenantId: channel.tenantId,
    actor: actorId,
    type: 'channel_mention',
    title: `You were mentioned in #${channel.name}`,
    body: messagePreview ? messagePreview.slice(0, 120) : '',
    refModel: 'Channel',
    refId: channel._id,
    link: `/teams/${channel.team}/channels/${channel._id}`,
    channels: ['in_app'],
});
// ── Team invite notification ──────────────────────────────────────────────────
const notifyTeamInvite = (team, newMemberId, actorId) => createNotification({
    tenantId: team.tenantId,
    recipient: newMemberId,
    actor: actorId,
    type: 'team_invite',
    title: `You've been invited to team "${team.name}"`,
    body: 'Click Accept to join the team.',
    link: `/teams/${team._id}`,
    refModel: 'Team',
    refId: team._id,
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
const markRead = (notifId, userId) => notifRepo.markRead(notifId, userId);
const markAllRead = (userId) => notifRepo.markAllRead(userId);
module.exports = {
    init,
    createNotification,
    notifyMany,
    notifyMeetingInvite,
    notifyMeetingStarted,
    notifyMeetingReminder,
    notifyTeamInvite,
    notifyTaskAssigned,
    notifyActionItemAssigned,
    notifyAISummaryReady,
    notifyChannelMention,
    getUserNotifications,
    markRead,
    markAllRead,
};
