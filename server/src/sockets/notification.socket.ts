// @ts-nocheck
module.exports = (io, socket) => {
  // Auto-join user's personal room if authenticated
  if (socket.user?.id) {
    socket.join(`user:${socket.user.id}`);
  }

  // Explicit subscribe (for clients that connect before auth resolves)
  socket.on('notification:subscribe', (userId) => {
    if (socket.user?.id && socket.user.id.toString() === userId.toString()) {
      socket.join(`user:${userId}`);
    }
  });
};

export {};
