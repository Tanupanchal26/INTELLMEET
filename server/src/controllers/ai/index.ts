// @ts-nocheck
const asyncHandler           = require('../../utils/asyncHandler');
const ApiResponse            = require('../../utils/ApiResponse');
const ApiError               = require('../../utils/ApiError');
const AIResult               = require('../../models/AIResult');
const Task                   = require('../../models/Task');
const Meeting                = require('../../models/Meeting');
const aiService              = require('../../services/ai.service');
const { enqueueAIJob }       = require('../../queues/ai.queue');

const MAX_TRANSCRIPT = 50_000;
const MAX_PROMPT     = 2_000;

// ── GET /ai/:meetingId/full-report ───────────────────────────────────────────
exports.getFullReport = asyncHandler(async (req, res) => {
  const result = await AIResult.findOne({ meeting: req.params.meetingId })
    .select('summary actionItems decisions keywords followUpSuggestions minutes smartNotes processingStatus participants')
    .lean();
  if (!result) throw ApiError.notFound('AI result not found');
  return ApiResponse.ok(res, result, 'Full report retrieved');
});

// ── GET /ai/:meetingId/follow-up-suggestions ──────────────────────────────────
exports.getFollowUpSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await aiService.getFollowUpSuggestions(req.params.meetingId);
  return ApiResponse.ok(res, { suggestions }, 'Follow-up suggestions retrieved');
});

// ── GET /ai/:meetingId ────────────────────────────────────────────────────────
exports.getAIResult = asyncHandler(async (req, res) => {
  const result = await AIResult.findOne({ meeting: req.params.meetingId });
  if (!result) throw ApiError.notFound('AI result not found');
  return ApiResponse.ok(res, result, 'AI result retrieved');
});

// ── POST /ai/:meetingId/summary ───────────────────────────────────────────────
exports.generateSummary = asyncHandler(async (req, res) => {
  const { transcript, length = 'medium' } = req.body;
  
  if (transcript && transcript.length > MAX_TRANSCRIPT)
    throw ApiError.badRequest(`transcript exceeds ${MAX_TRANSCRIPT} character limit`);
  if (!['short', 'medium', 'detailed'].includes(length))
    throw ApiError.badRequest('length must be short, medium, or detailed');

  if (transcript) {
    await AIResult.findOneAndUpdate(
      { meeting: req.params.meetingId },
      { meeting: req.params.meetingId, transcript },
      { upsert: true, new: true }
    );
  }

  const summary = await aiService.summarize(req.params.meetingId, length);
  
  if (!summary) {
    return res.status(400).json(
      new ApiResponse(400, "Meeting transcript is empty. Generate or upload a transcript before requesting a summary.")
    );
  }
  
  return ApiResponse.ok(res, { summary }, 'Summary generated');
});

// ── GET /ai/:meetingId/summary ────────────────────────────────────────────────
exports.getSummary = asyncHandler(async (req, res) => {
  const result = await AIResult.findOne({ meeting: req.params.meetingId }).select('summary summaryLength');
  return ApiResponse.ok(res, { summary: result?.summary || '', length: result?.summaryLength || 'medium' }, 'Summary retrieved');
});

// ── DELETE /ai/:meetingId/summary ─────────────────────────────────────────────
exports.deleteSummary = asyncHandler(async (req, res) => {
  await AIResult.findOneAndUpdate(
    { meeting: req.params.meetingId },
    { summary: '', summaryLength: 'medium', $inc: { version: 1 } }
  );
  return ApiResponse.ok(res, null, 'Summary deleted');
});

// ── GET /ai/:meetingId/transcript ─────────────────────────────────────────────
exports.getTranscript = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const result = await AIResult.findOne({ meeting: req.params.meetingId });
  const chunks = result?.transcriptChunks || [];
  const start  = (Number(page) - 1) * Number(limit);
  const paged  = chunks.slice(start, start + Number(limit));
  return ApiResponse.ok(res, {
    transcript: result?.transcript || '',
    chunks:     paged,
    total:      chunks.length,
    page:       Number(page),
    limit:      Number(limit),
  }, 'Transcript retrieved');
});

