import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import ApiError from '../utils/ApiError';
import { MEETING_STATUS, ROLES, PAGINATION } from '../constants';

// Generates e.g. "ABCD-1234" using crypto — no extra dependency
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomChar = (buf: Buffer, i: number) => ALPHABET[buf[i] % ALPHABET.length];
const generateMeetingId = (): string => {
  const b = randomBytes(8);
  return `${randomChar(b,0)}${randomChar(b,1)}${randomChar(b,2)}${randomChar(b,3)}-${randomChar(b,4)}${randomChar(b,5)}${randomChar(b,6)}${randomChar(b,7)}`;
};
const JOIN_ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const generateJoinCode = (): string => {
  const b = randomBytes(10);
  return Array.from({ length: 10 }, (_, i) => JOIN_ALPHA[b[i] % JOIN_ALPHA.length]).join('');
};

const meetingRepo     = require('../repositories/meeting.repository');
const meetingNoteRepo = require('../repositories/meetingNote.repository');
const notifService    = require('./notification.service');

// ── Type helpers ──────────────────────────────────────────────────────────────
type UserId   = Types.ObjectId | string;
type TenantId = Types.ObjectId | string | null | undefined;

interface ListQuery {
  page?:   number | string;
  limit?:  number | string;
  status?: string;
  search?: string;
}

interface CreateMeetingData {
  title:        string;
  description?: string;
  scheduledAt?: Date | string;
  maxDuration?: number;
  participants?: UserId[];
  invitees?:    { email: string }[];
  team?:        string;
  agenda?:      { title: string; duration?: number; order?: number }[];
  isRecurring?: boolean;
  recurrence?:  { frequency: string; until?: Date };
  settings?:    {
    waitingRoom?:      boolean;
    muteOnEntry?:      boolean;
    recordingEnabled?: boolean;
    chatEnabled?:      boolean;
    password?:         string;
  };
}

// ── RBAC guard ────────────────────────────────────────────────────────────────
const assertHost = (meeting: { host: { toString(): string } }, userId: UserId): void => {
  if (meeting.host.toString() !== userId.toString()) {
    throw ApiError.forbidden('Only the meeting host can perform this action');
  }
};

// ── Sanitize update payload — strip fields that must never be patched directly ─
const IMMUTABLE_FIELDS = new Set([
  'host', 'tenantId', 'roomId', 'status',
  'startedAt', 'endedAt', 'duration', 'participants',
]);

const sanitizeUpdate = (data: Record<string, unknown>): Record<string, unknown> => {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!IMMUTABLE_FIELDS.has(k)) safe[k] = v;
  }
  return safe;
};

// ── Create ────────────────────────────────────────────────────────────────────
export const createMeeting = async (
  tenantId: TenantId,
  userId:   UserId,
  data:     CreateMeetingData
) => {
  const { participants, ...rest } = data;

  // Deduplicate participants and always include the host
  const uniqueParticipants = participants?.length
    ? [...new Set([userId.toString(), ...participants.map(String)])]
    : [userId.toString()];

  const meeting = await meetingRepo.create({
    tenantId,
    host:         userId,
    meetingId:    generateMeetingId(),
    joinCode:     generateJoinCode(),
    roomId:       uuidv4(),
    participants: uniqueParticipants,
    ...rest,
  });

  // Fire-and-forget — never block the response
  if (participants?.length) {
    const others = participants
      .map(String)
      .filter((p) => p !== userId.toString());
    if (others.length) {
      notifService.notifyMeetingInvite(meeting, others, userId).catch(() => {});
    }
  }

  const populated = await meetingRepo.findById(meeting._id, tenantId, [
    { path: 'host',         select: 'name avatar' },
    { path: 'participants', select: 'name avatar' },
  ]);

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  return {
    ...populated.toObject ? populated.toObject() : populated,
    joinLink: `${clientUrl}/lobby?join=${populated.meetingId}`,
  };
};

