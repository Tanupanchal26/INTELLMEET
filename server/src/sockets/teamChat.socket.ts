// @ts-nocheck
const teamChatRepo = require('../repositories/teamChat.repository');
const teamRepo     = require('../repositories/team.repository');
const logger = require('../shared/utils/logger').default;

const teamChatSocket = (io, socket) => {
  const userId = socket.user?.id;
  const tenantId = socket.user?.tenantId;

  const getTeamRoom = (teamId) => `team_chat:${teamId}`;

  // Join Team Chat
  socket.on('team-chat:join', async (teamId) => {
    try {
      const team = await teamRepo.findById(teamId, tenantId);
      const role = teamRepo.getMemberRole(team, userId);
      if (!role) throw new Error('Not a member');

      socket.join(getTeamRoom(teamId));
      logger.info(`User ${userId} joined team chat ${teamId}`);
    } catch (error) {
      socket.emit('team-chat:error', { message: error.message || 'Failed to join team chat' });
    }
  });

  // Leave Team Chat
  socket.on('team-chat:leave', (teamId) => {
    socket.leave(getTeamRoom(teamId));
  });

  // Receive a message from client
  socket.on('team-chat:message', async (data) => {
    try {
      const { teamId, content, type = 'text', attachments = [] } = data;
      
      const team = await teamRepo.findById(teamId, tenantId);
      const role = teamRepo.getMemberRole(team, userId);
      if (!role) throw new Error('Not a member');

      // Create message in DB
      const msg = await teamChatRepo.create({
        tenantId,
        team: teamId,
        sender: userId,
        content,
        type,
        attachments,
      });

      // Fetch with sender populated
      const populatedMsg = await teamChatRepo.findById(msg._id, tenantId, [
        { path: 'sender', select: 'name email avatar isOnline lastActive' }
      ]);

      // Broadcast to room
      io.to(getTeamRoom(teamId)).emit('team-chat:message', populatedMsg);
      
      // Confirm delivery to sender
      socket.emit('team-chat:delivery', { messageId: msg._id, state: 'sent' });
    } catch (error) {
      socket.emit('team-chat:error', { message: error.message || 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('team-chat:typing', (data) => {
    const { teamId, isTyping } = data;
    socket.to(getTeamRoom(teamId)).emit('team-chat:typing', {
      userId,
      name: socket.user?.name,
      isTyping,
    });
  });

  // Read receipt
  socket.on('team-chat:read', (data) => {
    const { teamId, messageId } = data;
    socket.to(getTeamRoom(teamId)).emit('team-chat:read', {
      userId,
      messageId,
    });
  });

  // React to message
  socket.on('team-chat:react', async (data) => {
    const { teamId, messageId, emoji } = data;
    try {
      const teamChatService = require('../services/teamChat.service');
      const reactions = await teamChatService.toggleReaction(teamId, messageId, tenantId, userId, emoji);
      io.to(getTeamRoom(teamId)).emit('team-chat:reaction', { messageId, reactions });
    } catch (error) {
      socket.emit('team-chat:error', { message: 'Failed to react' });
    }
  });
};

module.exports = teamChatSocket;

export {};
