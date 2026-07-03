import type { NextFunction, Request, Response } from 'express';

const { getDashboardMetrics, getAnalytics } = require('../../services/analytics.service') as {
  getDashboardMetrics: (tenantId: string | undefined, userId: string | undefined) => Promise<unknown>;
  getAnalytics: (tenantId: string | undefined, userId: string | undefined) => Promise<unknown>;
};
const asyncHandler = require('../../utils/asyncHandler').default as (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => void;
const ApiResponse = require('../../utils/ApiResponse').default;

exports.getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await getDashboardMetrics(String(req.tenantId ?? ''), String(req.user?._id ?? ''));
  ApiResponse.ok(res, data, 'Dashboard metrics retrieved');
});

exports.getAnalyticsData = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAnalytics(String(req.tenantId ?? ''), String(req.user?._id ?? ''));
  ApiResponse.ok(res, data, 'Analytics retrieved');
});

export {};
