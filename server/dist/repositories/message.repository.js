"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const BaseRepository = require('./base.repository');
const Message = require('../models/Message');
class MessageRepository extends BaseRepository {
    constructor() { super(Message); }
    findByChannel(channelId, { page = 1, limit = 50, before } = {}) {
        const filter = { channel: channelId, isDeleted: false, parentId: null };
        if (before)
            filter.createdAt = { $lt: new Date(before) };
        return Message.find(filter)
            .populate('sender', 'name avatar')
            .populate('mentions', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
    }
    findThread(parentId) {
        return Message.find({ parentId, isDeleted: false })
            .populate('sender', 'name avatar')
            .sort({ createdAt: 1 });
    }
    search(channelId, query) {
        return Message.find({
            channel: channelId,
            isDeleted: false,
            content: { $regex: query, $options: 'i' },
        })
            .populate('sender', 'name avatar')
            .sort({ createdAt: -1 })
            .limit(30);
    }
    softDelete(msgId, userId) {
        return Message.findOneAndUpdate({ _id: msgId, sender: userId }, { isDeleted: true, deletedAt: new Date(), content: '[Message deleted]' }, { new: true });
    }
}
module.exports = new MessageRepository();