// ── List ──────────────────────────────────────────────────────────────────────
export const listMeetings = async (
  tenantId: TenantId,
  userId:   UserId,
  { page = 1, limit = 20, status, search }: ListQuery = {}
) => {
  const filter: Record<string, unknown> = {
    $or: [
      { host:             userId },
      { participants:     userId },
      { 'invitees.user':  userId },
    ],
  };

  if (status) {
    if (!Object.values(MEETING_STATUS).includes(status as never)) {
      throw ApiError.badRequest(`Invalid status value: ${status}`);
    }
    filter.status = status;
  }

  if (search) {
    // Escape regex special chars to prevent ReDoS
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.title = { $regex: escaped, $options: 'i' };
  }

  return meetingRepo.listPaginated(tenantId, filter, {
    page:  Math.max(1, parseInt(String(page), 10) || 1),
    limit: Math.min(parseInt(String(limit), 10) || 20, PAGINATION.MAX_LIMIT),
    sort:  { scheduledAt: -1, createdAt: -1 },
  });
};

// ── Get single ────────────────────────────────────────────────────────────────
export const getMeeting = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId
) => {
  const meeting = await meetingRepo.findById(meetingId, tenantId, [
    { path: 'host',          select: 'name email avatar' },
    { path: 'participants',  select: 'name email avatar' },
    { path: 'invitees.user', select: 'name email avatar' },
  ]);

  const uid = userId.toString();
  const isMember =
    meeting.host._id.toString() === uid ||
    meeting.participants.some((p: { _id: { toString(): string } }) => p._id.toString() === uid) ||
    meeting.invitees.some((i: { user?: { _id?: { toString(): string } } }) =>
      i.user?._id?.toString() === uid
    );

  if (!isMember) throw ApiError.forbidden('You are not a participant of this meeting');
  return meeting;
};

// ── Update ────────────────────────────────────────────────────────────────────
export const updateMeeting = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId,
  data:      Record<string, unknown>,
  userRole:  string
) => {
  const meeting = await meetingRepo.findById(meetingId, tenantId);
  const isAdminOrAbove = ([ROLES.ADMIN, ROLES.SUPER_ADMIN] as string[]).includes(userRole);

  if (meeting.host.toString() !== userId.toString() && !isAdminOrAbove) {
    throw ApiError.forbidden('Only the host or an admin can edit this meeting');
  }
  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('Cannot edit an ended meeting');
  }

  const safeData = sanitizeUpdate(data);
  if (Object.keys(safeData).length === 0) {
    throw ApiError.badRequest('No valid fields to update');
  }

  return meetingRepo.updateById(meetingId, tenantId, safeData);
};

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteMeeting = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId,
  userRole:  string
) => {
  const meeting = await meetingRepo.findById(meetingId, tenantId);
  const isAdmin = ([ROLES.SUPER_ADMIN, ROLES.ADMIN] as string[]).includes(userRole);

  if (meeting.host.toString() !== userId.toString() && !isAdmin) {
    throw ApiError.forbidden('Only the host or admin can delete this meeting');
  }
  if (meeting.status === MEETING_STATUS.ACTIVE) {
    throw ApiError.badRequest('Cannot delete an active meeting. End it first.');
  }

  return meetingRepo.deleteById(meetingId, tenantId);
};

// ── Invite ────────────────────────────────────────────────────────────────────
export const inviteParticipants = async (
  meetingId: string,
  tenantId:  TenantId,
  actorId:   UserId,
  userIds:   UserId[]
) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw ApiError.badRequest('userIds must be a non-empty array');
  }

  const meeting = await meetingRepo.findById(meetingId, tenantId);
  assertHost(meeting, actorId);

  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('Cannot invite to an ended meeting');
  }

  // Sequential to avoid duplicate-key races on the invitees array
  for (const uid of userIds) {
    await meetingRepo.addInvitee(meetingId, tenantId, { user: uid, status: 'pending' });
    await meetingRepo.addParticipant(meetingId, tenantId, uid);
  }

  notifService.notifyMeetingInvite(meeting, userIds, actorId).catch(() => {});
  return meetingRepo.findById(meetingId, tenantId);
};

