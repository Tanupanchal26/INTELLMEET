"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const notifService = require('../services/notification.service');
const { getRedisClient } = require('../config/redis');
const CHANNEL_CACHE_TTL = 60;
const getChannel = async (channelId) => {
    const redis = getRedisClient();
    const key = `channel:meta:${channelId}`;
    if (redis) {
        try {
            const hit = await redis.get(key);
            if (hit) {
                // Safe parse: validate shape before trusting cached data
                const parsed = JSON.parse(hit);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return parsed;
                }
            }
        }
        catch {
            // ignore cache failures and fall back to MongoDB
        }
    }
    const channel = await Channel.findById(channelId).lean();
    if (channel && redis) {
        try {
            await redis.setEx(key, CHANNEL_CACHE_TTL, JSON.stringify(channel));
        }
        catch {
            // ignore cache failures
        }
    }
    return channel;
};
module.exports = (io, socket) => {
    socket.on('chat:join', (meetingId) => {
        if (!meetingId || typeof meetingId !== 'string')
            return;
        socket.join(`chat:${meetingId}`);
    });
    socket.on('chat:message', async ({ meetingId, content }) => {
        if (!socket.user?.id || !content?.trim())
            return;
        try {
            const message = await Message.create({
                meeting: meetingId,
                sender: socket.user.id,
                content,
                type: 'text',
            });
            const populated = await message.populate('sender', 'name avatar');
            io.to(`chat:${meetingId}`).emit('chat:message', populated);
        }
        catch {
            socket.emit('chat:error', { message: 'Failed to send message' });
        }
    });
    socket.on('chat:typing', ({ meetingId, isTyping }) => {
        if (!socket.user?.id)
            return;
        socket.to(`chat:${meetingId}`).emit('chat:typing', {
            userId: socket.user.id,
            name: socket.user.name,
            isTyping,
        });
    });
    socket.on('chat:leave', (meetingId) => {
        if (!meetingId || typeof meetingId !== 'string')
            return;
        socket.leave(`chat:${meetingId}`);
    });
    socket.on('channel:join', (channelId) => {
        if (!channelId || typeof channelId !== 'string')
            return;
        socket.join(`channel:${channelId}`);
    });
    socket.on('channel:message', async ({ channelId, content, mentions = [], attachments = [] }) => {
        if (!socket.user?.id || !content?.trim())
            return;
        try {
            const channel = await getChannel(channelId);
            if (!channel)
                return;
            const [message] = await Promise.all([
                Message.create({
                    tenantId: channel.tenantId,
                    channel: channelId,
                    sender: socket.user.id,
                    content,
                    mentions,
                    attachments,
                    type: attachments.length ? 'file' : 'text',
                }),
                Channel.findByIdAndUpdate(channelId, { lastMessageAt: new Date() }),
            ]);
            const populated = await message.populate('sender', 'name avatar');
            io.to(`channel:${channelId}`).emit('channel:message', populated);
            socket.emit('channel:delivery', { messageId: message._id.toString(), state: 'sent' });
            // Fire mention notifications (fire-and-forget)
            if (mentions.length) {
                const mentionedOthers = mentions.filter((uid) => uid !== socket.user?.id);
                if (mentionedOthers.length) {
                    notifService.notifyChannelMention(channel, mentionedOthers, socket.user?.id, content).catch(() => { });
                }
            }
        }
        catch {
            socket.emit('chat:error', { message: 'Failed to send message' });
        }
    });
    socket.on('channel:typing', ({ channelId, isTyping }) => {
        if (!socket.user?.id)
            return;
        socket.to(`channel:${channelId}`).emit('channel:typing', {
            userId: socket.user.id,
            name: socket.user.name,
            isTyping,
        });
    });
    socket.on('channel:read', ({ channelId, messageId }) => {
        if (!socket.user?.id)
            return;
        socket.to(`channel:${channelId}`).emit('channel:read', { userId: socket.user.id, messageId });
    });
    socket.on('channel:delivered', ({ channelId, messageId }) => {
        if (!socket.user?.id)
            return;
        socket.to(`channel:${channelId}`).emit('channel:delivery', { messageId, state: 'delivered' });
    });
    socket.on('channel:leave', (channelId) => {
        if (!channelId || typeof channelId !== 'string')
            return;
        socket.leave(`channel:${channelId}`);
    });
    socket.on('chat:edit', async ({ messageId, content, channelId, meetingId }) => {
        if (!socket.user?.id || !content?.trim())
            return;
        try {
            const msg = await Message.findOneAndUpdate({ _id: messageId, sender: socket.user.id }, { content, isEdited: true, editedAt: new Date() }, { new: true }).populate('sender', 'name avatar');
            if (!msg)
                return;
            const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
            io.to(room).emit('chat:edited', msg);
        }
        catch {
            socket.emit('chat:error', { message: 'Failed to edit message' });
        }
    });
    socket.on('chat:delete', async ({ messageId, channelId, meetingId }) => {
        if (!socket.user?.id)
            return;
        try {
            const msg = await Message.findOneAndUpdate({ _id: messageId, sender: socket.user.id }, { isDeleted: true, content: '[Message deleted]' }, { new: true });
            if (!msg)
                return;
            const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
            io.to(room).emit('chat:deleted', { messageId });
        }
        catch {
            socket.emit('chat:error', { message: 'Failed to delete message' });
        }
    });
    socket.on('chat:reply', async ({ parentId, channelId, meetingId, content }) => {
        if (!socket.user?.id || !content?.trim() || !parentId)
            return;
        try {
            const [message] = await Promise.all([
                Message.create({
                    channel: channelId || null,
                    meeting: meetingId || null,
                    parentId,
                    sender: socket.user.id,
                    content,
                    type: 'text',
                }),
                Message.findByIdAndUpdate(parentId, { $inc: { threadCount: 1 } }),
            ]);
            const populated = await message.populate('sender', 'name avatar');
            const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
            io.to(room).emit('chat:reply', populated);
        }
        catch {
            socket.emit('chat:error', { message: 'Failed to send reply' });
        }
    });
    socket.on('chat:react', async ({ messageId, emoji, channelId, meetingId }) => {
        if (!socket.user?.id)
            return;
        try {
            const pulled = await Message.findOneAndUpdate({ _id: messageId, 'reactions.emoji': emoji, 'reactions.users': socket.user.id }, { $pull: { 'reactions.$.users': socket.user.id } }, { new: true });
            const updated = pulled ?? await Message.findOneAndUpdate({ _id: messageId, 'reactions.emoji': emoji }, { $addToSet: { 'reactions.$.users': socket.user.id } }, { new: true }) ?? await Message.findOneAndUpdate({ _id: messageId }, { $push: { reactions: { emoji, users: [socket.user.id] } } }, { new: true });
            if (!updated)
                return;
            const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
            io.to(room).emit('chat:reaction', { messageId, reactions: updated.reactions });
        }
        catch {
            socket.emit('chat:error', { message: 'Failed to react to message' });
        }
    });
};
