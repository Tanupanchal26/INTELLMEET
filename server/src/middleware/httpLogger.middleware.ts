import morgan, { StreamOptions } from 'morgan';
import { Request } from 'express';
import logger from '../shared/utils/logger';

const stream: StreamOptions = {
  write: (message: string) => logger.http(message.trim()),
};

morgan.token('request-id', (_req: Request, res: any) => (res.locals?.requestId as string) ?? '-');
morgan.token('tenant-id', (req: Request) => (req.user as { tenantId?: string } | undefined)?.tenantId ?? '-');

const DEV_FORMAT = ':method :url :status :res[content-length] - :response-time ms [:request-id]';

const PROD_FORMAT = JSON.stringify({
  requestId:     ':request-id',
  tenantId:      ':tenant-id',
  method:        ':method',
  url:           ':url',
  status:        ':status',
  responseTime:  ':response-time ms',
  contentLength: ':res[content-length]',
  userAgent:     ':user-agent',
  ip:            ':remote-addr',
});

const isDev = process.env.NODE_ENV !== 'production';

const httpLogger = morgan(isDev ? DEV_FORMAT : PROD_FORMAT, {
  stream,
  skip: (req: Request) => req.path === '/health',
});

export default httpLogger;
module.exports = httpLogger;
module.exports.default = httpLogger;