// ── RSVP ──────────────────────────────────────────────────────────────────────
export const respondToInvite = async (
  meetingId: string,
  userId:    UserId,
  status:    string
) => {
  if (!['accepted', 'declined'].includes(status)) {
    throw ApiError.badRequest('Status must be "accepted" or "declined"');
  }

  const updated = await meetingRepo.updateInviteeStatus(meetingId, userId, status);
  if (!updated) throw ApiError.notFound('Invite not found for this user');
  return updated;
};

// ── Start ─────────────────────────────────────────────────────────────────────
export const startMeeting = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId
) => {
  const meeting = await meetingRepo.findById(meetingId, tenantId);
  assertHost(meeting, userId);

  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('Cannot restart an ended meeting.');
  }
  // Already active — idempotent, just return it (host rejoining their own meeting)
  if (meeting.status === MEETING_STATUS.ACTIVE) {
    return meeting;
  }

  const started = await meetingRepo.startMeeting(meetingId, tenantId);
  if (!started) throw ApiError.badRequest('Failed to start meeting — check meeting status');

  const otherParticipants = meeting.participants
    .map((p: { toString(): string }) => p.toString())
    .filter((p: string) => p !== userId.toString());

  notifService.notifyMeetingStarted(meeting, otherParticipants).catch(() => {});
  return started;
};

// ── End ───────────────────────────────────────────────────────────────────────
export const endMeeting = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId,
  userRole:  string
) => {
  const meeting = await meetingRepo.findById(meetingId, tenantId);
  const isAdmin = ([ROLES.SUPER_ADMIN, ROLES.ADMIN] as string[]).includes(userRole);

  if (meeting.host.toString() !== userId.toString() && !isAdmin) {
    throw ApiError.forbidden('Only the host can end this meeting');
  }
  // Allow ending both active and scheduled meetings (host may end before starting)
  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('This meeting has already ended');
  }

  // If still scheduled, mark it directly without computing duration
  if (meeting.status !== MEETING_STATUS.ACTIVE) {
    const Meeting = require('../models/Meeting');
    return Meeting.findByIdAndUpdate(
      meetingId,
      { $set: { status: MEETING_STATUS.ENDED, endedAt: new Date(), duration: 0 } },
      { new: true }
    );
  }

  return meetingRepo.endMeeting(meetingId, tenantId);
};

// ── Meeting Notes ─────────────────────────────────────────────────────────────
export const getMeetingNote = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId
) => {
  await getMeeting(meetingId, tenantId, userId); // access check
  return meetingNoteRepo.findByMeeting(meetingId);
};

export const upsertMeetingNote = async (
  meetingId: string,
  tenantId:  TenantId,
  userId:    UserId,
  data:      Record<string, unknown>
) => {
  // Access check: find by _id without tenantId filter to avoid undefined-tenantId 404
  const Meeting = require('../models/Meeting');
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw ApiError.notFound('Meeting not found');
  const uid = userId.toString();
  const isMember =
    meeting.host.toString() === uid ||
    meeting.participants.some((p: { toString(): string }) => p.toString() === uid);
  if (!isMember) throw ApiError.forbidden('You are not a participant of this meeting');

  // Strip protected fields before upsert
  const { meeting: _m, createdBy: _c, ...safeData } = data as any;
  return meetingNoteRepo.upsert(meetingId, tenantId, userId, safeData);
};

// ── Join by meetingId, joinCode, or roomId ────────────────────────────────────
export const joinByRoomId = async (
  code:     string | undefined,
  tenantId: TenantId,
  userId:   UserId
) => {
  if (!code?.trim()) throw ApiError.badRequest('Meeting ID or join code is required');

  const Meeting = require('../models/Meeting');
  const q = code.trim();

  // Reject codes that have been invalidated by meeting:end
  if (q.startsWith('ENDED_')) {
    throw ApiError.badRequest('This meeting has ended. The join code is no longer valid.');
  }

  // Accept meetingId (e.g. "ABCD-1234"), joinCode, or raw roomId (UUID)
  const meeting = await Meeting.findOne({
    $or: [{ meetingId: q }, { joinCode: q }, { roomId: q }],
  });

  if (!meeting) throw ApiError.notFound('Meeting not found. Check the ID or code.');
  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('This meeting has already ended and cannot be rejoined.');
  }

  await Meeting.findByIdAndUpdate(
    meeting._id,
    { $addToSet: { participants: userId } },
    { new: true }
  );

  const populated = await Meeting.findById(meeting._id)
    .populate('host',         'name email avatar')
    .populate('participants', 'name email avatar')
    .lean();

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  return {
    ...populated,
    joinLink: `${clientUrl}/lobby?join=${populated.meetingId}`,
  };
};

