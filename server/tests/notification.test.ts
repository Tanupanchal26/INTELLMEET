process.env.NODE_ENV           = 'test';
process.env.MONGO_URI          = 'mongodb://localhost:27017/intellmeet_test';
process.env.JWT_SECRET         = 'test-access-secret-minimum-32-characters!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters!';

const mongoose = require('mongoose');

jest.mock('../src/repositories/notification.repository');
jest.mock('../src/services/email.service', () => ({
  send: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/models/User', () => ({
  findById: jest.fn(),
}));

const notifRepo   = require('../src/repositories/notification.repository');
const emailService = require('../src/services/email.service');
const User        = require('../src/models/User');
const notifService = require('../src/services/notification.service');

const tenantId    = new mongoose.Types.ObjectId();
const recipientId = new mongoose.Types.ObjectId();
const actorId     = new mongoose.Types.ObjectId();

const makeNotif = (overrides = {}) => ({
  _id:       new mongoose.Types.ObjectId(),
  tenantId,
  recipient: recipientId,
  type:      'meeting_invite',
  title:     'Test notification',
  body:      'You were invited',
  isRead:    false,
  channels:  ['in_app'],
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
describe('notifService.createNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates in-app notification without email', async () => {
    const notif = makeNotif();
    notifRepo.create.mockResolvedValue(notif);

    const result = await notifService.createNotification({
      tenantId, recipient: recipientId,
      type: 'meeting_invite', title: 'Test',
      channels: ['in_app'],
    });

    expect(notifRepo.create).toHaveBeenCalledTimes(1);
    expect(emailService.send).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('fires email for email channel', async () => {
    const notif = makeNotif({ channels: ['in_app', 'email'] });
    notifRepo.create.mockResolvedValue(notif);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: recipientId, name: 'Alice', email: 'alice@test.com' }),
    });
    notifRepo.Model = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };

    await notifService.createNotification({
      tenantId, recipient: recipientId,
      type: 'meeting_invite', title: 'Test email notif',
      channels: ['in_app', 'email'],
    });

    expect(notifRepo.create).toHaveBeenCalledTimes(1);
    // email fires async — allow microtask queue to flush
    await new Promise(r => setTimeout(r, 50));
    expect(emailService.send).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('notifService.notifyMany', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one notification per recipient', async () => {
    notifRepo.create.mockResolvedValue(makeNotif());
    const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

    await notifService.notifyMany(ids, {
      tenantId, type: 'meeting_started',
      title: 'Meeting started', channels: ['in_app'],
    });

    expect(notifRepo.create).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('notifService.getUserNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated notifications with unread count', async () => {
    notifRepo.findForUser.mockResolvedValue([makeNotif()]);
    notifRepo.count.mockResolvedValue(1);
    notifRepo.countUnread.mockResolvedValue(1);

    const result = await notifService.getUserNotifications(recipientId, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.unread).toBe(1);
    expect(result.total).toBe(1);
  });

  it('clamps limit to MAX_LIMIT (100)', async () => {
    notifRepo.findForUser.mockResolvedValue([]);
    notifRepo.count.mockResolvedValue(0);
    notifRepo.countUnread.mockResolvedValue(0);

    const result = await notifService.getUserNotifications(recipientId, { page: 1, limit: 9999 });
    expect(result.limit).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('notifService.markRead / markAllRead', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks single notification as read', async () => {
    notifRepo.markRead.mockResolvedValue({ isRead: true });
    const result = await notifService.markRead('notif-id', recipientId);
    expect(notifRepo.markRead).toHaveBeenCalledWith('notif-id', recipientId);
  });

  it('marks all notifications as read', async () => {
    notifRepo.markAllRead.mockResolvedValue({ nModified: 5 });
    await notifService.markAllRead(recipientId);
    expect(notifRepo.markAllRead).toHaveBeenCalledWith(recipientId);
  });
});

export {};
