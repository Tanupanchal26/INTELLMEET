import type { Server, Socket } from 'socket.io';

const Message = require('../models/Message');
const Channel = require('../models/Channel');
const { getRedisClient } = require('../config/redis');

const CHANNEL_CACHE_TTL = 60;

type ChatUser = {
  id?: string;
  name?: string;
};

type ChatSocket = Socket & { user?: ChatUser };

type ChannelPayload = {
  tenantId?: string;
  _id?: string;
};

const getChannel = async (channelId: string): Promise<ChannelPayload | null> => {
  const redis = getRedisClient();
  const key = `channel:meta:${channelId}`;

  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit) {
        // Safe parse: validate shape before trusting cached data
        const parsed = JSON.parse(hit);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as ChannelPayload;
        }
      }
    } catch {
      // ignore cache failures and fall back to MongoDB
    }
  }

  const channel = await Channel.findById(channelId).lean();
  if (channel && redis) {
    try {
      await redis.setEx(key, CHANNEL_CACHE_TTL, JSON.stringify(channel));
    } catch {
      // ignore cache failures
    }
  }
  return channel as ChannelPayload | null;
};

module.exports = (io: Server, socket: ChatSocket): void => {
  socket.on('chat:join', (meetingId: string) => socket.join(`chat:${meetingId}`));

  socket.on('chat:message', async ({ meetingId, content }: { meetingId: string; content: string }) => {
    if (!socket.user?.id || !content?.trim()) return;
    try {
      const message = await Message.create({
        meeting: meetingId,
        sender: socket.user.id,
        content,
        type: 'text',
      });
      const populated = await message.populate('sender', 'name avatar');
      io.to(`chat:${meetingId}`).emit('chat:message', populated);
    } catch {
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  socket.on('chat:typing', ({ meetingId, isTyping }: { meetingId: string; isTyping: boolean }) => {
    if (!socket.user?.id) return;
    socket.to(`chat:${meetingId}`).emit('chat:typing', {
      userId: socket.user.id,
      name: socket.user.name,
      isTyping,
    });
  });

  socket.on('chat:leave', (meetingId: string) => socket.leave(`chat:${meetingId}`));

  socket.on('channel:join', (channelId: string) => socket.join(`channel:${channelId}`));

  socket.on('channel:message', async ({ channelId, content, mentions = [], attachments = [] }: { channelId: string; content: string; mentions?: string[]; attachments?: string[] }) => {
    if (!socket.user?.id || !content?.trim()) return;
    try {
      const channel = await getChannel(channelId);
      if (!channel) return;

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
    } catch {
      socket.emit('chat:error', { message: 'Failed to send message' });
    }
  });

  socket.on('channel:typing', ({ channelId, isTyping }: { channelId: string; isTyping: boolean }) => {
    if (!socket.user?.id) return;
    socket.to(`channel:${channelId}`).emit('channel:typing', {
      userId: socket.user.id,
      name: socket.user.name,
      isTyping,
    });
  });

  socket.on('channel:read', ({ channelId, messageId }: { channelId: string; messageId: string }) => {
    if (!socket.user?.id) return;
    socket.to(`channel:${channelId}`).emit('channel:read', { userId: socket.user.id, messageId });
  });

  socket.on('channel:delivered', ({ channelId, messageId }: { channelId: string; messageId: string }) => {
    if (!socket.user?.id) return;
    socket.to(`channel:${channelId}`).emit('channel:delivery', { messageId, state: 'delivered' });
  });

  socket.on('channel:leave', (channelId: string) => socket.leave(`channel:${channelId}`));

  socket.on('chat:edit', async ({ messageId, content, channelId, meetingId }: { messageId: string; content: string; channelId?: string; meetingId?: string }) => {
    if (!socket.user?.id || !content?.trim()) return;
    const msg = await Message.findOneAndUpdate(
      { _id: messageId, sender: socket.user.id },
      { content, isEdited: true, editedAt: new Date() },
      { new: true }
    ).populate('sender', 'name avatar');
    if (!msg) return;
    const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
    io.to(room).emit('chat:edited', msg);
  });

  socket.on('chat:delete', async ({ messageId, channelId, meetingId }: { messageId: string; channelId?: string; meetingId?: string }) => {
    if (!socket.user?.id) return;
    const msg = await Message.findOneAndUpdate(
      { _id: messageId, sender: socket.user.id },
      { isDeleted: true, content: '[Message deleted]' },
      { new: true }
    );
    if (!msg) return;
    const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
    io.to(room).emit('chat:deleted', { messageId });
  });

  socket.on('chat:reply', async ({ parentId, channelId, meetingId, content }: { parentId: string; channelId?: string; meetingId?: string; content: string }) => {
    if (!socket.user?.id || !content?.trim() || !parentId) return;
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
  });

  socket.on('chat:react', async ({ messageId, emoji, channelId, meetingId }: { messageId: string; emoji: string; channelId?: string; meetingId?: string }) => {
    if (!socket.user?.id) return;

    const pulled = await Message.findOneAndUpdate(
      { _id: messageId, 'reactions.emoji': emoji, 'reactions.users': socket.user.id },
      { $pull: { 'reactions.$.users': socket.user.id } },
      { new: true }
    );

    const updated = pulled ?? await Message.findOneAndUpdate(
      { _id: messageId, 'reactions.emoji': emoji },
      { $addToSet: { 'reactions.$.users': socket.user.id } },
      { new: true }
    ) ?? await Message.findOneAndUpdate(
      { _id: messageId },
      { $push: { reactions: { emoji, users: [socket.user.id] } } },
      { new: true }
    );

    if (!updated) return;
    const room = channelId ? `channel:${channelId}` : `chat:${meetingId}`;
    io.to(room).emit('chat:reaction', { messageId, reactions: updated.reactions });
  });
};

export {};