// ── POST /ai/:meetingId/transcript ────────────────────────────────────────────
exports.saveTranscript = asyncHandler(async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) throw ApiError.badRequest('transcript is required');
  if (transcript.length > MAX_TRANSCRIPT)
    throw ApiError.badRequest(`transcript exceeds ${MAX_TRANSCRIPT} character limit`);
  await aiService.saveTranscript(req.params.meetingId, transcript);
  return ApiResponse.ok(res, null, 'Transcript saved');
});

// ── GET /ai/:meetingId/action-items ───────────────────────────────────────────
exports.getActionItems = asyncHandler(async (req, res) => {
  const result = await AIResult.findOne({ meeting: req.params.meetingId });
  if (!result?.transcript && !result?.transcriptChunks?.length)
    return res.status(400).json(
      new ApiResponse(400, "Meeting transcript is empty. Generate or upload a transcript before requesting action items.")
    );

  const actionItems = await aiService.getActionItems(req.params.meetingId);
  return ApiResponse.ok(res, { actionItems }, 'Action items extracted');
});

// ── PUT /ai/:meetingId/action-items/:itemId ───────────────────────────────────
exports.updateActionItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { text, assignee, dueDate, priority, status, done } = req.body;
  const result = await AIResult.findOne({ meeting: req.params.meetingId });
  if (!result) throw ApiError.notFound('AI result not found');

  const item = result.actionItems.id(itemId);
  if (!item) throw ApiError.notFound('Action item not found');

  if (text     !== undefined) item.text     = String(text).slice(0, 300);
  if (assignee !== undefined) item.assignee = assignee;
  if (dueDate  !== undefined) item.dueDate  = dueDate;
  if (priority !== undefined && ['high', 'medium', 'low'].includes(priority)) item.priority = priority;
  if (status   !== undefined && ['pending', 'in_progress', 'done'].includes(status)) item.status = status;
  if (done     !== undefined) item.done = Boolean(done);

  await result.save();
  return ApiResponse.ok(res, item, 'Action item updated');
});

// ── DELETE /ai/:meetingId/action-items/:itemId ────────────────────────────────
exports.deleteActionItem = asyncHandler(async (req, res) => {
  const result = await AIResult.findOne({ meeting: req.params.meetingId });
  if (!result) throw ApiError.notFound('AI result not found');
  result.actionItems.pull({ _id: req.params.itemId });
  await result.save();
  return ApiResponse.ok(res, null, 'Action item deleted');
});

// ── GET /ai/:meetingId/decisions ──────────────────────────────────────────────
exports.getDecisions = asyncHandler(async (req, res) => {
  const decisions = await aiService.getDecisions(req.params.meetingId);
  return ApiResponse.ok(res, { decisions }, 'Decisions retrieved');
});

// ── GET /ai/:meetingId/keywords ───────────────────────────────────────────────
exports.getKeywords = asyncHandler(async (req, res) => {
  const keywords = await aiService.getKeywords(req.params.meetingId);
  return ApiResponse.ok(res, { keywords }, 'Keywords retrieved');
});

// ── GET /ai/:meetingId/smart-notes ────────────────────────────────────────────
exports.getSmartNotes = asyncHandler(async (req, res) => {
  const smartNotes = await aiService.getSmartNotes(req.params.meetingId);
  if (!smartNotes) throw ApiError.badRequest('No transcript found for this meeting');
  return ApiResponse.ok(res, { smartNotes }, 'Smart notes retrieved');
});

