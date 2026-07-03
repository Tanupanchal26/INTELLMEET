// @ts-nocheck
const BaseRepository = require('./base.repository');
const Notification = require('../models/Notification');

class NotificationRepository extends BaseRepository {
  constructor() { super(Notification); }

  findForUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const filter = { recipient: userId };
    if (unreadOnly) filter.isRead = false;
    return Notification.find(filter)
      .populate('actor', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  countUnread(userId) {
    return Notification.countDocuments({ recipient: userId, isRead: false });
  }

  markRead(notifId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notifId, recipient: userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  markAllRead(userId) {
    return Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
  }

  // Cleanup: delete read notifications older than 30 days
  cleanup(userId) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return Notification.deleteMany({ recipient: userId, isRead: true, createdAt: { $lt: cutoff } });
  }
}

module.exports = new NotificationRepository();

export {};
