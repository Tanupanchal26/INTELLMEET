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
    req.user?._id
  );
  ApiResponse.ok(res, meeting, 'Meeting started');
});

// ── End ───────────────────────────────────────────────────────────────────────
exports.endMeeting = asyncHandler(async (req: Request, res: Response) => {
  const meeting = await meetingService.endMeeting(
    req.params.id,
    req.tenantId,
    req.user?._id,
    req.user?.role
  );
  ApiResponse.ok(res, meeting, 'Meeting ended');
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

// ── Join by meetingId or joinCode ─────────────────────────────────────────────
exports.joinMeeting = asyncHandler(async (req: Request, res: Response) => {
  const { code, roomId, meetingId } = req.body as { code?: string; roomId?: string; meetingId?: string };
  const meeting = await meetingService.joinByRoomId(
    code ?? meetingId ?? roomId,
    req.tenantId,
    req.user?._id
  );
  ApiResponse.ok(res, meeting, 'Joined meeting');
});

export {};
