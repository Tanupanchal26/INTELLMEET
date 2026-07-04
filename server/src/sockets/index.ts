// @ts-nocheck
const { verifyAccessToken } = require('../services/jwt.service');
const userService = require('../services/user.service');
const { isBlacklisted } = require('../utils/redisBlacklist');
const socketRateLimiter = require('../middleware/socketRateLimiter');
const chatSocket         = require('./chat.socket');
const meetingSocket      = require('./meeting.socket');
const notificationSocket = require('./notification.socket');
const presenceSocket     = require('./presence.socket');
const teamChatSocket     = require('./teamChat.socket');
const logger = require('../shared/utils/logger').default;

const sanitizeLog = (val) => String(val ?? '').replace(/[\r\n\t\x00-\x1f\x7f]/g, '_');

const initSockets = (io) => {
  // ── Auth middleware ────────────────────────────────────────────────────────
  io.use(socketRateLimiter);
io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
                    socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      // Check token blacklist
      const blacklisted = await isBlacklisted(token);
      if (blacklisted) return next(new Error('Token revoked'));

      const user = await userService.getUserForAuth(decoded.id);
      if (!user) return next(new Error('User not found'));
      if (user.status === 'banned' || user.status === 'locked') return next(new Error('Account restricted'));

      socket.user = {
        id:       user._id.toString(),
        name:     user.name,
        email:    user.email,
        avatar:   user.avatar,
        tenantId: user.tenantId?.toString(),
        role:     user.role,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[SOCKET] connected: ${sanitizeLog(socket.user?.id)} (${socket.id})`);  

    chatSocket(io, socket);
    meetingSocket(io, socket);
    notificationSocket(io, socket);
    presenceSocket(io, socket);
    teamChatSocket(io, socket);

    // Re-join team rooms after reconnect
    socket.on('team-chat:rejoin', async (teamIds) => {
      if (!Array.isArray(teamIds)) return;
      const Team = require('../models/Team');
      for (const teamId of teamIds) {
        try {
          const team = await Team.findOne({ _id: teamId, 'members.user': socket.user?.id, isArchived: false });
          if (team) socket.join(`team_chat:${teamId}`);
        } catch { /* ignore */ }
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[SOCKET] disconnected: ${sanitizeLog(socket.user?.id)} — ${sanitizeLog(reason)}`);
    });
  });
};

module.exports = initSockets;

export {};
