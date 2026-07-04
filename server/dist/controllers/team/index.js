"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const teamService = require('../../services/team.service');
const ApiResponse = require('../../utils/ApiResponse').default;
const asyncHandler = require('../../utils/asyncHandler').default;
exports.createTeam = asyncHandler(async (req, res) => {
    const team = await teamService.createTeam(req.tenantId, req.user?._id, req.body);
    ApiResponse.created(res, team, 'Team created');
});
exports.listTeams = asyncHandler(async (req, res) => {
    const teams = await teamService.getUserTeams(req.tenantId, req.user?._id);
    ApiResponse.ok(res, teams);
});
exports.getTeam = asyncHandler(async (req, res) => {
    const team = await teamService.getTeam(req.params.id, req.tenantId, req.user?._id);
    ApiResponse.ok(res, team);
});
exports.updateTeam = asyncHandler(async (req, res) => {
    const team = await teamService.updateTeam(req.params.id, req.tenantId, req.user?._id, req.body);
    ApiResponse.ok(res, team, 'Team updated');
});
exports.deleteTeam = asyncHandler(async (req, res) => {
    await teamService.deleteTeam(req.params.id, req.tenantId, req.user?._id);
    ApiResponse.noContent(res);
});
exports.inviteMember = asyncHandler(async (req, res) => {
    const team = await teamService.inviteMember(req.params.id, req.tenantId, req.user?._id, req.body.userId, req.body.role);
    ApiResponse.ok(res, team, 'Member invited');
});
exports.inviteMemberByEmail = asyncHandler(async (req, res) => {
    const team = await teamService.inviteMemberByEmail(req.params.id, req.tenantId, req.user?._id, req.body.email, req.body.role);
    ApiResponse.ok(res, team, 'Invitation sent');
});
exports.acceptInvitation = asyncHandler(async (req, res) => {
    const team = await teamService.acceptInvitation(req.params.id, req.tenantId, req.user?._id);
    ApiResponse.ok(res, team, 'Invitation accepted');
});
exports.rejectInvitation = asyncHandler(async (req, res) => {
    const team = await teamService.rejectInvitation(req.params.id, req.tenantId, req.user?._id);
    ApiResponse.ok(res, team, 'Invitation rejected');
});
exports.removeMember = asyncHandler(async (req, res) => {
    const team = await teamService.removeMember(req.params.id, req.tenantId, req.user?._id, req.params.userId);
    ApiResponse.ok(res, team, 'Member removed');
});
exports.updateMemberRole = asyncHandler(async (req, res) => {
    const team = await teamService.updateMemberRole(req.params.id, req.tenantId, req.user?._id, req.params.userId, req.body.role);
    ApiResponse.ok(res, team, 'Role updated');
});
exports.searchUsersToInvite = asyncHandler(async (req, res) => {
    const users = await teamService.searchUsers(req.tenantId, req.query.q);
    ApiResponse.ok(res, users);
});