// ── Completed Meetings Dashboard ─────────────────────────────────────────────
export const listCompletedMeetings = async (
  tenantId: TenantId,
  userId:   UserId,
  {
    page   = 1,
    limit  = 10,
    search = '',
    sortBy = 'endedAt',
    order  = 'desc',
  }: { page?: number | string; limit?: number | string; search?: string; sortBy?: string; order?: string } = {}
) => {
  const Meeting   = require('../models/Meeting');
  const AIResult  = require('../models/AIResult');
  const Recording = require('../models/Recording');

  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const l = Math.min(parseInt(String(limit), 10) || 10, 50);
  const skip = (p - 1) * l;

  const allowedSort: Record<string, string> = {
    endedAt: 'endedAt', startedAt: 'startedAt', title: 'title', duration: 'duration',
  };
  const sortField = allowedSort[sortBy as string] ?? 'endedAt';
  const sortDir   = order === 'asc' ? 1 : -1;

  const matchStage: Record<string, unknown> = {
    status: 'ended',
    $or: [{ host: new (require('mongoose').Types.ObjectId)(userId.toString()) }, { participants: new (require('mongoose').Types.ObjectId)(userId.toString()) }],
  };
  if (tenantId) matchStage.tenantId = new (require('mongoose').Types.ObjectId)(tenantId.toString());
  if (search) {
    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matchStage.title = { $regex: esc, $options: 'i' };
  }

  const pipeline: object[] = [
    { $match: matchStage },
    { $sort: { [sortField]: sortDir } },
    {
      $lookup: {
        from: 'users', localField: 'participants', foreignField: '_id',
        pipeline: [{ $project: { name: 1, avatar: 1, email: 1 } }],
        as: 'participants',
      },
    },
    {
      $lookup: {
        from: 'users', localField: 'host', foreignField: '_id',
        pipeline: [{ $project: { name: 1, avatar: 1 } }],
        as: '_hostArr',
      },
    },
    { $addFields: { host: { $arrayElemAt: ['$_hostArr', 0] } } },
    {
      $lookup: {
        from: 'airesults', localField: '_id', foreignField: 'meeting',
        pipeline: [{ $project: { summary: 1, actionItems: 1, decisions: 1, transcript: 1, processingStatus: 1 } }],
        as: '_ai',
      },
    },
    { $addFields: { ai: { $arrayElemAt: ['$_ai', 0] } } },
    {
      $lookup: {
        from: 'recordings', localField: '_id', foreignField: 'meetingId',
        pipeline: [{ $project: { url: 1, duration: 1, sizeBytes: 1 } }],
        as: '_rec',
      },
    },
    { $addFields: { recording: { $arrayElemAt: ['$_rec', 0] } } },
    { $project: { _hostArr: 0, _ai: 0, _rec: 0, 'settings.password': 0 } },
    {
      $facet: {
        data:  [{ $skip: skip }, { $limit: l }],
        total: [{ $count: 'n' }],
      },
    },
  ];

  const [result] = await Meeting.aggregate(pipeline);
  const total = result?.total?.[0]?.n ?? 0;
  return {
    data:       result?.data ?? [],
    total,
    page:       p,
    limit:      l,
    totalPages: Math.ceil(total / l),
    hasNext:    p * l < total,
    hasPrev:    p > 1,
  };
};

module.exports = {
  createMeeting,
  listMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  inviteParticipants,
  respondToInvite,
  startMeeting,
  endMeeting,
  getMeetingNote,
  upsertMeetingNote,
  joinByRoomId,
  listCompletedMeetings,
};

export default module.exports;
