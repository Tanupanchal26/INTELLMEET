process.env.NODE_ENV           = 'test';
process.env.MONGO_URI          = 'mongodb://localhost:27017/intellmeet_test';
process.env.JWT_SECRET         = 'test-access-secret-minimum-32-characters!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

const mongoose = require('mongoose');

jest.mock('../src/repositories/team.repository');
jest.mock('../src/repositories/channel.repository');
jest.mock('../src/services/notification.service', () => ({
  notifyTeamInvite: jest.fn().mockResolvedValue(undefined),
}));

const teamRepo    = require('../src/repositories/team.repository');
const channelRepo = require('../src/repositories/channel.repository');
const teamService = require('../src/services/team.service');

const tenantId = new mongoose.Types.ObjectId();
const ownerId  = new mongoose.Types.ObjectId();
const memberId = new mongoose.Types.ObjectId();
const guestId  = new mongoose.Types.ObjectId();

const makeTeam = (overrides = {}) => ({
  _id:     new mongoose.Types.ObjectId(),
  tenantId,
  name:    'Engineering',
  slug:    'engineering',
  members: [{ user: ownerId, role: 'owner' }],
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe('teamService.createTeam', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates team and auto-generates #general channel', async () => {
    const team = makeTeam();
    teamRepo.findBySlug.mockResolvedValue(null);
    teamRepo.create.mockResolvedValue(team);
    channelRepo.create.mockResolvedValue({});

    await teamService.createTeam(tenantId, ownerId, { name: 'Engineering' });
    expect(teamRepo.create).toHaveBeenCalledTimes(1);
    expect(channelRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'general', isDefault: true }));
  });

  it('throws conflict if slug already exists', async () => {
    teamRepo.findBySlug.mockResolvedValue(makeTeam());

    await expect(teamService.createTeam(tenantId, ownerId, { name: 'Engineering' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('teamService.getTeam', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns public team to any authenticated user', async () => {
    const team = makeTeam({ isPrivate: false });
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue(null);

    const result = await teamService.getTeam(team._id, tenantId, guestId);
    expect(result).toBeDefined();
  });

  it('throws forbidden for private team if not member', async () => {
    const team = makeTeam({ isPrivate: true });
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue(null);

    await expect(teamService.getTeam(team._id, tenantId, guestId))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('teamService.updateTeam', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows admin+ to update team', async () => {
    const team = makeTeam({ members: [{ user: ownerId, role: 'owner' }] });
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('owner');
    teamRepo.updateById.mockResolvedValue({ ...team, name: 'Updated' });

    await teamService.updateTeam(team._id, tenantId, ownerId, { name: 'Updated' });
    expect(teamRepo.updateById).toHaveBeenCalled();
  });

  it('throws forbidden for member trying to update', async () => {
    const team = makeTeam({ members: [{ user: memberId, role: 'member' }] });
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('member');

    await expect(teamService.updateTeam(team._id, tenantId, memberId, { name: 'X' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('teamService.inviteMember', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds member and notifies them', async () => {
    const team = makeTeam();
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('owner');
    teamRepo.addMember.mockResolvedValue(team);
    channelRepo.findBySlug.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
    channelRepo.addMember.mockResolvedValue({});

    await teamService.inviteMember(team._id, tenantId, ownerId, memberId, 'member');
    expect(teamRepo.addMember).toHaveBeenCalledWith(team._id, tenantId, memberId, 'member');
  });

  it('throws forbidden if inviter is only a member', async () => {
    const team = makeTeam();
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('member');

    await expect(teamService.inviteMember(team._id, tenantId, memberId, guestId))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('teamService.removeMember', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows self-leave without role check', async () => {
    const team = makeTeam({ members: [{ user: memberId, role: 'member' }] });
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('member');
    teamRepo.removeMember.mockResolvedValue(team);

    await teamService.removeMember(team._id, tenantId, memberId, memberId);
    expect(teamRepo.removeMember).toHaveBeenCalled();
  });

  it('throws forbidden when non-admin tries to remove another member', async () => {
    const team = makeTeam();
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('member');

    await expect(teamService.removeMember(team._id, tenantId, memberId, guestId))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('teamService.updateMemberRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws bad request if trying to assign owner role', async () => {
    const team = makeTeam();
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('owner');

    await expect(teamService.updateMemberRole(team._id, tenantId, ownerId, memberId, 'owner'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('updates role when actor is owner', async () => {
    const team = makeTeam();
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('owner');
    teamRepo.updateMemberRole.mockResolvedValue(team);

    await teamService.updateMemberRole(team._id, tenantId, ownerId, memberId, 'admin');
    expect(teamRepo.updateMemberRole).toHaveBeenCalledWith(team._id, tenantId, memberId, 'admin');
  });
});

export {};
