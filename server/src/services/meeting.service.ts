import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import ApiError from '../utils/ApiError';
import { MEETING_STATUS, ROLES, PAGINATION } from '../constants';

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

  return meetingRepo.findById(meeting._id, tenantId, [
    { path: 'host',         select: 'name avatar' },
    { path: 'participants', select: 'name avatar' },
  ]);
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

  if (meeting.status === MEETING_STATUS.ACTIVE) {
    throw ApiError.badRequest('Meeting is already active');
  }
  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('Cannot restart an ended meeting');
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
  if (meeting.status !== MEETING_STATUS.ACTIVE) {
    throw ApiError.badRequest('Only an active meeting can be ended');
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
  await getMeeting(meetingId, tenantId, userId); // access check
  return meetingNoteRepo.upsert(meetingId, tenantId, userId, data);
};

// ── Join by room code ─────────────────────────────────────────────────────────
export const joinByRoomId = async (
  roomId:   string | undefined,
  tenantId: TenantId,
  userId:   UserId
) => {
  if (!roomId?.trim()) throw ApiError.badRequest('roomId is required');

  const Meeting = require('../models/Meeting');
  const meeting = await Meeting.findOne({ roomId: roomId.trim() });
  if (!meeting) throw ApiError.notFound('Meeting not found. Check the room code.');
  if (meeting.status === MEETING_STATUS.ENDED) {
    throw ApiError.badRequest('This meeting has already ended.');
  }

  // Atomic add — no read-modify-write race condition
  await Meeting.findByIdAndUpdate(
    meeting._id,
    { $addToSet: { participants: userId } },
    { new: true }
  );

  return Meeting.findById(meeting._id)
    .populate('host',         'name email avatar')
    .populate('participants', 'name email avatar')
    .lean();
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
};

export default module.exports;
