// @ts-nocheck
const AIResult  = require('../models/AIResult');
const Meeting   = require('../models/Meeting');
const notifService = require('./notification.service');
const { summarize, extractKeywords, extractFollowUpSuggestions } = require('../ai/summarizer');
const { extractActionItems, extractDecisions } = require('../ai/actionItems');
const { generateMinutes, generateSmartNotes }  = require('../ai/minutesGenerator');
const { chat, generateTasks }  = require('../ai/assistant');
const { semanticSearch }       = require('../ai/semanticSearch');
const { getRedisClient }       = require('../config/redis');
const { CACHE_TTL }            = require('../constants');
const logger = require('../shared/utils/logger').default;

// ── Cache helpers ─────────────────────────────────────────────────────────────
const cacheGet = async (key: string) => {
  const r = getRedisClient();
  if (!r) return null;
  try {
    const val = await r.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
};

const cacheSet = async (key: string, data: any, ttl = CACHE_TTL.AI_SUMMARY) => {
  const r = getRedisClient();
  if (!r) return;
  try { await r.setEx(key, ttl, JSON.stringify(data)); } catch {}
};

const cacheDel = async (...keys: string[]) => {
  const r = getRedisClient();
  if (!r) return;
  try { await Promise.all(keys.map((k) => r.del(k))); } catch {}
};

// ── Transcript helpers ────────────────────────────────────────────────────────
const resolveTranscript = async (meetingId: string): Promise<string> => {
  const result = await AIResult.findOne({ meeting: meetingId });
  if (!result) return '';
  if (result.transcript?.trim()) return result.transcript;
  return (result.transcriptChunks || []).map((c: any) => `${c.speaker}: ${c.text}`).join('\n');
};

exports.saveTranscript = async (meetingId: string, transcript: string) => {
  await AIResult.findOneAndUpdate(
    { meeting: meetingId },
    { meeting: meetingId, transcript, processingStatus: 'idle' },
    { upsert: true, new: true }
  );
  await cacheDel(
    `ai:summary:${meetingId}`,
    `ai:minutes:${meetingId}`,
    `ai:keywords:${meetingId}`,
    `ai:smartnotes:${meetingId}`,
  );
};

// ── Summarize ─────────────────────────────────────────────────────────────────
exports.summarize = async (meetingId: string, length: 'short' | 'medium' | 'detailed' = 'medium') => {
  const cacheKey = `ai:summary:${meetingId}:${length}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const transcript = await resolveTranscript(meetingId);
  if (!transcript) return '';

  await AIResult.findOneAndUpdate({ meeting: meetingId }, { processingStatus: 'processing' }, { upsert: true });

  try {
    const [summary, actionItems, decisions] = await Promise.all([
      summarize(transcript, length),
      extractActionItems(transcript),
      extractDecisions(transcript),
    ]);

    await AIResult.findOneAndUpdate(
      { meeting: meetingId },
      { summary, summaryLength: length, actionItems, decisions, processingStatus: 'completed', $inc: { version: 1 } },
      { upsert: true }
    );
    await Meeting.findByIdAndUpdate(meetingId, { summary });
    await cacheSet(cacheKey, summary);

    // Notify all participants that summary is ready
    const mtg = await Meeting.findById(meetingId).select('participants host tenantId title meetingId').lean();
    if (mtg) {
      const participantIds = [
        ...new Set([
          String(mtg.host),
          ...(mtg.participants || []).map(String),
        ]),
      ];
      notifService.notifyAISummaryReady(mtg, participantIds).catch(() => {});
    }

    return summary;
  } catch (err: any) {
    await AIResult.findOneAndUpdate(
      { meeting: meetingId },
      { processingStatus: 'failed', processingError: err.message }
    );
    throw err;
  }
};

// ── Action Items ──────────────────────────────────────────────────────────────
exports.getActionItems = async (meetingId: string) => {
  const result = await AIResult.findOne({ meeting: meetingId });
  if (result?.actionItems?.length) return result.actionItems;

  const transcript = await resolveTranscript(meetingId);
  if (!transcript) return [];

  const actionItems = await extractActionItems(transcript);
  await AIResult.findOneAndUpdate({ meeting: meetingId }, { actionItems }, { upsert: true });
  return actionItems;
};

// ── Decisions ─────────────────────────────────────────────────────────────────
exports.getDecisions = async (meetingId: string) => {
  const result = await AIResult.findOne({ meeting: meetingId });
  if (result?.decisions?.length) return result.decisions;

  const transcript = await resolveTranscript(meetingId);
  if (!transcript) return [];

  const decisions = await extractDecisions(transcript);
  await AIResult.findOneAndUpdate({ meeting: meetingId }, { decisions }, { upsert: true });
  return decisions;
};

// ── Keywords ──────────────────────────────────────────────────────────────────
exports.getKeywords = async (meetingId: string) => {
  const cacheKey = `ai:keywords:${meetingId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const result = await AIResult.findOne({ meeting: meetingId });
  if (result?.keywords?.topics?.length) {
    await cacheSet(cacheKey, result.keywords);
    return result.keywords;
  }

  const transcript = await resolveTranscript(meetingId);
  if (!transcript) return { topics: [], people: [], projects: [], technologies: [], frequentTerms: [] };

  const keywords = await extractKeywords(transcript);
  await AIResult.findOneAndUpdate({ meeting: meetingId }, { keywords }, { upsert: true });
  await cacheSet(cacheKey, keywords);
  return keywords;
};

// ── Smart Notes ───────────────────────────────────────────────────────────────
exports.getSmartNotes = async (meetingId: string) => {
  const cacheKey = `ai:smartnotes:${meetingId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const [meeting, transcript] = await Promise.all([
    Meeting.findById(meetingId).select('title agenda').lean(),
    resolveTranscript(meetingId),
  ]);

  if (!transcript) return null;

  const agendaItems = (meeting?.agenda || []).map((a: any) => a.title).filter(Boolean);
  const smartNotes = await generateSmartNotes({
    transcript,
    title: meeting?.title || 'Meeting',
    agenda: agendaItems,
  });

  await AIResult.findOneAndUpdate({ meeting: meetingId }, { smartNotes }, { upsert: true });
  await cacheSet(cacheKey, smartNotes);
  return smartNotes;
};

// ── Meeting Minutes ───────────────────────────────────────────────────────────
exports.generateMeetingMinutes = async (meetingId: string) => {
  const cacheKey = `ai:minutes:${meetingId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const [meeting, transcript] = await Promise.all([
    Meeting.findById(meetingId).populate('participants', 'name'),
    resolveTranscript(meetingId),
  ]);

  if (!meeting) throw new Error('Meeting not found');
  if (!transcript) return '';

  const minutes = await generateMinutes({
    transcript,
    title:        meeting.title,
    participants: (meeting.participants || []).map((p: any) => p.name),
    date:         (meeting.startedAt || meeting.createdAt).toLocaleDateString(),
  });

  await AIResult.findOneAndUpdate({ meeting: meetingId }, { minutes }, { upsert: true });
  await cacheSet(cacheKey, minutes);
  return minutes;
};

// ── AI Assistant ──────────────────────────────────────────────────────────────
exports.assistantChat = async (meetingId: string, tenantId: string, userMessage: string, history: any[] = []) => {
  const aiResult = await AIResult.findOne({ meeting: meetingId });
  const tenantMeetings = tenantId
    ? await Meeting.find({ tenantId }).select('title').limit(20).lean()
    : [];

  const transcript = aiResult?.transcript ||
    (aiResult?.transcriptChunks || []).map((c: any) => `${c.speaker}: ${c.text}`).join('\n');

  return chat(userMessage, {
    transcript:    transcript || '',
    summary:       aiResult?.summary || '',
    history,
    meetingTitles: tenantMeetings.map((m: any) => m.title),
  });
};

// ── Generate Tasks ────────────────────────────────────────────────────────────
exports.generateTasksFromMeeting = async (meetingId: string, prompt = '') => {
  const transcript = await resolveTranscript(meetingId);
  return generateTasks(prompt || 'Extract all tasks from this meeting', transcript);
};

// ── Semantic Search ───────────────────────────────────────────────────────────
exports.searchMeetings = async (tenantId: string, query: string) => {
  const meetings = await Meeting.find({ tenantId })
    .select('title summary createdAt')
    .limit(50)
    .lean();

  const documents = meetings
    .filter((m: any) => m.summary || m.title)
    .map((m: any) => ({
      id:      m._id.toString(),
      title:   m.title,
      content: m.summary || m.title,
      date:    m.createdAt,
    }));

  if (!documents.length) return [];

  const results = await semanticSearch(query, documents);
  return results.map((r: any) => ({ id: r.id, title: r.title, date: r.date, score: r.score }));
};

// ── Follow-Up Suggestions ────────────────────────────────────────────────────
exports.getFollowUpSuggestions = async (meetingId: string) => {
  const cacheKey = `ai:followup:${meetingId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const result = await AIResult.findOne({ meeting: meetingId });
  if (result?.followUpSuggestions?.length) {
    await cacheSet(cacheKey, result.followUpSuggestions);
    return result.followUpSuggestions;
  }

  const transcript = await resolveTranscript(meetingId);
  if (!transcript) return [];

  const followUpSuggestions = await extractFollowUpSuggestions(transcript);
  await AIResult.findOneAndUpdate({ meeting: meetingId }, { followUpSuggestions }, { upsert: true });
  await cacheSet(cacheKey, followUpSuggestions);
  return followUpSuggestions;
};

// ── Full Pipeline (atomic post-meeting) ───────────────────────────────────────
exports.runFullPipeline = async (meetingId: string) => {
  const [meeting, transcript] = await Promise.all([
    Meeting.findById(meetingId).populate('participants', 'name _id'),
    resolveTranscript(meetingId),
  ]);

  if (!meeting) throw new Error('Meeting not found');
  if (!transcript) throw new Error('No transcript available');

  await AIResult.findOneAndUpdate(
    { meeting: meetingId },
    { processingStatus: 'processing', participants: (meeting.participants || []).map((p: any) => p._id) },
    { upsert: true }
  );

  try {
    const [summary, actionItems, decisions, keywords, followUpSuggestions, minutes, smartNotes] = await Promise.all([
      summarize(transcript, 'medium'),
      extractActionItems(transcript),
      extractDecisions(transcript),
      extractKeywords(transcript),
      extractFollowUpSuggestions(transcript),
      generateMinutes({
        transcript,
        title:        meeting.title,
        participants: (meeting.participants || []).map((p: any) => p.name),
        date:         (meeting.startedAt || meeting.createdAt).toLocaleDateString(),
      }),
      generateSmartNotes({
        transcript,
        title: meeting.title,
        agenda: (meeting.agenda || []).map((a: any) => a.title).filter(Boolean),
      }),
    ]);

    await AIResult.findOneAndUpdate(
      { meeting: meetingId },
      {
        summary, summaryLength: 'medium', actionItems, decisions,
        keywords, followUpSuggestions, minutes, smartNotes,
        processingStatus: 'completed',
        $inc: { version: 1 },
      },
      { upsert: true }
    );
    await Meeting.findByIdAndUpdate(meetingId, { summary });

    // Bust all caches
    await cacheDel(
      `ai:summary:${meetingId}:medium`,
      `ai:keywords:${meetingId}`,
      `ai:smartnotes:${meetingId}`,
      `ai:minutes:${meetingId}`,
      `ai:followup:${meetingId}`,
    );

    // Notify participants: summary ready
    const participantIds = [
      ...new Set([
        String(meeting.host),
        ...(meeting.participants || []).map((p: any) => String(p._id || p)),
      ]),
    ];
    notifService.notifyAISummaryReady(meeting, participantIds).catch(() => {});

    // Notify action item assignees
    for (const item of actionItems) {
      if (item.assignee) {
        notifService.notifyActionItemAssigned(meeting, item, item.assignee, null).catch(() => {});
      }
    }

    return { summary, actionItems, decisions, keywords, followUpSuggestions, minutes, smartNotes };
  } catch (err: any) {
    await AIResult.findOneAndUpdate(
      { meeting: meetingId },
      { processingStatus: 'failed', processingError: err.message }
    );
    throw err;
  }
};

// ── History ───────────────────────────────────────────────────────────────────
exports.getMeetingHistory = async (tenantId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [meetings, total] = await Promise.all([
    Meeting.find({ tenantId, status: 'ended' })
      .select('title createdAt endedAt duration participants summary')
      .populate('participants', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Meeting.countDocuments({ tenantId, status: 'ended' }),
  ]);
  return { meetings, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export {};
