import { Router } from 'express';
const passport = require('../../config/passport') as any;
import authMiddleware from '../../middleware/auth.middleware';
const { authenticate, authorize, protect, scopeTenant } = authMiddleware as any;
const rateLimitMiddleware = require('../../middleware/rateLimit.middleware') as any;
const { authLimiter, aiLimiter } = rateLimitMiddleware;
const validate = require('../../middleware/validate.middleware') as any;
const healthCtrl = require('../../controllers/health.controller') as any;
const Tenant   = require('../../models/Tenant') as any;
import multer from 'multer';

// Controllers (CJS exports.* pattern)
const authCtrl        = require('../../controllers/auth') as any;
const googleAuthCtrl  = require('../../controllers/googleAuth') as any;
const userCtrl        = require('../../controllers/user') as any;
const meetingCtrl     = require('../../controllers/meeting') as any;
const teamCtrl        = require('../../controllers/team') as any;
const channelCtrl     = require('../../controllers/channel') as any;
const notifCtrl       = require('../../controllers/notification') as any;
const chatCtrl        = require('../../controllers/chat') as any;
const aiCtrl              = require('../../controllers/ai') as any;
const transcriptionCtrl   = require('../../controllers/transcription') as any;
const taskCtrl        = require('../../controllers/task') as any;
const analyticsCtrl   = require('../../controllers/analytics') as any;
const exportCtrl      = require('../../controllers/export') as any;
const recordingCtrl   = require('../../controllers/recording') as any;
const mediaCtrl       = require('../../controllers/media') as any;

