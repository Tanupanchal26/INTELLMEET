process.env.NODE_ENV           = 'test';
process.env.MONGO_URI          = 'mongodb://localhost:27017/intellmeet_test';
process.env.JWT_SECRET         = 'test-access-secret-minimum-32-characters!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

const mongoose = require('mongoose');

jest.mock('../src/repositories/channel.repository');
jest.mock('../src/repositories/team.repository');
jest.mock('../src/models/Message');
jest.mock('../src/services/notification.service', () => ({
  notifyMany: jest.fn().mockResolvedValue(undefined),
}));

const channelRepo    = require('../src/repositories/channel.repository');
const teamRepo       = require('../src/repositories/team.repository');
const Message        = require('../src/models/Message');
const channelService = require('../src/services/channel.service');

const tenantId  = new mongoose.Types.ObjectId();
const teamId    = new mongoose.Types.ObjectId();
const ownerId   = new mongoose.Types.ObjectId();
const memberId  = new mongoose.Types.ObjectId();
const channelId = new mongoose.Types.ObjectId();

const makeTeam = (role = 'owner') => ({
  _id: teamId, tenantId,
  members: [{ user: ownerId, role }],
});

const makeChannel = (overrides = {}) => ({
  _id: channelId, tenantId, team: teamId,
  name: 'general', slug: 'general',
  type: 'public', isDefault: false,
  members: [ownerId],
  createdBy: ownerId,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe('channelService.createChannel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates channel for team member', async () => {
    const team = makeTeam('member');
    teamRepo.findById.mockResolvedValue(team);
    teamRepo.getMemberRole.mockReturnValue('member');
    channelRepo.findBySlug.mockResolvedValue(null);
    channelRepo.create.mockResolvedValue(makeChannel({ name: 'design' }));

    const result = await channelService.createChannel(teamId, tenantId, ownerId, { name: 'design' });
    expect(channelRepo.create).toHaveBeenCalledTimes(1);
  });

  it('throws conflict if channel slug exists', async () => {
    teamRepo.findById.mockResolvedValue(makeTeam());
    teamRepo.getMemberRole.mockReturnValue('owner');
    channelRepo.findBySlug.mockResolvedValue(makeChannel());

    await expect(channelService.createChannel(teamId, tenantId, ownerId, { name: 'general' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws forbidden for non-team member', async () => {
    teamRepo.findById.mockResolvedValue(makeTeam());
    teamRepo.getMemberRole.mockReturnValue(null);

    await expect(channelService.createChannel(teamId, tenantId, new mongoose.Types.ObjectId(), { name: 'test' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('channelService.getChannel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns public channel', async () => {
    channelRepo.findById.mockResolvedValue(makeChannel({ type: 'public', members: [] }));

    const result = await channelService.getChannel(channelId, tenantId, memberId);
    expect(result).toBeDefined();
  });

  it('throws forbidden for private channel non-member', async () => {
    const nonMember = new mongoose.Types.ObjectId();
    channelRepo.findById.mockResolvedValue(makeChannel({
      type: 'private',
      members: [{ _id: ownerId, toString: () => ownerId.toString() }],
    }));

    await expect(channelService.getChannel(channelId, tenantId, nonMember))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('channelService.archiveChannel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws bad request for default channel', async () => {
    channelRepo.findById.mockResolvedValue(makeChannel({ isDefault: true }));
    teamRepo.findById.mockResolvedValue(makeTeam());
    teamRepo.getMemberRole.mockReturnValue('owner');

    await expect(channelService.archiveChannel(channelId, tenantId, ownerId))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('archives non-default channel when admin', async () => {
    channelRepo.findById.mockResolvedValue(makeChannel({ isDefault: false }));
    teamRepo.findById.mockResolvedValue(makeTeam());
    teamRepo.getMemberRole.mockReturnValue('owner');
    channelRepo.updateById.mockResolvedValue({ isArchived: true });

    await channelService.archiveChannel(channelId, tenantId, ownerId);
    expect(channelRepo.updateById).toHaveBeenCalledWith(channelId, tenantId, { isArchived: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('channelService.editMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('edits own message', async () => {
    const msg = {
      content: 'old',
      isEdited: false,
      editedAt: null as any,
      save: jest.fn().mockResolvedValue({ content: 'new', isEdited: true }),
    };
    Message.findOne = jest.fn().mockResolvedValue(msg);

    await channelService.editMessage('msgId', ownerId, 'new content');
    expect(msg.content).toBe('new content');
    expect(msg.isEdited).toBe(true);
    expect(msg.save).toHaveBeenCalled();
  });

  it('throws not found for message not belonging to user', async () => {
    Message.findOne = jest.fn().mockResolvedValue(null);

    await expect(channelService.editMessage('msgId', memberId, 'new'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('channelService.deleteMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('soft-deletes own message', async () => {
    const msg = { content: 'hi', isDeleted: false, deletedAt: null as any, save: jest.fn().mockResolvedValue({}) };
    Message.findOne = jest.fn().mockResolvedValue(msg);

    await channelService.deleteMessage('msgId', ownerId);
    expect(msg.isDeleted).toBe(true);
    expect(msg.content).toBe('[Message deleted]');
  });

  it('throws not found when message not owned', async () => {
    Message.findOne = jest.fn().mockResolvedValue(null);

    await expect(channelService.deleteMessage('msgId', memberId))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

export {};
