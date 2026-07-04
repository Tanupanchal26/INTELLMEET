"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const channelRepo = require('../repositories/channel.repository');
const teamRepo = require('../repositories/team.repository');
const Message = require('../models/Message');
const notifService = require('./notification.service');
const ApiError = require('../utils/ApiError');
const { PAGINATION } = require('../constants');
const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// ── Guard: must be team member ────────────────────────────────────────────────
const assertTeamMember = async (teamId, tenantId, userId) => {
    const team = await teamRepo.findById(teamId, tenantId);
    const role = teamRepo.getMemberRole(team, userId);
    if (!role)
        throw ApiError.forbidden('You are not a member of this team');
    return { team, role };
};
// ── Create channel ────────────────────────────────────────────────────────────
const createChannel = async (teamId, tenantId, userId, data) => {
    await assertTeamMember(teamId, tenantId, userId);
    const slug = slugify(data.name);
    const exists = await channelRepo.findBySlug(teamId, slug);
    if (exists)
        throw ApiError.conflict(`Channel "#${slug}" already exists`);
    return channelRepo.create({
        tenantId,
        team: teamId,
        slug,
        createdBy: userId,
        members: [userId],
        ...data,
    });
};
// ── List channels for team ────────────────────────────────────────────────────
const getTeamChannels = async (teamId, tenantId, userId) => {
    await assertTeamMember(teamId, tenantId, userId);
    return channelRepo.findByTeam(teamId, tenantId, userId);
};
// ── Get channel ───────────────────────────────────────────────────────────────
const getChannel = async (channelId, tenantId, userId) => {
    const channel = await channelRepo.findById(channelId, tenantId, [{ path: 'members', select: 'name avatar' }, { path: 'createdBy', select: 'name' }]);
    if (channel.type === 'private' && !channel.members.some(m => m._id.toString() === userId.toString())) {
        throw ApiError.forbidden('You are not a member of this private channel');
    }
    return channel;
};
// ── Update channel ────────────────────────────────────────────────────────────
const updateChannel = async (channelId, tenantId, userId, data) => {
    const channel = await channelRepo.findById(channelId, tenantId);
    const { team, role } = await assertTeamMember(channel.team, tenantId, userId);
    if (!['owner', 'admin'].includes(role) && channel.createdBy.toString() !== userId.toString()) {
        throw ApiError.forbidden('Requires channel creator or team admin');
    }
    return channelRepo.updateById(channelId, tenantId, data);
};
// ── Archive / delete channel ──────────────────────────────────────────────────
const archiveChannel = async (channelId, tenantId, userId) => {
    const channel = await channelRepo.findById(channelId, tenantId);
    if (channel.isDefault)
        throw ApiError.badRequest('Cannot archive the default channel');
    const { role } = await assertTeamMember(channel.team, tenantId, userId);
    if (!['owner', 'admin'].includes(role))
        throw ApiError.forbidden('Requires team admin');
    return channelRepo.updateById(channelId, tenantId, { isArchived: true });
};
// ── Messages ──────────────────────────────────────────────────────────────────
const getMessages = async (channelId, tenantId, userId, { page = 1, limit = 50, before } = {}) => {
    await getChannel(channelId, tenantId, userId); // access check
    const filter = { channel: channelId, isDeleted: false, parentId: null };
    if (before)
        filter.createdAt = { $lt: new Date(before) };
    const [data, total] = await Promise.all([
        Message.find(filter)
            .populate('sender', 'name avatar')
            .populate('mentions', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Message.countDocuments(filter),
    ]);
    return { data: data.reverse(), total, page, limit };
};
const sendMessage = async (channelId, tenantId, userId, { content, attachments = [], mentions = [] }) => {
    const channel = await getChannel(channelId, tenantId, userId);
    const msg = await Message.create({
        tenantId, channel: channelId,
        sender: userId, content, attachments, mentions,
        type: attachments.length ? 'file' : 'text',
    });
    await channelRepo.touchLastMessage(channelId);
    // Notify mentioned users
    if (mentions.length) {
        notifService.notifyMany(mentions, {
            tenantId,
            actor: userId,
            type: 'channel_mention',
            title: 'You were mentioned in a message',
            body: content.slice(0, 100),
            refModel: 'Message',
            refId: msg._id,
            channels: ['in_app'],
        }).catch(() => { });
    }
    return Message.findById(msg._id).populate('sender', 'name avatar');
};
const editMessage = async (msgId, userId, content) => {
    const msg = await Message.findOne({ _id: msgId, sender: userId, isDeleted: false });
    if (!msg)
        throw ApiError.notFound('Message not found or not yours');
    msg.content = content;
    msg.isEdited = true;
    msg.editedAt = new Date();
    return msg.save();
};
const deleteMessage = async (msgId, userId) => {
    const msg = await Message.findOne({ _id: msgId, sender: userId });
    if (!msg)
        throw ApiError.notFound('Message not found or not yours');
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.content = '[Message deleted]';
    return msg.save();
};
const toggleReaction = async (msgId, userId, emoji) => {
    const msg = await Message.findById(msgId);
    if (!msg)
        throw ApiError.notFound('Message not found');
    const idx = msg.reactions.findIndex(r => r.emoji === emoji);
    if (idx === -1) {
        msg.reactions.push({ emoji, users: [userId] });
    }
    else {
        const userIdx = msg.reactions[idx].users.indexOf(userId);
        if (userIdx === -1)
            msg.reactions[idx].users.push(userId);
        else
            msg.reactions[idx].users.splice(userIdx, 1);
        if (msg.reactions[idx].users.length === 0)
            msg.reactions.splice(idx, 1);
    }
    return msg.save();
};
module.exports = {
    createChannel, getTeamChannels, getChannel,
    updateChannel, archiveChannel,
    getMessages, sendMessage, editMessage, deleteMessage, toggleReaction,
};
