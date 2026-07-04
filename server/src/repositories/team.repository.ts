// @ts-nocheck
const BaseRepository = require('./base.repository');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');

class TeamRepository extends BaseRepository {
  constructor() { super(Team); }

  findBySlug(tenantId, slug) {
    return Team.findOne({ tenantId, slug, isArchived: false });
  }

  findByMember(tenantId, userId) {
    const filter = tenantId
      ? { tenantId, isArchived: false, 'members.user': userId }
      : { isArchived: false, 'members.user': userId };
    return Team.find(filter)
      .select('name slug description avatar isPrivate members createdAt')
      .populate('members.user', 'name email avatar')
      .sort({ createdAt: -1 });
  }

  async addMember(teamId, tenantId, userId, role = 'member', status = 'active') {
    // Use _id-only filter when tenantId is undefined to avoid silent query failure
    const filter = tenantId
      ? { _id: teamId, tenantId, 'members.user': { $ne: userId } }
      : { _id: teamId, 'members.user': { $ne: userId } };
    const team = await Team.findOneAndUpdate(
      filter,
      { $push: { members: { user: userId, role, status } } },
      { new: true }
    ).populate('members.user', 'name email avatar');
    if (!team) throw ApiError.conflict('User is already a member or team not found');
    return team;
  }

  async updateMemberStatus(teamId, tenantId, userId, status) {
    const filter = tenantId
      ? { _id: teamId, tenantId, 'members.user': userId }
      : { _id: teamId, 'members.user': userId };
    const team = await Team.findOneAndUpdate(
      filter,
      { $set: { 'members.$.status': status } },
      { new: true }
    ).populate('members.user', 'name email avatar');
    if (!team) throw ApiError.notFound('Team member not found');
    return team;
  }

  async removeMember(teamId, tenantId, userId) {
    const filter = tenantId ? { _id: teamId, tenantId } : { _id: teamId };
    const team = await Team.findOneAndUpdate(
      filter,
      { $pull: { members: { user: userId } } },
      { new: true }
    ).populate('members.user', 'name email avatar');
    if (!team) throw ApiError.notFound('Team not found');
    return team;
  }

  async updateMemberRole(teamId, tenantId, userId, role) {
    const filter = tenantId
      ? { _id: teamId, tenantId, 'members.user': userId }
      : { _id: teamId, 'members.user': userId };
    const team = await Team.findOneAndUpdate(
      filter,
      { $set: { 'members.$.role': role } },
      { new: true }
    ).populate('members.user', 'name email avatar');
    if (!team) throw ApiError.notFound('Team member not found');
    return team;
  }

  getMemberRole(team, userId) {
    const member = team.members.find(m => m.user.toString() === userId.toString());
    return member?.role || null;
  }
}

module.exports = new TeamRepository();

export {};
