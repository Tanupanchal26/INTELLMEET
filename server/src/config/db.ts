import mongoose, { type ConnectOptions } from 'mongoose';
import config from './env';
import logger from '../shared/utils/logger';

const MONGO_OPTIONS: ConnectOptions = {
  serverSelectionTimeoutMS: 5_000,
  heartbeatFrequencyMS:     10_000,
  maxPoolSize:              config.isProd ? 20 : 5,
  minPoolSize:              2,
  socketTimeoutMS:          45_000,
  family:                   4,
  autoIndex:                config.isProd ? false : true,
};

const connectWithRetry = async (retries = 5, baseDelayMs = 3_000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(config.mongo.uri, MONGO_OPTIONS);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[DB] Connection attempt ${attempt}/${retries} failed: ${message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
    }
  }
};

export const connectDB = async (): Promise<void> => {
  mongoose.connection.on('connected',    () => logger.info('[DB] MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('[DB] MongoDB disconnected'));
  mongoose.connection.on('error',        (e: Error) => logger.error(`[DB] Error: ${e.message}`));

  if (!config.isProd) {
    mongoose.set('debug', (collection: string, method: string) => {
      // Skip noisy index sync logs
      if (method === 'createIndex') return;
      logger.debug(`[DB] ${collection}.${method}`);
    });
  }

  try {
    await connectWithRetry();
    logger.info(`[DB] Connected to: ${mongoose.connection.host}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[DB] Failed to connect after retries — exiting. ${message}`);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('[DB] MongoDB connection closed');
};
