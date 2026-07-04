// @ts-nocheck
const aiService = require('../services/ai.service');
const logger    = require('../shared/utils/logger').default;

let _io: any = null;
exports.setIO = (io: any) => { _io = io; };

/**
 * BullMQ worker processor for AI jobs.
 * Job names: 'summarize' | 'minutes' | 'actionItems' | 'tasks' | 'fullPipeline'
 */
module.exports = async (job) => {
  const { meetingId, tenantId, prompt } = job.data;

  switch (job.name) {
    case 'summarize':
      return aiService.summarize(meetingId);

    case 'minutes':
      return aiService.generateMeetingMinutes(meetingId);

    case 'actionItems':
      return aiService.getActionItems(meetingId);

    case 'tasks':
      return aiService.generateTasksFromMeeting(meetingId, prompt);

    case 'fullPipeline': {
      const result = await aiService.runFullPipeline(meetingId);
      if (_io) {
        _io.to(`tenant:${tenantId}`).emit('ai:full-report-ready', { meetingId, ...result });
      }
      return result;
    }

    default:
      logger.warn(`[AI Worker] Unknown job type: ${job.name}`);
      return null;
  }
};

export {};
