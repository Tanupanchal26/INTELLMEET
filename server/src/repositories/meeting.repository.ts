import { Types } from 'mongoose';
import ApiError from '../utils/ApiError';
import { MEETING_STATUS } from '../constants';

const BaseRepository = require('./base.repository');
const Meeting        = require('../models/Meeting');

type UserId    = Types.ObjectId | string;
type TenantId  = Types.ObjectId | string | null | undefined;
type PopulateArg = { path: string; select?: string } | string;

interface PaginationOptions {
  page:  number;
  limit: number;
  sort:  Record<string, 1 | -1>;
}

interface InviteePayload {
  user:   UserId;
  status: 'pending' | 'accepted' | 'declined';
}

class MeetingRepository extends BaseRepository {
  constructor() {
    super(Meeting);
  }

  findByRoomId(roomId: string) {
    return Meeting.findOne({ roomId });
  }

  findByMeetingId(meetingId: string) {
    return Meeting.findOne({ meetingId });
  }

  findByJoinCode(joinCode: string) {
    return Meeting.findOne({ joinCode });
  }

  findUpcoming(tenantId: TenantId, userId: UserId, limit = 5) {
    return Meeting.find({
      tenantId,
      status:      MEETING_STATUS.SCHEDULED,
      scheduledAt: { $gte: new Date() },
      $or: [
        { host:            userId },
        { participants:    userId },
        { 'invitees.user': userId },
      ],
    })
      .populate('host', 'name avatar')
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .lean();
  }

  findActive(tenantId: TenantId) {
    return Meeting.find({ tenantId, status: MEETING_STATUS.ACTIVE })
      .populate('host participants', 'name avatar')
      .sort({ startedAt: -1 })
      .lean();
  }

  async addParticipant(meetingId: string, tenantId: TenantId, userId: UserId) {
    return Meeting.findOneAndUpdate(
      { _id: meetingId, tenantId },
      { $addToSet: { participants: userId } },
      { new: true }
    );
  }

  async removeParticipant(meetingId: string, tenantId: TenantId, userId: UserId) {
    return Meeting.findOneAndUpdate(
      { _id: meetingId, tenantId },
      { $pull: { participants: userId } },
      { new: true }
    );
  }

  async addInvitee(meetingId: string, tenantId: TenantId, invitee: InviteePayload) {
    // Only add if not already present for this user
    return Meeting.findOneAndUpdate(
      { _id: meetingId, tenantId, 'invitees.user': { $ne: invitee.user } },
      { $push: { invitees: invitee } },
      { new: true }
    );
  }

  async updateInviteeStatus(meetingId: string, userId: UserId, status: string) {
    return Meeting.findOneAndUpdate(
      { _id: meetingId, 'invitees.user': userId },
      { $set: { 'invitees.$.status': status } },
      { new: true }
    );
  }

  async startMeeting(meetingId: string, tenantId: TenantId) {
    // If already active, return it as-is (idempotent — host rejoining their own meeting)
    const existing = await Meeting.findOne({ _id: meetingId, tenantId });
    if (!existing) return null;
    if (existing.status === MEETING_STATUS.ACTIVE) return existing;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, tenantId, status: MEETING_STATUS.SCHEDULED },
      { $set: { status: MEETING_STATUS.ACTIVE, startedAt: new Date() } },
      { new: true }
    );
    return meeting;
  }

  async endMeeting(meetingId: string, tenantId: TenantId) {
    const now = new Date();

    // Fetch first to capture startedAt before the update
    const existing = await Meeting.findOne({ _id: meetingId, tenantId, status: MEETING_STATUS.ACTIVE });
    if (!existing) throw ApiError.notFound('Active meeting not found');

    const durationMinutes = existing.startedAt
      ? Math.round((now.getTime() - (existing.startedAt as Date).getTime()) / 60_000)
      : 0;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, tenantId, status: MEETING_STATUS.ACTIVE },
      {
        $set: {
          status:   MEETING_STATUS.ENDED,
          endedAt:  now,
          duration: durationMinutes,
        },
      },
      { new: true }
    );

    if (!meeting) throw ApiError.notFound('Active meeting not found');
    return meeting;
  }

  listPaginated(tenantId: TenantId, filter: Record<string, unknown>, options: PaginationOptions) {
    return this.findAll(tenantId, filter, {
      ...options,
      populate: [
        { path: 'host',         select: 'name avatar' },
        { path: 'participants', select: 'name avatar' },
      ] as PopulateArg[],
    });
  }
}

const meetingRepository = new MeetingRepository();

export default meetingRepository;
module.exports = meetingRepository;
module.exports.default = meetingRepository;
