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

  /**
   * Find a meeting by its MongoDB _id without tenant scoping.
   * Tenant isolation is enforced at the service layer (host/participant check).
   */
  async findById(id: unknown, _tenantId?: TenantId, populate?: PopulateArg | PopulateArg[]) {
    const query = Meeting.findById(id);
    if (populate) query.populate(populate as Parameters<typeof query.populate>[0]);
    const doc = await query;
    if (!doc) throw ApiError.notFound('Meeting not found');
    return doc;
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

  /**
   * Unified lookup: accepts MongoDB _id, meetingId, joinCode, or roomId.
   * No tenant scoping — join codes are globally unique by index.
   */
  async findByCode(code: string) {
    const q = code.trim();
    // Also try _id lookup so MeetingRoom's getById path works cross-tenant
    const orClauses: object[] = [
      { meetingId: q },
      { joinCode:  q },
      { roomId:    q },
    ];
    // If it looks like a Mongo ObjectId, include _id search
    if (/^[a-f\d]{24}$/i.test(q)) {
      orClauses.push({ _id: q });
    }
    return Meeting.findOne({ $or: orClauses });
  }

  /**
   * Record a participant joining — upserts a history entry so re-joins
   * create a new row rather than overwriting the previous one.
   */
  async recordParticipantJoin(meetingId: string, userId: UserId, name: string) {
    const now = new Date();
    return Meeting.findByIdAndUpdate(
      meetingId,
      {
        $addToSet: { participants: userId },
        $push: {
          participantHistory: {
            user:     userId,
            name,
            joinedAt: now,
            leftAt:   null,
            duration: 0,
          },
        },
      },
      { new: true }
    );
  }

  /**
   * Record a participant leaving — closes the most-recent open history entry
   * and computes duration in seconds.
   */
  async recordParticipantLeave(meetingId: string, userId: UserId) {
    const now     = new Date();
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return null;

    // Find the last open entry for this user
    const history: any[] = meeting.participantHistory ?? [];
    let lastOpenIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].user.toString() === userId.toString() && !history[i].leftAt) {
        lastOpenIdx = i;
        break;
      }
    }

    if (lastOpenIdx === -1) return meeting; // no open entry — nothing to close

    const joinedAt  = history[lastOpenIdx].joinedAt as Date;
    const duration  = Math.round((now.getTime() - joinedAt.getTime()) / 1000); // seconds

    return Meeting.findByIdAndUpdate(
      meetingId,
      {
        $set: {
          [`participantHistory.${lastOpenIdx}.leftAt`]:  now,
          [`participantHistory.${lastOpenIdx}.duration`]: duration,
        },
      },
      { new: true }
    );
  }

  /**
   * Close ALL open participant history entries when a meeting ends.
   */
  async closeAllParticipantHistory(meetingId: string) {
    const now     = new Date();
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return null;

    const history: any[] = meeting.participantHistory ?? [];
    const updates: Record<string, unknown> = {};

    history.forEach((entry: any, idx: number) => {
      if (!entry.leftAt) {
        const duration = Math.round((now.getTime() - (entry.joinedAt as Date).getTime()) / 1000);
        updates[`participantHistory.${idx}.leftAt`]  = now;
        updates[`participantHistory.${idx}.duration`] = duration;
      }
    });

    if (Object.keys(updates).length === 0) return meeting;
    return Meeting.findByIdAndUpdate(meetingId, { $set: updates }, { new: true });
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

  async startMeeting(meetingId: string, _tenantId?: TenantId) {
    // No tenant scoping — access control is enforced at the service layer.
    const existing = await Meeting.findById(meetingId);
    if (!existing) return null;
    if (existing.status === MEETING_STATUS.ACTIVE) return existing;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, status: MEETING_STATUS.SCHEDULED },
      { $set: { status: MEETING_STATUS.ACTIVE, startedAt: new Date() } },
      { new: true }
    );
    return meeting;
  }

  async endMeeting(meetingId: string, _tenantId?: TenantId) {
    const now = new Date();

    const existing = await Meeting.findOne({ _id: meetingId, status: MEETING_STATUS.ACTIVE });
    if (!existing) throw ApiError.notFound('Active meeting not found');

    const durationMinutes = existing.startedAt
      ? Math.round((now.getTime() - (existing.startedAt as Date).getTime()) / 60_000)
      : 0;

    // Close all open participant history entries before marking ended
    await this.closeAllParticipantHistory(meetingId);

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, status: MEETING_STATUS.ACTIVE },
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