// ── POST /ai/:meetingId/minutes ───────────────────────────────────────────────
exports.generateMinutes = asyncHandler(async (req, res) => {
  const { transcript, title, participants, date } = req.body;
  if (transcript && transcript.trim() && transcript.length > MAX_TRANSCRIPT)
    throw ApiError.badRequest(`transcript exceeds ${MAX_TRANSCRIPT} character limit`);

  // Save transcript only if a real one was provided
  if (transcript && transcript.trim()) {
    await AIResult.findOneAndUpdate(
      { meeting: req.params.meetingId },
      { meeting: req.params.meetingId, transcript },
      { upsert: true, new: true }
    );
  }

  // Verify a transcript exists (either just saved or already in DB)
  const existing = await AIResult.findOne({ meeting: req.params.meetingId }).select('transcript transcriptChunks');
  const hasTranscript = existing?.transcript?.trim() || existing?.transcriptChunks?.length;
  if (!hasTranscript) throw ApiError.badRequest('No transcript found. Generate or upload a transcript first.');

  const job = await enqueueAIJob('minutes', {
    meetingId:    req.params.meetingId,
    tenantId:     req.user?.tenantId,
    title:        title        || 'Meeting',
    participants: participants || [],
    date:         date         || new Date().toISOString(),
  });

  if (job) {
    return res.status(202).json(
      new ApiResponse(202, `Minutes generation queued (job: ${job.id})`, { jobId: job.id })
    );
  }

  const minutes = await aiService.generateMeetingMinutes(req.params.meetingId);
  return ApiResponse.ok(res, { minutes }, 'Minutes generated');
});

// ── POST /ai/:meetingId/assistant ─────────────────────────────────────────────
exports.assistantChat = asyncHandler(async (req, res) => {
  const { message, context } = req.body;
  if (!message) throw ApiError.badRequest('message is required');
  if (message.length > MAX_PROMPT)
    throw ApiError.badRequest(`message exceeds ${MAX_PROMPT} character limit`);
  const reply = await aiService.assistantChat(
    req.params.meetingId,
    req.user?.tenantId,
    message,
    context?.history || []
  );
  return ApiResponse.ok(res, { reply }, 'Assistant replied');
});

// ── POST /ai/:meetingId/tasks ─────────────────────────────────────────────────
exports.generateTasks = asyncHandler(async (req, res) => {
  const { prompt, transcript } = req.body;
  if (!prompt && !transcript) throw ApiError.badRequest('prompt or transcript is required');
  if (prompt     && prompt.length     > MAX_PROMPT)     throw ApiError.badRequest(`prompt exceeds ${MAX_PROMPT} character limit`);
  if (transcript && transcript.length > MAX_TRANSCRIPT) throw ApiError.badRequest(`transcript exceeds ${MAX_TRANSCRIPT} character limit`);
  const { generateTasks: genTasks } = require('../../ai/assistant');
  const tasks = await genTasks(prompt || '', transcript || '');
  return ApiResponse.ok(res, { tasks }, 'Tasks generated');
});

// ── POST /ai/:meetingId/extract-tasks ─────────────────────────────────────────
exports.extractAndSaveTasks = asyncHandler(async (req, res) => {
  const aiResult = await AIResult.findOne({ meeting: req.params.meetingId });
  const transcript = aiResult?.transcript ||
    (aiResult?.transcriptChunks || []).map((c: any) => `${c.speaker}: ${c.text}`).join('\n');
  if (!transcript) throw ApiError.badRequest('No transcript found for this meeting');

  const { extractActionItems } = require('../../ai/actionItems');
  const actionItems = await extractActionItems(transcript);
  const tasks = await Task.insertMany(
    actionItems.map((item: any) => ({
      title:     item.text || item,
      meeting:   req.params.meetingId,
      tenantId:  req.user?.tenantId,
      createdBy: req.user?.id,
      priority:  item.priority || 'medium',
    }))
  );
  return ApiResponse.ok(res, { tasks }, 'Tasks extracted and saved');
});

// ── GET /ai/search ────────────────────────────────────────────────────────────
exports.searchMeetings = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) throw ApiError.badRequest('query param q is required');
  if (String(q).length > 500) throw ApiError.badRequest('query too long');
  const results = await aiService.searchMeetings(req.user?.tenantId, String(q));
  return ApiResponse.ok(res, { results }, 'Search complete');
});

// ── GET /ai/history ───────────────────────────────────────────────────────────
exports.getMeetingHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const data = await aiService.getMeetingHistory(
    req.user?.tenantId,
    Number(page),
    Math.min(Number(limit), 100)
  );
  return ApiResponse.paginated(res, data.meetings, {
    page:  data.page,
    limit: data.limit,
    total: data.total,
  });
});

export {};
