"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const constants_1 = require("../constants");
const BaseRepository = require('./base.repository');
const Meeting = require('../models/Meeting');
class MeetingRepository extends BaseRepository {
    constructor() {
        super(Meeting);
    }
    findByRoomId(roomId) {
        return Meeting.findOne({ roomId });
    }
    findByMeetingId(meetingId) {
        return Meeting.findOne({ meetingId });
    }
    findByJoinCode(joinCode) {
        return Meeting.findOne({ joinCode });
    }
    findUpcoming(tenantId, userId, limit = 5) {
        return Meeting.find({
            tenantId,
            status: constants_1.MEETING_STATUS.SCHEDULED,
            scheduledAt: { $gte: new Date() },
            $or: [
                { host: userId },
                { participants: userId },
                { 'invitees.user': userId },
            ],
        })
            .populate('host', 'name avatar')
            .sort({ scheduledAt: 1 })
            .limit(limit)
            .lean();
    }
    findActive(tenantId) {
        return Meeting.find({ tenantId, status: constants_1.MEETING_STATUS.ACTIVE })
            .populate('host participants', 'name avatar')
            .sort({ startedAt: -1 })
            .lean();
    }
    async addParticipant(meetingId, tenantId, userId) {
        return Meeting.findOneAndUpdate({ _id: meetingId, tenantId }, { $addToSet: { participants: userId } }, { new: true });
    }
    async removeParticipant(meetingId, tenantId, userId) {
        return Meeting.findOneAndUpdate({ _id: meetingId, tenantId }, { $pull: { participants: userId } }, { new: true });
    }
    async addInvitee(meetingId, tenantId, invitee) {
        // Only add if not already present for this user
        return Meeting.findOneAndUpdate({ _id: meetingId, tenantId, 'invitees.user': { $ne: invitee.user } }, { $push: { invitees: invitee } }, { new: true });
    }
    async updateInviteeStatus(meetingId, userId, status) {
        return Meeting.findOneAndUpdate({ _id: meetingId, 'invitees.user': userId }, { $set: { 'invitees.$.status': status } }, { new: true });
    }
    async startMeeting(meetingId, tenantId) {
        // If already active, return it as-is (idempotent — host rejoining their own meeting)
        const existing = await Meeting.findOne({ _id: meetingId, tenantId });
        if (!existing)
            return null;
        if (existing.status === constants_1.MEETING_STATUS.ACTIVE)
            return existing;
        const meeting = await Meeting.findOneAndUpdate({ _id: meetingId, tenantId, status: constants_1.MEETING_STATUS.SCHEDULED }, { $set: { status: constants_1.MEETING_STATUS.ACTIVE, startedAt: new Date() } }, { new: true });
        return meeting;
    }
    async endMeeting(meetingId, tenantId) {
        const now = new Date();
        // Fetch first to capture startedAt before the update
        const existing = await Meeting.findOne({ _id: meetingId, tenantId, status: constants_1.MEETING_STATUS.ACTIVE });
        if (!existing)
            throw ApiError_1.default.notFound('Active meeting not found');
        const durationMinutes = existing.startedAt
            ? Math.round((now.getTime() - existing.startedAt.getTime()) / 60_000)
            : 0;
        const meeting = await Meeting.findOneAndUpdate({ _id: meetingId, tenantId, status: constants_1.MEETING_STATUS.ACTIVE }, {
            $set: {
                status: constants_1.MEETING_STATUS.ENDED,
                endedAt: now,
                duration: durationMinutes,
            },
        }, { new: true });
        if (!meeting)
            throw ApiError_1.default.notFound('Active meeting not found');
        return meeting;
    }
    listPaginated(tenantId, filter, options) {
        return this.findAll(tenantId, filter, {
            ...options,
            populate: [
                { path: 'host', select: 'name avatar' },
                { path: 'participants', select: 'name avatar' },
            ],
        });
    }
}
const meetingRepository = new MeetingRepository();
exports.default = meetingRepository;
module.exports = meetingRepository;
module.exports.default = meetingRepository;
