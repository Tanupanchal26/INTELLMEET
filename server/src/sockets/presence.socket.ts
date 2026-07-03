// @ts-nocheck
const { getRedisClient } = require('../config/redis');

const PRESENCE_TTL = 300; // 5 min — auto-expire stale entries if server crashes

const presenceKey = (tenantId) => `presence:users:${tenantId}`;

const getOnlineUsers = async (tenantId) => {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    return await redis.sMembers(presenceKey(tenantId));
  } catch { return []; }
};

const markOnline = async (tenantId, userId) => {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.sAdd(presenceKey(tenantId), userId);
    await redis.expire(presenceKey(tenantId), PRESENCE_TTL);
  } catch {}
};

const markOffline = async (tenantId, userId) => {
  const redis = getRedisClient();
  if (!redis) return;
  try { await redis.sRem(presenceKey(tenantId), userId); } catch {}
};

module.exports = (io, socket) => {
  const { id: userId, tenantId, name, avatar } = socket.user || {};
  if (!userId || !tenantId) return;

  socket.join(`presence:${tenantId}`);

  markOnline(tenantId, userId).then(() => {
    socket.to(`presence:${tenantId}`).emit('presence:online', { userId, name, avatar });
  });

  socket.on('presence:list', async () => {
    const users = await getOnlineUsers(tenantId);
    socket.emit('presence:list', users);
  });

  socket.on('presence:status', ({ status }) => {
    socket.to(`presence:${tenantId}`).emit('presence:status', { userId, status });
  });

  socket.on('disconnect', async () => {
    await markOffline(tenantId, userId);
    socket.to(`presence:${tenantId}`).emit('presence:offline', { userId });
  });
};

export {};
