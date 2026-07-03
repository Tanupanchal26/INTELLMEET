// @ts-nocheck
const aiService = require('../services/ai.service');
const logger    = require('../shared/utils/logger').default;

/**
 * BullMQ worker processor for AI jobs.
 * Job names: 'summarize' | 'minutes' | 'actionItems' | 'tasks'
 * Each job emits results back over Socket.IO via the notification pattern.
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

    default:
      logger.warn(`[AI Worker] Unknown job type: ${job.name}`);
      return null;
  }
};

export {};