// Validators
import * as AV from '../../validators/auth.validator';
import * as UV from '../../validators/user.validator';
import * as MV from '../../validators/meeting.validator';
import * as TV from '../../validators/team.validator';
import * as CV from '../../validators/channel.validator';
import * as NV from '../../validators/notification.validator';
import { ROLES } from '../../constants';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
router.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed` }),
  googleAuthCtrl.googleCallback
);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/signup',             authLimiter, validate(AV.signup),          authCtrl.signup);
router.post('/auth/login',              authLimiter, validate(AV.login),           authCtrl.login);
router.post('/auth/forgot-password',    authLimiter, validate(AV.forgotPassword),  authCtrl.forgotPassword);
router.post('/auth/reset-password/:token', authLimiter, validate(AV.resetPassword), authCtrl.resetPassword);
router.get('/auth/verify-email/:token',             validate(AV.verifyEmail),      authCtrl.verifyEmail);
router.post('/auth/refresh-token',                  validate(AV.refreshToken),     authCtrl.refreshToken);

router.get('/auth/me',               authenticate,                                    authCtrl.getMe);
router.post('/auth/logout',          authenticate,                                    authCtrl.logout);
router.post('/auth/logout-all',      authenticate,                                    authCtrl.logoutAll);
router.post('/auth/change-password', authenticate, validate(AV.changePassword),       authCtrl.changePassword);
router.post('/auth/unlock/:id',      authenticate, authorize('admin'),                authCtrl.unlockAccount);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users/me',      protect,                                    userCtrl.getProfile);
router.put('/users/me',      protect, validate(UV.updateProfile),         userCtrl.updateProfile);
router.delete('/users/me',   protect,                                    userCtrl.deleteAccount);
router.get('/users',         protect, authorize('admin', 'super_admin'),  userCtrl.getAllUsers);
router.patch('/users/:userId/role', protect, authorize('admin', 'super_admin'), validate(UV.updateRole), userCtrl.updateRole);
router.post('/users/avatar', protect, upload.single('avatar'),            userCtrl.uploadAvatar);

// ── Meetings ──────────────────────────────────────────────────────────────────
router.use('/meetings', protect, scopeTenant());
router.get('/meetings/completed',  meetingCtrl.listCompletedMeetings);
router.post('/meetings',         validate(MV.createMeeting),      meetingCtrl.createMeeting);
router.get('/meetings',          validate(MV.listMeetings),        meetingCtrl.listMeetings);
router.post('/meetings/join',    validate(MV.joinMeeting),              meetingCtrl.joinMeeting);
router.get('/meetings/:id',      validate(MV.getMeeting),          meetingCtrl.getMeeting);
router.put('/meetings/:id',      validate(MV.updateMeeting),       meetingCtrl.updateMeeting);
router.delete('/meetings/:id',   validate(MV.getMeeting),          meetingCtrl.deleteMeeting);
router.post('/meetings/:id/invite', validate(MV.inviteParticipants), meetingCtrl.inviteParticipants);
router.post('/meetings/:id/rsvp',   validate(MV.respondToInvite),    meetingCtrl.respondToInvite);
router.post('/meetings/:id/start',  validate(MV.getMeeting),          meetingCtrl.startMeeting);
router.post('/meetings/:id/leave',  validate(MV.getMeeting),          meetingCtrl.leaveMeeting);
router.post('/meetings/:id/end',    validate(MV.getMeeting),          meetingCtrl.endMeeting);
router.get('/meetings/:id/history', validate(MV.getMeeting),          meetingCtrl.getMeetingHistory);
router.get('/meetings/:id/notes',   validate(MV.getMeeting),          meetingCtrl.getMeetingNote);
router.put('/meetings/:id/notes',   validate(MV.upsertNote),          meetingCtrl.upsertMeetingNote);

// ── Teams ─────────────────────────────────────────────────────────────────────
router.use('/teams', protect, scopeTenant());
router.get('/teams/search/users',                    teamCtrl.searchUsersToInvite);
router.post('/teams',                             validate(TV.createTeam), teamCtrl.createTeam);
router.get('/teams',                                                            teamCtrl.listTeams);
router.get('/teams/:id',                             validate(TV.teamParam),   teamCtrl.getTeam);
router.put('/teams/:id',                             validate(TV.updateTeam), teamCtrl.updateTeam);
router.delete('/teams/:id',                          validate(TV.teamParam),  teamCtrl.deleteTeam);
router.post('/teams/:id/members',                    validate(TV.inviteMember),    teamCtrl.inviteMember);
router.post('/teams/:id/invite',                     validate(TV.inviteByEmail),   teamCtrl.inviteMemberByEmail);
router.post('/teams/:id/join',                       validate(TV.teamParam),       teamCtrl.acceptInvitation);
router.post('/teams/:id/reject',                     validate(TV.teamParam),       teamCtrl.rejectInvitation);
router.delete('/teams/:id/members/:userId', authorize(ROLES.ADMIN), validate(TV.memberParam), teamCtrl.removeMember);
router.patch('/teams/:id/members/:userId/role',      validate(TV.updateMemberRole), teamCtrl.updateMemberRole);
router.post('/teams/:teamId/channels',               validate(CV.createChannel),   channelCtrl.createChannel);
router.get('/teams/:teamId/channels',                                              channelCtrl.listChannels);

// ── Channels ──────────────────────────────────────────────────────────────────
router.use('/channels', protect, scopeTenant());
router.get('/channels/:id',       validate(CV.channelParam),  channelCtrl.getChannel);
router.put('/channels/:id',       authorize(ROLES.ADMIN), validate(CV.updateChannel), channelCtrl.updateChannel);
router.delete('/channels/:id',    authorize(ROLES.ADMIN), validate(CV.channelParam),  channelCtrl.archiveChannel);
router.get('/channels/:id/messages',              validate(CV.listMessages), channelCtrl.getMessages);
router.post('/channels/:id/messages',             validate(CV.sendMessage),  channelCtrl.sendMessage);
router.put('/channels/:id/messages/:msgId',       validate(CV.editMessage),  channelCtrl.editMessage);
router.delete('/channels/:id/messages/:msgId',    validate(CV.editMessage),  channelCtrl.deleteMessage);
router.post('/channels/:id/messages/:msgId/react',validate(CV.reaction),     channelCtrl.toggleReaction);
router.post('/channels/:id/messages/:msgId/pin',  validate(CV.channelParam), channelCtrl.pinMessage);
router.delete('/channels/:id/messages/:msgId/pin',                           channelCtrl.unpinMessage);

// ── Notifications ─────────────────────────────────────────────────────────────
router.use('/notifications', protect);
router.get('/notifications',          validate(NV.listNotifications), notifCtrl.getNotifications);
router.post('/notifications/read-all',                                notifCtrl.markAllRead);
router.patch('/notifications/:id/read', validate(NV.notifParam),     notifCtrl.markRead);
router.delete('/notifications/:id',     validate(NV.notifParam),     notifCtrl.deleteNotification);

// ── Chat ──────────────────────────────────────────────────────────────────────
router.use('/chat', protect);
router.get('/chat/:meetingId',    chatCtrl.getMessages);
router.post('/chat/:meetingId',   chatCtrl.sendMessage);
router.delete('/chat/:messageId', chatCtrl.deleteMessage);

// ── Team Chat ─────────────────────────────────────────────────────────────────
const teamChatCtrl = require('../../controllers/teamChat') as any;
router.get('/teams/:teamId/chat',                      teamChatCtrl.getMessages);
router.post('/teams/:teamId/chat',                     teamChatCtrl.sendMessage);
router.put('/teams/:teamId/chat/:messageId',           teamChatCtrl.editMessage);
router.delete('/teams/:teamId/chat/:messageId',        teamChatCtrl.deleteMessage);
router.post('/teams/:teamId/chat/:messageId/react',    teamChatCtrl.toggleReaction);

// ── AI ────────────────────────────────────────────────────────────────────────
router.use('/ai', protect, scopeTenant('tenantId'), aiLimiter);
router.get('/ai/search',                                    aiCtrl.searchMeetings);
router.get('/ai/history',                                   aiCtrl.getMeetingHistory);
router.get('/ai/:meetingId/full-report',                    aiCtrl.getFullReport);
router.get('/ai/:meetingId/follow-up-suggestions',          aiCtrl.getFollowUpSuggestions);
router.get('/ai/:meetingId',                                aiCtrl.getAIResult);
// Summary
router.post('/ai/:meetingId/summary',                       aiCtrl.generateSummary);
router.get('/ai/:meetingId/summary',                        aiCtrl.getSummary);
router.delete('/ai/:meetingId/summary',                     aiCtrl.deleteSummary);
// Transcript
router.get('/ai/:meetingId/transcript',                     aiCtrl.getTranscript);
router.post('/ai/:meetingId/transcript',                    aiCtrl.saveTranscript);
router.post('/ai/:meetingId/transcribe-audio',  upload.single('audio'), transcriptionCtrl.transcribeAudio);
router.post('/ai/:meetingId/consolidate-transcript',        transcriptionCtrl.consolidateTranscript);
// Action Items
router.get('/ai/:meetingId/action-items',                   aiCtrl.getActionItems);
router.put('/ai/:meetingId/action-items/:itemId',           aiCtrl.updateActionItem);
router.delete('/ai/:meetingId/action-items/:itemId',        aiCtrl.deleteActionItem);
// Decisions, Keywords, Smart Notes
router.get('/ai/:meetingId/decisions',                      aiCtrl.getDecisions);
router.get('/ai/:meetingId/keywords',                       aiCtrl.getKeywords);
router.get('/ai/:meetingId/smart-notes',                    aiCtrl.getSmartNotes);
// Minutes, Assistant, Tasks
router.post('/ai/:meetingId/minutes',                       aiCtrl.generateMinutes);
router.post('/ai/:meetingId/assistant',                     aiCtrl.assistantChat);
router.post('/ai/:meetingId/tasks',                         aiCtrl.generateTasks);
router.post('/ai/:meetingId/extract-tasks',                 aiCtrl.extractAndSaveTasks);

// ── Tasks ─────────────────────────────────────────────────────────────────────
router.use('/tasks', protect, scopeTenant());
router.get('/tasks',              taskCtrl.getTasks);
router.post('/tasks',             taskCtrl.createTask);
router.put('/tasks/:id',          taskCtrl.updateTask);
router.delete('/tasks/:id',       taskCtrl.deleteTask);
router.get('/tasks/:id/history',  taskCtrl.getTaskHistory);

// ── Team Workspace (team-scoped tasks + activity) ─────────────────────────────
router.get('/teams/:teamId/tasks',          taskCtrl.getTeamTasks);
router.get('/teams/:teamId/activity',       taskCtrl.getTeamActivity);

// ── Tenants ───────────────────────────────────────────────────────────────────
router.use('/tenants', protect);
router.get('/tenants',             authorize('super_admin'), async (req, res, next) => {
  try { res.json(await Tenant.find().select('-__v')); } catch (e) { next(e); }
});
router.get('/tenants/me',          authenticate, async (req, res, next) => {
  try {
    const t = await Tenant.findById((req as any).tenantId);
    if (!t) return res.status(404).json({ message: 'Tenant not found' });
    res.json(t);
  } catch (e) { next(e); }
});
router.patch('/tenants/me/settings', authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    res.json(await Tenant.findByIdAndUpdate((req as any).tenantId, { $set: { settings: req.body } }, { new: true, runValidators: true }));
  } catch (e) { next(e); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.use('/analytics', protect, scopeTenant());
router.get('/analytics/dashboard', analyticsCtrl.getDashboard);
router.get('/analytics',           analyticsCtrl.getAnalyticsData);

// ── Export ────────────────────────────────────────────────────────────────────
router.use('/export', authenticate, scopeTenant('tenantId'));
router.get('/export/summary/:meetingId',      exportCtrl.exportSummaryPDF);
router.get('/export/minutes/:meetingId',      exportCtrl.exportMinutesDOCX);
router.get('/export/markdown/:meetingId',     exportCtrl.exportMarkdown);
router.get('/export/action-items/:meetingId', exportCtrl.exportActionItemsCSV);
router.get('/export/analytics',               exportCtrl.exportAnalyticsCSV);

// ── Recordings ────────────────────────────────────────────────────────────────
router.use('/recordings', authenticate, scopeTenant('tenantId'));
router.get('/recordings',                              recordingCtrl.listRecordings);
router.get('/recordings/:id',                          recordingCtrl.getRecording);
router.post('/recordings/upload', upload.single('video'), recordingCtrl.uploadRecording);
router.post('/recordings/start',                       recordingCtrl.startRecording);
router.post('/recordings/:id/stop',                    recordingCtrl.stopRecording);
router.delete('/recordings/:id',                       recordingCtrl.deleteRecording);

// ── Media ─────────────────────────────────────────────────────────────────────
router.use('/media', authenticate, scopeTenant('tenantId'));
router.post('/media/upload', upload.single('file'), mediaCtrl.upload);
router.get('/media',                                mediaCtrl.list);
router.delete('/media/:id',                         mediaCtrl.delete);

export default router;
module.exports = router;
module.exports.default = router;
