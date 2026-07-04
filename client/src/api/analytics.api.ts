import api from './axios';

export const analyticsService = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getAnalytics: () => api.get('/analytics'),
};
