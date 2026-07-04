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

const start = async () => {
  try {
    await connectDB();
    app.set('io', io);
    initSockets(io);

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
