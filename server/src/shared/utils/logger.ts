import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const LOGS_DIR = path.join(__dirname, '../../../logs');

const devFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp: ts, stack }) =>
    stack ? `[${ts}] ${level}: ${message}\n${stack}` : `[${ts}] ${level}: ${message}`
  )
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [new winston.transports.Console()];

if (isDev) {
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: LOGS_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'info',
    }),
    new winston.transports.DailyRotateFile({
      dirname: LOGS_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    })
  );
}

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: isDev ? devFormat : prodFormat,
  exitOnError: false,
  transports,
  exceptionHandlers: isDev
    ? [new winston.transports.File({ filename: path.join(LOGS_DIR, 'exceptions.log') })]
    : [new winston.transports.Console()],
  rejectionHandlers: isDev
    ? [new winston.transports.File({ filename: path.join(LOGS_DIR, 'rejections.log') })]
    : [new winston.transports.Console()],
});

export default logger;
