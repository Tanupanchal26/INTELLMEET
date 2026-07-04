// @ts-nocheck
const teamRepo    = require('../repositories/team.repository');
const channelRepo  = require('../repositories/channel.repository');
const User        = require('../models/User');
const notifService = require('./notification.service');
const ApiError    = require('../utils/ApiError');
const { PAGINATION } = require('../constants');

let _io = null;
const init = (io) => { _io = io; };

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── RBAC helpers ──────────────────────────────────────────────────────────────
const ROLE_POWER = { owner: 4, admin: 3, member: 2, guest: 1 };

const assertTeamRole = (team, userId, minRole) => {
  const role = teamRepo.getMemberRole(team, userId);
  if (!role || ROLE_POWER[role] < ROLE_POWER[minRole]) {
    throw ApiError.forbidden(`Requires team ${minRole} role or above`);
  }
  return role;
};

// Emit team member update to all members in the team socket room
const emitTeamUpdate = (teamId, team) => {
  if (_io) {
    _io.to(`team_chat:${teamId}`).emit('team:members-updated', team);
  }
};

// ── Create team ───────────────────────────────────────────────────────────────
const createTeam = async (tenantId, userId, data) => {
  const slug = slugify(data.name);
  const existing = await teamRepo.findBySlug(tenantId, slug);
  if (existing) throw ApiError.conflict(`Team slug "${slug}" already exists`);

  const team = await teamRepo.create({
    tenantId,
    createdBy: userId,
    slug,
    ...data,
    members: [{ user: userId, role: 'owner' }],
  });

  // Auto-create #general channel
  await channelRepo.create({
    tenantId,
    team:      team._id,
    name:      'general',
    slug:      'general',
    type:      'public',
    isDefault: true,
    createdBy: userId,
    members:   [userId],
  });

  return team;
};

// ── Get teams for user ────────────────────────────────────────────────────────
const getUserTeams = (tenantId, userId) => teamRepo.findByMember(tenantId, userId);

// ── Get single team ───────────────────────────────────────────────────────────
const getTeam = async (teamId, tenantId, userId) => {
  const team = await teamRepo.findById(teamId, tenantId,
    [{ path: 'members.user', select: 'name email avatar' }]
  );
  // Private teams: only members can view
  if (team.isPrivate) {
    const role = teamRepo.getMemberRole(team, userId);
    if (!role) throw ApiError.forbidden('This team is private');
  }
  return team;
};

// ── Update team ───────────────────────────────────────────────────────────────
const updateTeam = async (teamId, tenantId, userId, data) => {
  const team = await teamRepo.findById(teamId, tenantId);
  assertTeamRole(team, userId, 'admin');
  const updates = { ...data };
  if (data.name) updates.slug = slugify(data.name);
  return teamRepo.updateById(teamId, tenantId, updates);
};

// ── Delete team ───────────────────────────────────────────────────────────────
const deleteTeam = async (teamId, tenantId, userId) => {
  const team = await teamRepo.findById(teamId, tenantId);
  assertTeamRole(team, userId, 'owner');
  return teamRepo.deleteById(teamId, tenantId);
};

// ── Invite member by Email (Pending) ──────────────────────────────────────────
const inviteMemberByEmail = async (teamId, tenantId, actorId, email, role = 'member') => {
  const team = await teamRepo.findById(teamId, tenantId);
  assertTeamRole(team, actorId, 'admin');

  // Search without tenantId filter so cross-tenant users can be found by email
  const targetUser = await User.findOne({ email: email.toLowerCase() });
  if (!targetUser) throw ApiError.notFound('No registered user found with this email');

  const existing = team.members.find(m => m.user.toString() === targetUser._id.toString());
  if (existing) {
    if (existing.status === 'pending') throw ApiError.conflict('User already has a pending invitation');
    throw ApiError.conflict('User is already a member of this team');
  }

  // Use $or to handle undefined tenantId in addMember query
  const updated = await teamRepo.addMember(teamId, tenantId, targetUser._id, role, 'pending');
  notifService.notifyTeamInvite(team, targetUser._id, actorId).catch(() => {});
  return updated;
};

// ── Invite member (Direct) ────────────────────────────────────────────────────
const inviteMember = async (teamId, tenantId, actorId, targetUserId, role = 'member') => {
  const team = await teamRepo.findById(teamId, tenantId);
  assertTeamRole(team, actorId, 'admin');
  const updated = await teamRepo.addMember(teamId, tenantId, targetUserId, role, 'active');
  // Add user to default #general channel
  const general = await channelRepo.findBySlug(team._id, 'general');
  if (general) await channelRepo.addMember(general._id, targetUserId);
  // Notify
  notifService.notifyTeamInvite(team, targetUserId, actorId).catch(() => {});
  emitTeamUpdate(teamId, updated);
  return updated;
};

// ── Reject Invitation ─────────────────────────────────────────────────────────
const rejectInvitation = async (teamId, tenantId, userId) => {
  const team = await teamRepo.findById(teamId, tenantId);
  const member = team.members.find(m => m.user.toString() === userId.toString() || m.user?._id?.toString() === userId.toString());
  if (!member) throw ApiError.notFound('No invitation found for this team');
  if (member.status === 'active') throw ApiError.badRequest('Cannot reject — already an active member');
  return teamRepo.removeMember(teamId, tenantId, userId);
};

// ── Accept Invitation ─────────────────────────────────────────────────────────
const acceptInvitation = async (teamId, tenantId, userId) => {
  const team = await teamRepo.findById(teamId, tenantId);
  const member = team.members.find(m => m.user.toString() === userId.toString() || m.user?._id?.toString() === userId.toString());
  if (!member) throw ApiError.notFound('No invitation found for this team');
  if (member.status === 'active') throw ApiError.badRequest('You are already an active member of this team');
  
  const updated = await teamRepo.updateMemberStatus(teamId, tenantId, userId, 'active');
  const general = await channelRepo.findBySlug(team._id, 'general');
  if (general) await channelRepo.addMember(general._id, userId);
  emitTeamUpdate(teamId, updated);
  return updated;
};

// ── Remove member ─────────────────────────────────────────────────────────────
const removeMember = async (teamId, tenantId, actorId, targetUserId) => {
  const team = await teamRepo.findById(teamId, tenantId);
  // Admin+ or self-leave
  const isSelf = actorId.toString() === targetUserId.toString();
  if (!isSelf) assertTeamRole(team, actorId, 'admin');
  return teamRepo.removeMember(teamId, tenantId, targetUserId);
};

// ── Update member role ────────────────────────────────────────────────────────
const updateMemberRole = async (teamId, tenantId, actorId, targetUserId, role) => {
  const team = await teamRepo.findById(teamId, tenantId);
  assertTeamRole(team, actorId, 'owner');
  if (role === 'owner') throw ApiError.badRequest('Cannot assign owner role via API');
  return teamRepo.updateMemberRole(teamId, tenantId, targetUserId, role);
};

// ── Search Users ──────────────────────────────────────────────────────────────
const searchUsers = async (tenantId, query, limit = 10) => {
  if (!query || query.trim().length < 2) return [];
  // Escape regex special chars to prevent ReDoS
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return User.find({
    tenantId,
    $or: [{ name: regex }, { email: regex }]
  }).select('name email avatar').limit(limit).lean();
};

module.exports = {
  init,
  createTeam, getUserTeams, getTeam,
  updateTeam, deleteTeam,
  inviteMember, inviteMemberByEmail, acceptInvitation, rejectInvitation, removeMember, updateMemberRole,
  searchUsers,
};

export {};
