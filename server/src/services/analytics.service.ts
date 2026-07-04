// @ts-nocheck
const Meeting      = require('../models/Meeting');
const Task         = require('../models/Task');
const AIResult     = require('../models/AIResult');
const Notification = require('../models/Notification');
const mongoose     = require('mongoose');

// ── helpers ───────────────────────────────────────────────────────────────────
const toOid = (v) => {
  try { return new mongoose.Types.ObjectId(String(v)); } catch { return null; }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
exports.getDashboardMetrics = async (tenantId, userId) => {
  const uid = toOid(userId);
  if (!uid) {
    return {
      metrics: {
        meetingsCreated: 0, meetingsJoined: 0, totalMeetings: 0,
        totalMeetingHours: 0, totalMeetingMinutes: 0,
        aiSummariesGenerated: 0, tasksCompleted: 0, totalTasks: 0,
        lastMeeting: null, upcomingCount: 0,
      },
      recentMeetings: [], upcomingMeetings: [], taskData: [], recentActivity: [],
    };
  }

  const tid = toOid(tenantId); // may be null — queries below handle both cases

  // Build tenant match fragment (used in every query)
  const tenantMatch = tid ? { tenantId: tid } : {};

  const now = new Date();

  const [
    meetingAgg,
    taskData,
    recentMeetings,
    upcomingMeetings,
    aiSummariesAgg,
    rawActivity,
  ] = await Promise.all([

    // ── Single pipeline for all meeting metrics ──────────────────────────────
    Meeting.aggregate([
      {
        $match: {
          ...tenantMatch,
          $or: [{ host: uid }, { participants: uid }],
        },
      },
      {
        $facet: {
          // Meetings this user created
          created: [
            { $match: { host: uid } },
            { $count: 'n' },
          ],
          // Meetings this user joined as a NON-HOST participant
          joined: [
            { $match: { host: { $ne: uid }, 'participantHistory.user': uid } },
            { $count: 'n' },
          ],
          // Total meetings = created + joined (host OR participant)
          total: [
            { $count: 'n' },
          ],
          // Sum of duration (minutes) for ended meetings
          hours: [
            { $match: { status: 'ended', duration: { $gt: 0 } } },
            { $group: { _id: null, totalMinutes: { $sum: '$duration' } } },
          ],
          // Last ended meeting
          lastMeeting: [
            { $match: { status: 'ended' } },
            { $sort: { endedAt: -1 } },
            { $limit: 1 },
            { $project: { title: 1, endedAt: 1, duration: 1 } },
          ],
          // Upcoming count
          upcomingCount: [
            { $match: { status: 'scheduled', scheduledAt: { $gte: now } } },
            { $count: 'n' },
          ],
        },
      },
    ]),

    // ── Tasks ────────────────────────────────────────────────────────────────
    Task.aggregate([
      { $match: { ...tenantMatch, $or: [{ assignedTo: uid }, { createdBy: uid }] } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // ── Recent meetings (ended + active) ─────────────────────────────────────
    Meeting.find({
      ...tenantMatch,
      $or: [{ host: uid }, { participants: uid }],
      status: { $in: ['ended', 'active'] },
    })
      .populate('host', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ startedAt: -1 })
      .limit(5)
      .lean(),

    // ── Upcoming meetings ─────────────────────────────────────────────────────
    Meeting.find({
      ...tenantMatch,
      $or: [{ host: uid }, { participants: uid }],
      status: 'scheduled',
      scheduledAt: { $gte: now },
    })
      .populate('host', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ scheduledAt: 1 })
      .limit(4)
      .lean(),

    // ── AI summaries ──────────────────────────────────────────────────────────
    AIResult.aggregate([
      {
        $lookup: {
          from: 'meetings', localField: 'meeting', foreignField: '_id',
          pipeline: [{ $project: { tenantId: 1, participants: 1 } }],
          as: 'mtg',
        },
      },
      { $unwind: '$mtg' },
      {
        $match: {
          ...(tid ? { 'mtg.tenantId': tid } : {}),
          'mtg.participants': uid,
          summary: { $nin: [null, ''] },
        },
      },
      { $count: 'total' },
    ]),

    // ── Recent activity (notifications) ──────────────────────────────────────
    Notification.find({ recipient: uid }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Unpack facet results
  const agg            = meetingAgg[0] ?? {};
  const meetingsCreated  = agg.created?.[0]?.n        ?? 0;
  const meetingsJoined   = agg.joined?.[0]?.n         ?? 0;
  const totalMeetings    = agg.total?.[0]?.n           ?? 0;
  const totalMinutes        = agg.hours?.[0]?.totalMinutes ?? 0;
  const totalMeetingHours   = Math.floor(totalMinutes / 60);
  const totalMeetingMinutes = totalMinutes; // raw total minutes (e.g. 155)
  const lastMeeting      = agg.lastMeeting?.[0]       ?? null;
  const upcomingCount    = agg.upcomingCount?.[0]?.n  ?? 0;

  const doneTasks        = taskData.find(t => t._id === 'done')?.count ?? 0;
  const totalTasks       = taskData.reduce((s, t) => s + t.count, 0);
  const aiSummariesGenerated = aiSummariesAgg[0]?.total ?? 0;

  const recentActivity = rawActivity.map(n => ({
    id: n._id, type: n.type, text: n.body || n.title, time: n.createdAt, isRead: n.isRead,
  }));

  return {
    metrics: {
      meetingsCreated,
      meetingsJoined,
      totalMeetings,
      totalMeetingHours,
      totalMeetingMinutes,
      aiSummariesGenerated,
      tasksCompleted: doneTasks,
      totalTasks,
      lastMeeting,
      upcomingCount,
    },
    recentMeetings,
    upcomingMeetings,
    taskData,
    recentActivity,
  };
};

// ── Analytics page ────────────────────────────────────────────────────────────
exports.getAnalytics = async (tenantId, userId) => {
  const uid = toOid(userId);
  const tid = toOid(tenantId);
  if (!uid) return { weekly: [], taskData: [], productivity: [], engagement: [] };

  const tenantMatch = tid ? { tenantId: tid } : {};

  // Task completion pie
  const taskStats = await Task.aggregate([
    { $match: { ...tenantMatch, $or: [{ assignedTo: uid }, { createdBy: uid }] } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const formatTaskStats = [
    { name: 'Done',        value: taskStats.find(t => t._id === 'done')?.count ?? 0,        color: '#10B981' },
    { name: 'In Progress', value: taskStats.find(t => ['in_progress','in-progress'].includes(t._id))?.count ?? 0, color: '#AFA9B4' },
    { name: 'To Do',       value: taskStats.find(t => t._id === 'todo')?.count ?? 0,        color: '#AAAFAF' },
  ];

  // Weekly activity — scoped to this user
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [meetingsPerDay, tasksPerDay] = await Promise.all([
    Meeting.aggregate([
      {
        $match: {
          ...tenantMatch,
          $or: [{ host: uid }, { participants: uid }],
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { ...tenantMatch, $or: [{ assignedTo: uid }, { createdBy: uid }], createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const weekly = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr  = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    weekly.push({
      day:      dayLabel,
      meetings: meetingsPerDay.find(m => m._id === dateStr)?.count ?? 0,
      tasks:    tasksPerDay.find(t => t._id === dateStr)?.count    ?? 0,
    });
  }

  // Productivity — 6-week task completion rate for this user
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

  const [prodTotal, prodDone] = await Promise.all([
    Task.aggregate([
      { $match: { ...tenantMatch, createdAt: { $gte: sixWeeksAgo }, $or: [{ assignedTo: uid }, { createdBy: uid }] } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', sixWeeksAgo] }, 604_800_000] } }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { ...tenantMatch, createdAt: { $gte: sixWeeksAgo }, status: 'done', $or: [{ assignedTo: uid }, { createdBy: uid }] } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', sixWeeksAgo] }, 604_800_000] } }, count: { $sum: 1 } } },
    ]),
  ]);

  const productivity = Array.from({ length: 6 }, (_, i) => {
    const total = prodTotal.find(r => r._id === i)?.count ?? 0;
    const done  = prodDone.find(r => r._id === i)?.count  ?? 0;
    return { week: `W${i + 1}`, score: total > 0 ? Math.round((done / total) * 100) : 0 };
  });

  // Engagement KPIs — scoped to user
  const [durationAgg, userMeetingCount, userEndedCount, aiResultCount, allTasks, doneTasks] = await Promise.all([
    Meeting.aggregate([
      { $match: { ...tenantMatch, $or: [{ host: uid }, { participants: uid }], status: 'ended', duration: { $gt: 0 } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
    ]),
    Meeting.countDocuments({ ...tenantMatch, $or: [{ host: uid }, { participants: uid }] }),
    Meeting.countDocuments({ ...tenantMatch, $or: [{ host: uid }, { participants: uid }], status: 'ended' }),
    AIResult.aggregate([
      {
        $lookup: {
          from: 'meetings', localField: 'meeting', foreignField: '_id',
          pipeline: [{ $project: { participants: 1, tenantId: 1 } }],
          as: 'mtg',
        },
      },
      { $unwind: '$mtg' },
      { $match: { ...(tid ? { 'mtg.tenantId': tid } : {}), 'mtg.participants': uid, summary: { $nin: [null, ''] } } },
      { $count: 'total' },
    ]),
    Task.countDocuments({ ...tenantMatch, $or: [{ assignedTo: uid }, { createdBy: uid }] }),
    Task.countDocuments({ ...tenantMatch, $or: [{ assignedTo: uid }, { createdBy: uid }], status: 'done' }),
  ]);

  const avgDuration = Math.round(durationAgg[0]?.avgDuration ?? 0);
  const aiCount     = aiResultCount[0]?.total ?? 0;

  const engagement = [
    { label: 'Avg Meeting Duration',    value: `${avgDuration || 0} min`,  trend: `${userEndedCount} ended`,                                    up: avgDuration > 0 },
    { label: 'Total Meetings',          value: `${userMeetingCount}`,       trend: `${userEndedCount} completed`,                                up: userMeetingCount > 0 },
    { label: 'AI Summary Usage',        value: `${aiCount}`,                trend: `${aiCount} generated`,                                       up: aiCount > 0 },
    { label: 'Action Item Completion',  value: allTasks > 0 ? `${Math.round((doneTasks / allTasks) * 100)}%` : '0%', trend: `${doneTasks}/${allTasks}`, up: doneTasks > 0 },
  ];

  return { weekly, taskData: formatTaskStats, productivity, engagement };
};

export {};
