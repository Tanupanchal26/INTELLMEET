import logger from '../shared/utils/logger';

let _queue: any = null;
let _worker: any = null;
let _bullmqAvailable = false;

const REDIS_URL = process.env.REDIS_URL || '';

export const initAIQueue = async (): Promise<void> => {
  if (!REDIS_URL) {
    logger.info('[AI Queue] No REDIS_URL — running in synchronous fallback mode');
    return;
  }
  try {
    const { Queue } = await import('bullmq');
    const connection = { url: REDIS_URL };
    _queue = new Queue('ai-jobs', {
      connection,
      defaultJobOptions: {
        attempts:    3,
        backoff:     { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 50 },
      },
    });
    _bullmqAvailable = true;
    logger.info('[AI Queue] BullMQ queue initialised');
  } catch (err: any) {
    logger.warn(`[AI Queue] BullMQ init failed — falling back to sync mode: ${err.message}`);
  }
};

export const initAIWorker = async (): Promise<void> => {
  if (!_bullmqAvailable || !REDIS_URL) return;
  try {
    const { Worker } = await import('bullmq');
    const processor  = require('./ai.worker');
    _worker = new Worker('ai-jobs', processor, {
      connection: { url: REDIS_URL },
      concurrency: 3,
    });
    _worker.on('completed', (job: any) => logger.info(`[AI Worker] Job ${job.id} (${job.name}) completed`));
    _worker.on('failed',    (job: any, err: any) => logger.error(`[AI Worker] Job ${job?.id} failed: ${err.message}`));
    logger.info('[AI Queue] BullMQ worker started');
  } catch (err: any) {
    logger.warn(`[AI Worker] Worker init failed: ${err.message}`);
  }
};

export const enqueueAIJob = async (
  name: 'summarize' | 'minutes' | 'actionItems' | 'tasks' | 'fullPipeline',
  data: Record<string, any>,
): Promise<{ id: string } | null> => {
  if (!_bullmqAvailable || !_queue) return null;
  try {
    const job = await _queue.add(name, data);
    return { id: job.id };
  } catch (err: any) {
    logger.warn(`[AI Queue] Failed to enqueue job "${name}": ${err.message}`);
    return null;
  }
};

export const getAIQueue = (): any => _queue;
