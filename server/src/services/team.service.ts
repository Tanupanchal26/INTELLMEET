// @ts-nocheck
const teamRepo    = require('../repositories/team.repository');
const channelRepo  = require('../repositories/channel.repository');
const notifService = require('./notification.service');
const ApiError    = require('../utils/ApiError');
const { PAGINATION } = require('../constants');

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

// ── Invite member ─────────────────────────────────────────────────────────────
const inviteMember = async (teamId, tenantId, actorId, targetUserId, role = 'member') => {
  const team = await teamRepo.findById(teamId, tenantId);
  assertTeamRole(team, actorId, 'admin');
  const updated = await teamRepo.addMember(teamId, tenantId, targetUserId, role);
  // Add user to default #general channel
  const general = await channelRepo.findBySlug(team._id, 'general');
  if (general) await channelRepo.addMember(general._id, targetUserId);
  // Notify
  notifService.notifyTeamInvite(team, targetUserId, actorId).catch(() => {});
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

module.exports = {
  createTeam, getUserTeams, getTeam,
  updateTeam, deleteTeam,
  inviteMember, removeMember, updateMemberRole,
};

export {};
