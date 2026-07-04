"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Task = require('../../models/Task');
const TaskActivity = require('../../models/TaskActivity');
const Team = require('../../models/Team');
const notifService = require('../../services/notification.service');
const asyncHandler = require('../../utils/asyncHandler').default;
const ApiResponse = require('../../utils/ApiResponse').default;
const ApiError = require('../../utils/ApiError').default;
const POPULATE = [
    { path: 'assignedTo', select: 'name email avatar' },
    { path: 'createdBy', select: 'name email avatar' },
    { path: 'meeting', select: 'title' },
];
const isAdminOrOwner = (task, req) => {
    const isAdmin = ['admin', 'super_admin'].includes(String(req.user?.role ?? ''));
    const isOwner = String(task.createdBy) === String(req.user?._id ?? '');
    return isAdmin || isOwner;
};
const logActivity = async (taskId, teamId, tenantId, actor, action, meta = {}) => {
    try {
        await TaskActivity.create({ taskId, teamId, tenantId, actor, action, meta });
    }
    catch { /* non-critical */ }
};
/* ── Generic task list (existing /tasks route) ─────────────────────────────── */
exports.getTasks = asyncHandler(async (req, res) => {
    const filter = { tenantId: req.tenantId };
    if (req.query.meetingId) {
        filter.meeting = req.query.meetingId;
    }
    else {
        filter.$or = [{ assignedTo: req.user?._id }, { createdBy: req.user?._id }];
    }
    if (req.query.status)
        filter.status = req.query.status;
    if (req.query.priority)
        filter.priority = req.query.priority;
    const tasks = await Task.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    ApiResponse.ok(res, tasks);
});
/* ── Team-scoped task list ──────────────────────────────────────────────────── */
exports.getTeamTasks = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    // Verify membership
    const team = await Team.findOne({ _id: teamId, tenantId: req.tenantId });
    if (!team)
        throw ApiError.notFound('Team not found');
    const isMember = team.members.some((m) => String(m.user) === String(req.user?._id));
    if (!isMember)
        throw ApiError.forbidden('Not a team member');
    const filter = { tenantId: req.tenantId, teamId };
    if (req.query.status)
        filter.status = req.query.status;
    if (req.query.priority)
        filter.priority = req.query.priority;
    const tasks = await Task.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    ApiResponse.ok(res, tasks);
});
/* ── Create task ────────────────────────────────────────────────────────────── */
exports.createTask = asyncHandler(async (req, res) => {
    const task = await Task.create({
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.user?._id,
    });
    const populated = await task.populate(POPULATE);
    await logActivity(task._id, task.teamId, req.tenantId, req.user?._id, 'created', { title: task.title });
    // Notify assignee if different from creator
    if (task.assignedTo && String(task.assignedTo) !== String(req.user?._id)) {
        notifService.notifyTaskAssigned(task, task.assignedTo, req.user?._id).catch(() => { });
    }
    ApiResponse.created(res, populated, 'Task created');
});
/* ── Update task ────────────────────────────────────────────────────────────── */
exports.updateTask = asyncHandler(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!task)
        return res.status(404).json({ success: false, message: 'Task not found' });
    if (!isAdminOrOwner(task, req))
        throw ApiError.forbidden('Not authorised to modify this task');
    const { tenantId: _t, createdBy: _c, meeting: _m, ...safeBody } = req.body;
    // Build history entries for changed fields
    const TRACKED = ['status', 'priority', 'assignedTo', 'dueDate', 'title'];
    const historyEntries = TRACKED
        .filter(f => safeBody[f] !== undefined && String(safeBody[f]) !== String(task[f]))
        .map(f => ({ changedBy: req.user?._id, field: f, from: task[f], to: safeBody[f], at: new Date() }));
    const updated = await Task.findByIdAndUpdate(task._id, { ...safeBody, $push: historyEntries.length ? { history: { $each: historyEntries } } : {} }, { new: true, runValidators: true }).populate(POPULATE);
    for (const h of historyEntries) {
        await logActivity(task._id, task.teamId, req.tenantId, req.user?._id, `${h.field}_changed`, { from: h.from, to: h.to });
        // Notify new assignee when assignedTo changes
        if (h.field === 'assignedTo' && h.to && String(h.to) !== String(req.user?._id)) {
            notifService.notifyTaskAssigned({ ...task.toObject(), title: updated?.title ?? task.title }, h.to, req.user?._id).catch(() => { });
        }
    }
    ApiResponse.ok(res, updated, 'Task updated');
});
/* ── Delete task ────────────────────────────────────────────────────────────── */
exports.deleteTask = asyncHandler(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!task)
        return res.status(404).json({ success: false, message: 'Task not found' });
    // Allow: admin, task creator, or any member of the task's team
    const isAdmin = ['admin', 'super_admin'].includes(String(req.user?.role ?? ''));
    const isCreator = String(task.createdBy) === String(req.user?._id ?? '');
    let isTeamMember = false;
    if (task.teamId) {
        const team = await Team.findOne({ _id: task.teamId, tenantId: req.tenantId }).select('members');
        isTeamMember = team?.members.some((m) => String(m.user) === String(req.user?._id)) ?? false;
    }
    if (!isAdmin && !isCreator && !isTeamMember)
        throw ApiError.forbidden('Not authorised to delete this task');
    await task.deleteOne();
    await logActivity(task._id, task.teamId, req.tenantId, req.user?._id, 'deleted', { title: task.title });
    ApiResponse.ok(res, {}, 'Task deleted');
});
/* ── Task history ───────────────────────────────────────────────────────────── */
exports.getTaskHistory = asyncHandler(async (req, res) => {
    const task = await Task.findOne({ _id: req.params.id, tenantId: req.tenantId })
        .select('history')
        .populate('history.changedBy', 'name email avatar');
    if (!task)
        throw ApiError.notFound('Task not found');
    ApiResponse.ok(res, task.history ?? []);
});
/* ── Activity log (team-level) ──────────────────────────────────────────────── */
exports.getTeamActivity = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const team = await Team.findOne({ _id: teamId, tenantId: req.tenantId });
    if (!team)
        throw ApiError.notFound('Team not found');
    const isMember = team.members.some((m) => String(m.user) === String(req.user?._id));
    if (!isMember)
        throw ApiError.forbidden('Not a team member');
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const activities = await TaskActivity.find({ teamId, tenantId: req.tenantId })
        .populate('actor', 'name email avatar')
        .populate('taskId', 'title')
        .sort({ createdAt: -1 })
        .limit(limit);
    ApiResponse.ok(res, activities);
});
