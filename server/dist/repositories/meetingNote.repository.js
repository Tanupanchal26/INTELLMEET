"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const BaseRepository = require('./base.repository');
const MeetingNote = require('../models/MeetingNote');
const ApiError = require('../utils/ApiError');
class MeetingNoteRepository extends BaseRepository {
    constructor() { super(MeetingNote); }
    findByMeeting(meetingId) {
        return MeetingNote.findOne({ meeting: meetingId })
            .populate('createdBy lastEditedBy', 'name avatar')
            .populate('actionItems.assignee', 'name avatar')
            .populate('agenda.presenter', 'name avatar');
    }
    async upsert(meetingId, tenantId, userId, data) {
        const note = await MeetingNote.findOneAndUpdate({ meeting: meetingId }, {
            $set: { ...data, lastEditedBy: userId, tenantId },
            $setOnInsert: { meeting: meetingId, createdBy: userId },
        }, { new: true, upsert: true, runValidators: true });
        return note;
    }
    async addActionItem(meetingId, item) {
        return MeetingNote.findOneAndUpdate({ meeting: meetingId }, { $push: { actionItems: item } }, { new: true });
    }
    async updateActionItem(meetingId, itemId, update) {
        const note = await MeetingNote.findOneAndUpdate({ meeting: meetingId, 'actionItems._id': itemId }, { $set: Object.fromEntries(Object.entries(update).map(([k, v]) => [`actionItems.$.${k}`, v])) }, { new: true });
        if (!note)
            throw ApiError.notFound('Action item not found');
        return note;
    }
}
module.exports = new MeetingNoteRepository();
