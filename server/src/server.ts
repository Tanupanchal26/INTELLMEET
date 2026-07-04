const config = require('./config/env');

const http   = require('http');
const { Server } = require('socket.io');
const app    = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const initSockets = require('./sockets');
const logger = require('./shared/utils/logger').default;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin:      config.isDev ? true : config.cors.allowedOrigins,
    credentials: true,
  },
  // Prefer WebSocket — skip polling upgrade round-trip for lower latency
  transports: ['websocket', 'polling'],
  // Signaling payloads are small; 1 MB is generous but safe
  maxHttpBufferSize: 1e6,
  pingTimeout:  60_000,
  pingInterval: 25_000,
  // Allow client to recover missed events after a brief disconnect (e.g. mobile network switch)
  connectionStateRecovery: {
    maxDisconnectionDuration: 30_000,
    skipMiddlewares: false,
  },
});

// ── Meeting reminder scheduler (runs every minute) ──────────────────────────
const startReminderScheduler = () => {
  const notifService = require('./services/notification.service');
  const Meeting = require('./models/Meeting');
  setInterval(async () => {
    try {
      const now = new Date();
      const in15 = new Date(now.getTime() + 15 * 60 * 1000);
      const in16 = new Date(now.getTime() + 16 * 60 * 1000);
      const meetings = await Meeting.find({
        status: 'scheduled',
        scheduledAt: { $gte: in15, $lt: in16 },
        reminderSent: { $ne: true },
      }).select('_id title tenantId meetingId participants host scheduledAt');
      for (const m of meetings) {
        const ids = [...new Set([String(m.host), ...(m.participants || []).map(String)])];
        notifService.notifyMeetingReminder(m, ids).catch(() => {});
        await Meeting.findByIdAndUpdate(m._id, { reminderSent: true });
      }
    } catch { /* non-critical */ }
  }, 60_000);
};

const start = async () => {
  try {
    await connectDB();
    app.set('io', io);
    initSockets(io);
    // Inject io into notification service for real-time push
    const notifService = require('./services/notification.service');
    notifService.init(io);
    startReminderScheduler();

    server.listen(config.port, '0.0.0.0', () => {
      logger.info(`[SERVER] IntellMeet API running on port ${config.port} [${config.env}]`);
    });
  } catch (err) {
    logger.error(`[SERVER] Startup failed: ${(err as Error).message}`);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  logger.info(`[SERVER] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await disconnectDB();
      logger.info('[SERVER] Clean shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error(`[SERVER] Error during shutdown: ${(err as Error).message}`);
      process.exit(1);
    }
  });
  setTimeout(() => { process.exit(1); }, 15_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error(`[SERVER] Unhandled rejection: ${reason}`);
});

start();

export {};
