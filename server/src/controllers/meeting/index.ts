import type { Request, Response, NextFunction } from 'express';

const meetingService = require('../../services/meeting.service');
const ApiResponse    = require('../../utils/ApiResponse').default;
const asyncHandler   = require('../../utils/asyncHandler').default as (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => (req: Request, res: Response, next: NextFunction) => void;

// ── Create ────────────────────────────────────────────────────────────────────
exports.createMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.createMeeting(
    req.tenantId,
    req.user?._id,
    req.body as Record<string, unknown>
  );
  // Push dashboard refresh to the creator
  const io = req.app.get('io');
  io?.to(`user:${req.user?._id}`).emit('dashboard:refresh');
  ApiResponse.created(res, meeting, 'Meeting created');
});

// ── List ──────────────────────────────────────────────────────────────────────
exports.listMeetings = asyncHandler(async (req: Request, res: Response) => {
  const result = await meetingService.listMeetings(
    req.tenantId,
    req.user?._id,
    req.query
  );
  ApiResponse.paginated(res, result.data, result);
});

// ── Get single ────────────────────────────────────────────────────────────────
exports.getMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.getMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id
  );
  ApiResponse.ok(res, meeting);
});

// ── Update ────────────────────────────────────────────────────────────────────
exports.updateMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.updateMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id,
    req.body as Record<string, unknown>,
    req.user?.role
  );
  ApiResponse.ok(res, meeting, 'Meeting updated');
});

// ── Delete ────────────────────────────────────────────────────────────────────
exports.deleteMeeting = asyncHandler(async (req: Request, res: Response) => {
  await meetingService.deleteMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id,
    req.user?.role
  );
  ApiResponse.noContent(res);
});

// ── Invite participants ───────────────────────────────────────────────────────
exports.inviteParticipants = asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body as { userIds: string[] };
  const meeting = await meetingService.inviteParticipants(
    req.params.id,
    req.tenantId,
    req.user?._id,
    userIds
  );
  ApiResponse.ok(res, meeting, 'Participants invited');
});

// ── RSVP ──────────────────────────────────────────────────────────────────────
exports.respondToInvite = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  const meeting = await meetingService.respondToInvite(
    req.params.id,
    req.user?._id,
    status
  );
  ApiResponse.ok(res, meeting, 'Response recorded');
});

// ── Start ─────────────────────────────────────────────────────────────────────
exports.startMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.startMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id,
    req.user?.name
  );
  ApiResponse.ok(res, meeting, 'Meeting started');
});

// ── Leave ─────────────────────────────────────────────────────────────────────
exports.leaveMeeting = asyncHandler(async (req: Request, res: Response) => {
  const result = await meetingService.leaveMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id
  );
  req.app.get('io')?.to(`user:${req.user?._id}`).emit('dashboard:refresh');
  ApiResponse.ok(res, result, 'Left meeting');
});

// ── End ───────────────────────────────────────────────────────────────────────
exports.endMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.endMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id,
    req.user?.role
  );
  const io = req.app.get('io');
  if (io && meeting?.participants?.length) {
    for (const p of meeting.participants) {
      io.to(`user:${p.toString()}`).emit('dashboard:refresh');
    }
  }
  ApiResponse.ok(res, meeting, 'Meeting ended');
});

// ── Meeting History ───────────────────────────────────────────────────────────
exports.getMeetingHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await meetingService.getMeetingHistory(
    req.params.id,
    req.tenantId,
    req.user?._id
  );
  ApiResponse.ok(res, history);
});

// ── Meeting notes ─────────────────────────────────────────────────────────────
exports.getMeetingNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await meetingService.getMeetingNote(
    req.params.id,
    req.tenantId,
    req.user?._id
  );
  ApiResponse.ok(res, note);
});

exports.upsertMeetingNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await meetingService.upsertMeetingNote(
    req.params.id,
    req.tenantId,
    req.user?._id,
    req.body as Record<string, unknown>
  );
  ApiResponse.ok(res, note, 'Notes saved');
});

// ── Completed Meetings Dashboard ─────────────────────────────────────────────
exports.listCompletedMeetings = asyncHandler(async (req: Request, res: Response) => {
  const result = await meetingService.listCompletedMeetings(
    req.tenantId,
    req.user?._id,
    req.query as any
  );
  ApiResponse.paginated(res, result.data, result);
});

// ── Join by meetingId or joinCode ─────────────────────────────────────────────
exports.joinMeeting = asyncHandler(async (req: Request, res: Response) => {
  const { code, roomId, meetingId } = req.body as { code?: string; roomId?: string; meetingId?: string };
  const meeting = await meetingService.joinByRoomId(
    code ?? meetingId ?? roomId,
    req.tenantId,
    req.user?._id,
    req.user?.name
  );
  // Push dashboard refresh to the joining user
  const io = req.app.get('io');
  io?.to(`user:${req.user?._id}`).emit('dashboard:refresh');
  ApiResponse.ok(res, meeting, 'Joined meeting');
});

export {};
