import type { NextFunction, Request, Response } from 'express';

const teamService = require('../../services/team.service') as {
  createTeam: (...args: unknown[]) => Promise<unknown>;
  getUserTeams: (...args: unknown[]) => Promise<unknown>;
  getTeam: (...args: unknown[]) => Promise<unknown>;
  updateTeam: (...args: unknown[]) => Promise<unknown>;
  deleteTeam: (...args: unknown[]) => Promise<void>;
  inviteMember: (...args: unknown[]) => Promise<unknown>;
  removeMember: (...args: unknown[]) => Promise<unknown>;
  updateMemberRole: (...args: unknown[]) => Promise<unknown>;
};
const ApiResponse = require('../../utils/ApiResponse').default;
const asyncHandler = require('../../utils/asyncHandler').default as (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => void;

exports.createTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.createTeam(req.tenantId, req.user?._id, req.body);
  ApiResponse.created(res, team, 'Team created');
});

exports.listTeams = asyncHandler(async (req: Request, res: Response) => {
  const teams = await teamService.getUserTeams(req.tenantId, req.user?._id);
  ApiResponse.ok(res, teams);
});

exports.getTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.getTeam(req.params.id, req.tenantId, req.user?._id);
  ApiResponse.ok(res, team);
});

exports.updateTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.updateTeam(req.params.id, req.tenantId, req.user?._id, req.body);
  ApiResponse.ok(res, team, 'Team updated');
});

exports.deleteTeam = asyncHandler(async (req: Request, res: Response) => {
  await teamService.deleteTeam(req.params.id, req.tenantId, req.user?._id);
  ApiResponse.noContent(res);
});

exports.inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.inviteMember(req.params.id, req.tenantId, req.user?._id, (req.body as { userId?: string }).userId, (req.body as { role?: string }).role);
  ApiResponse.ok(res, team, 'Member invited');
});

exports.removeMember = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.removeMember(req.params.id, req.tenantId, req.user?._id, req.params.userId);
  ApiResponse.ok(res, team, 'Member removed');
});

exports.updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
  const team = await teamService.updateMemberRole(req.params.id, req.tenantId, req.user?._id, req.params.userId, (req.body as { role?: string }).role);
  ApiResponse.ok(res, team, 'Role updated');
});

export {};
