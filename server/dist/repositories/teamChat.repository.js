"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const BaseRepository = require('./base.repository');
const TeamMessage = require('../models/TeamMessage');
const ApiError = require('../utils/ApiError');
const { PAGINATION } = require('../constants');
class TeamChatRepository extends BaseRepository {
    constructor() { super(TeamMessage); }
    async getMessages(teamId, tenantId, options = {}) {
        const { limit = PAGINATION.DEFAULT_LIMIT, cursor } = options;
        const query = { team: teamId, tenantId, isDeleted: false };
        if (cursor) {
            query.createdAt = { $lt: new Date(cursor) };
        }
        const messages = await TeamMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .populate('sender', 'name email avatar isOnline lastActive')
            .lean();
        return messages.reverse(); // Return chronological
    }
    async getMessageById(messageId, teamId, tenantId) {
        const message = await TeamMessage.findOne({ _id: messageId, team: teamId, tenantId, isDeleted: false });
        if (!message)
            throw ApiError.notFound('Message not found');
        return message;
    }
}
module.exports = new TeamChatRepository();
