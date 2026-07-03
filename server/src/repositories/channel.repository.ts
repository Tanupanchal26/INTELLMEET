// @ts-nocheck
const BaseRepository = require('./base.repository');
const Channel = require('../models/Channel');
const ApiError = require('../utils/ApiError');

class ChannelRepository extends BaseRepository {
  constructor() { super(Channel); }

  findByTeam(teamId, tenantId, userId) {
    return Channel.find({
      team: teamId,
      tenantId,
      isArchived: false,
      $or: [{ type: 'public' }, { type: 'announcement' }, { members: userId }],
    }).sort({ isDefault: -1, name: 1 });
  }

  findBySlug(teamId, slug) {
    return Channel.findOne({ team: teamId, slug, isArchived: false });
  }

  async addMember(channelId, userId) {
    return Channel.findByIdAndUpdate(
      channelId,
      { $addToSet: { members: userId } },
      { new: true }
    );
  }

  async removeMember(channelId, userId) {
    return Channel.findByIdAndUpdate(
      channelId,
      { $pull: { members: userId } },
      { new: true }
    );
  }

  async pinMessage(channelId, messageId) {
    return Channel.findByIdAndUpdate(
      channelId,
      { $addToSet: { pinnedMessages: messageId } },
      { new: true }
    );
  }

  async unpinMessage(channelId, messageId) {
    return Channel.findByIdAndUpdate(
      channelId,
      { $pull: { pinnedMessages: messageId } },
      { new: true }
    );
  }

  touchLastMessage(channelId) {
    return Channel.findByIdAndUpdate(channelId, { lastMessageAt: new Date() });
  }
}

module.exports = new ChannelRepository();

export {};
