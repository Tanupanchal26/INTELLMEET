// @ts-nocheck
const teamChatRepo = require('../repositories/teamChat.repository');
const teamRepo     = require('../repositories/team.repository');
const ApiError     = require('../utils/ApiError');

const assertTeamMember = async (teamId, tenantId, userId) => {
  const team = await teamRepo.findById(teamId, tenantId);
  const role = teamRepo.getMemberRole(team, userId);
  if (!role) throw ApiError.forbidden('Must be a team member to access team chat');
  return team;
};

const getMessages = async (teamId, tenantId, userId, options) => {
  await assertTeamMember(teamId, tenantId, userId);
  return teamChatRepo.getMessages(teamId, tenantId, options);
};

const sendMessage = async (teamId, tenantId, userId, data) => {
  await assertTeamMember(teamId, tenantId, userId);
  const message = await teamChatRepo.create({
    tenantId,
    team: teamId,
    sender: userId,
    content: data.content,
    type: data.type || 'text',
    attachments: data.attachments || [],
  });
  
  return teamChatRepo.findById(message._id, tenantId, [
    { path: 'sender', select: 'name email avatar isOnline lastActive' }
  ]);
};

const editMessage = async (teamId, messageId, tenantId, userId, content) => {
  const msg = await teamChatRepo.getMessageById(messageId, teamId, tenantId);
  if (msg.sender.toString() !== userId.toString()) {
    throw ApiError.forbidden('Can only edit your own messages');
  }
  const updated = await teamChatRepo.updateById(messageId, tenantId, {
    content,
    isEdited: true,
    editedAt: new Date()
  });
  return teamChatRepo.findById(updated._id, tenantId, [
    { path: 'sender', select: 'name email avatar' }
  ]);
};

const deleteMessage = async (teamId, messageId, tenantId, userId) => {
  const msg = await teamChatRepo.getMessageById(messageId, teamId, tenantId);
  
  const team = await teamRepo.findById(teamId, tenantId);
  const role = teamRepo.getMemberRole(team, userId);
  
  if (msg.sender.toString() !== userId.toString() && role !== 'admin' && role !== 'owner') {
    throw ApiError.forbidden('Not authorized to delete this message');
  }
  
  await teamChatRepo.updateById(messageId, tenantId, {
    isDeleted: true,
    deletedAt: new Date()
  });
};

const toggleReaction = async (teamId, messageId, tenantId, userId, emoji) => {
  await assertTeamMember(teamId, tenantId, userId);
  const msg = await teamChatRepo.getMessageById(messageId, teamId, tenantId);
  
  let reactions = [...(msg.reactions || [])];
  const reactionIndex = reactions.findIndex(r => r.emoji === emoji);
  
  if (reactionIndex > -1) {
    const userIndex = reactions[reactionIndex].users.findIndex(u => u.toString() === userId.toString());
    if (userIndex > -1) {
      reactions[reactionIndex].users.splice(userIndex, 1);
      if (reactions[reactionIndex].users.length === 0) reactions.splice(reactionIndex, 1);
    } else {
      reactions[reactionIndex].users.push(userId);
    }
  } else {
    reactions.push({ emoji, users: [userId] });
  }
  
  const updated = await teamChatRepo.updateById(messageId, tenantId, { reactions });
  return updated.reactions;
};

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction
};

export {};
