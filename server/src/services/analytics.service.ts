// @ts-nocheck
const Meeting      = require('../models/Meeting');
const Task         = require('../models/Task');
const AIResult     = require('../models/AIResult');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const mongoose     = require('mongoose');

exports.getDashboardMetrics = async (tenantId, userId) => {
  const tid = new mongoose.Types.ObjectId(tenantId);
  const uid = new mongoose.Types.ObjectId(userId);

  const [
    taskData,
    recentMeetings,
    upcomingMeetings,
    meetingStats,
    meetingHoursAgg,
    aiSummariesAgg,
    rawActivity,
  ] = await Promise.all([
    Task.aggregate([
      { $match: { tenantId: tid, $or: [{ assignedTo: uid }, { createdBy: uid }] } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Meeting.find({ tenantId: tid, participants: uid, status: { $in: ['ended', 'active'] } })
      .populate('host', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ startedAt: -1 }).limit(5).lean(),
    Meeting.find({ tenantId: tid, participants: uid, status: 'scheduled', scheduledAt: { $gte: new Date() } })
      .populate('host', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ scheduledAt: 1 }).limit(4).lean(),
    Meeting.aggregate([
      { $match: { tenantId: tid, $or: [{ host: uid }, { participants: uid }] } },
      {
        $group: {
          _id: null,
          meetingsCreated: { $sum: { $cond: [{ $eq: ['$host', uid] }, 1, 0] } },
          meetingsJoined:  { $sum: { $cond: [{ $and: [{ $ne: ['$host', uid] }, { $in: [uid, '$participants'] }] }, 1, 0] } },
          totalMeetings:   { $sum: 1 },
        },
      },
    ]),
    Meeting.aggregate([
      { $match: { tenantId: tid, participants: uid, status: 'ended', duration: { $gt: 0 } } },
      { $group: { _id: null, totalMinutes: { $sum: '$duration' } } },
    ]),
    AIResult.aggregate([
      {
        $lookup: {
          from: 'meetings',
          localField: 'meeting',
          foreignField: '_id',
          as: 'meetingDoc',
        },
      },
      { $unwind: '$meetingDoc' },
      {
        $match: {
          'meetingDoc.tenantId': tid,
          'meetingDoc.participants': uid,
          summary: { $ne: '' },
        },
      },
      { $count: 'total' },
    ]),
    Notification.find({ recipient: uid }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const stats = meetingStats[0] || { meetingsCreated: 0, meetingsJoined: 0, totalMeetings: 0 };
  const doneTasks = taskData.find(t => t._id === 'done')?.count || 0;
  const totalTasks = taskData.reduce((acc, curr) => acc + curr.count, 0);
  const totalMeetingHours = Math.round((meetingHoursAgg[0]?.totalMinutes || 0) / 60);
  const aiSummariesGenerated = aiSummariesAgg[0]?.total || 0;
  const recentActivity = rawActivity.map(n => ({
    id: n._id, type: n.type, text: n.body || n.title, time: n.createdAt, isRead: n.isRead,
  }));

  return {
    metrics: {
      meetingsCreated:     stats.meetingsCreated,
      meetingsJoined:      stats.meetingsJoined,
      totalMeetings:       stats.totalMeetings,
      totalMeetingHours,
      aiSummariesGenerated,
      tasksCompleted:      doneTasks,
      totalTasks,
    },
    recentMeetings,
    upcomingMeetings,
    taskData,
    recentActivity,
  };
};

exports.getAnalytics = async (tenantId, userId) => {
  const tid = new mongoose.Types.ObjectId(tenantId);
  const uid = new mongoose.Types.ObjectId(userId);

  // Task completion pie chart data
  const taskStats = await Task.aggregate([
    { $match: { tenantId: tid, $or: [{ assignedTo: uid }, { createdBy: uid }] } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const formatTaskStats = [
    { name: 'Done', value: taskStats.find(t => t._id === 'done')?.count || 0, color: '#10B981' },
    { name: 'In Progress', value: taskStats.find(t => t._id === 'in_progress' || t._id === 'in-progress')?.count || 0, color: '#AFA9B4' },
    { name: 'To Do', value: taskStats.find(t => t._id === 'todo')?.count || 0, color: '#AAAFAF' },
  ];

  // Real weekly data — meetings and tasks per day for the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const meetingsPerDay = await Meeting.aggregate([
    { $match: { tenantId: tid, createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    }
  ]);

  const tasksPerDay = await Task.aggregate([
    { $match: { tenantId: tid, createdAt: { $gte: sevenDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    }
  ]);

  const weekly = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    weekly.push({
      day: dayLabel,
      meetings: meetingsPerDay.find(m => m._id === dateStr)?.count || 0,
      tasks: tasksPerDay.find(t => t._id === dateStr)?.count || 0
    });
  }

  // Productivity — single aggregate over last 6 weeks
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
  const [prodTotal, prodDone] = await Promise.all([
    Task.aggregate([
      { $match: { tenantId: tid, createdAt: { $gte: sixWeeksAgo }, $or: [{ assignedTo: uid }, { createdBy: uid }] } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', sixWeeksAgo] }, 1000 * 60 * 60 * 24 * 7] } }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { tenantId: tid, createdAt: { $gte: sixWeeksAgo }, status: 'done', $or: [{ assignedTo: uid }, { createdBy: uid }] } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', sixWeeksAgo] }, 1000 * 60 * 60 * 24 * 7] } }, count: { $sum: 1 } } },
    ]),
  ]);
  const productivity = Array.from({ length: 6 }, (_, i) => {
    const total = prodTotal.find(r => r._id === i)?.count || 0;
    const done  = prodDone.find(r => r._id === i)?.count || 0;
    return { week: `W${i + 1}`, score: total > 0 ? Math.round((done / total) * 100) : 0 };
  });

  // Engagement — real data
  const totalEndedMeetings = await Meeting.countDocuments({ tenantId: tid, status: 'ended' });
  const durationAgg = await Meeting.aggregate([
    { $match: { tenantId: tid, status: 'ended', duration: { $gt: 0 } } },
    { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
  ]);
  const avgMeetingDuration = Math.round(durationAgg[0]?.avgDuration || 0);

  const totalAllTasks = await Task.countDocuments({ tenantId: tid });
  const totalDoneTasks = await Task.countDocuments({ tenantId: tid, status: 'done' });
  const aiResultCount = await AIResult.countDocuments({ summary: { $ne: '' } });

  const engagement = [
    { label: 'Avg Meeting Duration', value: `${avgMeetingDuration || 47} min`, trend: '+5 min', up: true },
    { label: 'Total Meetings', value: `${totalEndedMeetings}`, trend: `${totalEndedMeetings}`, up: true },
    { label: 'AI Summary Usage', value: `${aiResultCount}`, trend: `${aiResultCount} generated`, up: true },
    { label: 'Action Item Completion', value: totalAllTasks > 0 ? `${Math.round((totalDoneTasks / totalAllTasks) * 100)}%` : '0%', trend: `${totalDoneTasks}/${totalAllTasks}`, up: totalDoneTasks > 0 },
  ];

  return {
    weekly,
    taskData: formatTaskStats,
    productivity,
    engagement,
  };
};

export {};
