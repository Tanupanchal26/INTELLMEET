process.env.NODE_ENV           = 'test';
process.env.MONGO_URI          = 'mongodb://localhost:27017/intellmeet_test';
process.env.JWT_SECRET         = 'test-access-secret-minimum-32-characters!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

const mongoose = require('mongoose');

jest.mock('../src/repositories/meeting.repository');
jest.mock('../src/repositories/meetingNote.repository');
jest.mock('../src/services/notification.service', () => ({
  notifyMeetingInvite:  jest.fn().mockResolvedValue(undefined),
  notifyMeetingStarted: jest.fn().mockResolvedValue(undefined),
}));

const meetingRepo     = require('../src/repositories/meeting.repository');
const meetingNoteRepo = require('../src/repositories/meetingNote.repository');
const meetingService  = require('../src/services/meeting.service');
const ApiError        = require('../src/utils/ApiError');
const { MEETING_STATUS, ROLES } = require('../src/constants');

const tenantId = new mongoose.Types.ObjectId();
const hostId   = new mongoose.Types.ObjectId();
const userId   = new mongoose.Types.ObjectId();

const makeMeeting = (overrides = {}) => ({
  _id:          new mongoose.Types.ObjectId(),
  tenantId,
  host:         hostId,
  title:        'Test Meeting',
  status:       MEETING_STATUS.SCHEDULED,
  participants: [hostId],
  invitees:     [] as any[],
  roomId:       'room-abc',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe('meetingService.createMeeting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates meeting and notifies invited participants', async () => {
    const meeting = makeMeeting();
    meetingRepo.create.mockResolvedValue(meeting);
    meetingRepo.findById.mockResolvedValue(meeting);

    const result = await meetingService.createMeeting(tenantId, hostId, {
      title: 'Test Meeting',
      participants: [userId.toString()],
    });

    expect(meetingRepo.create).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it('creates meeting without participants', async () => {
    const meeting = makeMeeting();
    meetingRepo.create.mockResolvedValue(meeting);
    meetingRepo.findById.mockResolvedValue(meeting);

    await meetingService.createMeeting(tenantId, hostId, { title: 'Solo Meeting' });
    expect(meetingRepo.create).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('meetingService.getMeeting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns meeting for host', async () => {
    const meeting = makeMeeting({ host: { _id: hostId, toString: () => hostId.toString() }, participants: [], invitees: [] });
    meetingRepo.findById.mockResolvedValue(meeting);

    const result = await meetingService.getMeeting(meeting._id, tenantId, hostId);
    expect(result).toBeDefined();
  });

  it('throws forbidden for non-participant', async () => {
    const otherId = new mongoose.Types.ObjectId();
    const meeting = makeMeeting({
      host: { _id: hostId, toString: () => hostId.toString() },
      participants: [],
      invitees: [],
    });
    meetingRepo.findById.mockResolvedValue(meeting);

    await expect(meetingService.getMeeting(meeting._id, tenantId, otherId))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('meetingService.updateMeeting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows host to update meeting', async () => {
    const meeting = makeMeeting();
    meetingRepo.findById.mockResolvedValue(meeting);
    meetingRepo.updateById.mockResolvedValue({ ...meeting, title: 'Updated' });

    const result = await meetingService.updateMeeting(meeting._id, tenantId, hostId, { title: 'Updated' }, ROLES.MEMBER);
    expect(meetingRepo.updateById).toHaveBeenCalled();
  });

  it('throws forbidden for non-host non-admin', async () => {
    const meeting = makeMeeting();
    meetingRepo.findById.mockResolvedValue(meeting);

    await expect(meetingService.updateMeeting(meeting._id, tenantId, userId, { title: 'X' }, ROLES.MEMBER))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws bad request for ended meeting', async () => {
    const meeting = makeMeeting({ status: MEETING_STATUS.ENDED });
    meetingRepo.findById.mockResolvedValue(meeting);

    await expect(meetingService.updateMeeting(meeting._id, tenantId, hostId, { title: 'X' }, ROLES.MEMBER))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('meetingService.deleteMeeting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows host to delete', async () => {
    const meeting = makeMeeting();
    meetingRepo.findById.mockResolvedValue(meeting);
    meetingRepo.deleteById.mockResolvedValue(meeting);

    await meetingService.deleteMeeting(meeting._id, tenantId, hostId, ROLES.MEMBER);
    expect(meetingRepo.deleteById).toHaveBeenCalled();
  });

  it('throws forbidden for non-host non-admin', async () => {
    const meeting = makeMeeting();
    meetingRepo.findById.mockResolvedValue(meeting);

    await expect(meetingService.deleteMeeting(meeting._id, tenantId, userId, ROLES.MEMBER))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('meetingService.respondToInvite', () => {
  it('throws bad request for invalid status', async () => {
    await expect(meetingService.respondToInvite('id', userId, 'maybe'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('updates invitee status for accepted', async () => {
    meetingRepo.updateInviteeStatus.mockResolvedValue({});
    const result = await meetingService.respondToInvite('id', userId, 'accepted');
    expect(meetingRepo.updateInviteeStatus).toHaveBeenCalledWith('id', userId, 'accepted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('meetingService.startMeeting', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts meeting if user is host', async () => {
    const meeting = makeMeeting({ participants: [hostId] });
    meetingRepo.findById.mockResolvedValue(meeting);
    meetingRepo.startMeeting.mockResolvedValue({ ...meeting, status: MEETING_STATUS.ACTIVE });

    await meetingService.startMeeting(meeting._id, tenantId, hostId);
    expect(meetingRepo.startMeeting).toHaveBeenCalled();
  });

  it('throws forbidden if not host', async () => {
    const meeting = makeMeeting();
    meetingRepo.findById.mockResolvedValue(meeting);

    await expect(meetingService.startMeeting(meeting._id, tenantId, userId))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

export {};
