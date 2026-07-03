import api from './axios';

const getDashboard = () => api.get('/analytics/dashboard');

export const analyticsService = {
  getDashboard,
  getAnalytics: () => getDashboard(),
};
