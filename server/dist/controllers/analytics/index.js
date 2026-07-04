"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { getDashboardMetrics, getAnalytics } = require('../../services/analytics.service');
const asyncHandler = require('../../utils/asyncHandler').default;
const ApiResponse = require('../../utils/ApiResponse').default;
exports.getDashboard = asyncHandler(async (req, res) => {
    const data = await getDashboardMetrics(String(req.tenantId ?? ''), String(req.user?._id ?? ''));
    ApiResponse.ok(res, data, 'Dashboard metrics retrieved');
});
exports.getAnalyticsData = asyncHandler(async (req, res) => {
    const data = await getAnalytics(String(req.tenantId ?? ''), String(req.user?._id ?? ''));
    ApiResponse.ok(res, data, 'Analytics retrieved');
});
