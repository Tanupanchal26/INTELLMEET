// src/controllers/health.controller.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';

export const getHealth = async (req: Request, res: Response) => {
  const mongo = mongoose.connection.readyState === 1;
  const status = mongo ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: res.locals.requestId,
    dependencies: { mongo },
  });
};
