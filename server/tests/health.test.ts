// Set test env BEFORE requiring app so env validator passes
process.env.NODE_ENV         = 'test';
process.env.MONGO_URI        = 'mongodb://localhost:27017/intellmeet_test';
process.env.JWT_SECRET       = 'test-secret-minimum-32-characters-ok';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars';

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      ...actual.connection,
      readyState: 1,
    },
  };
});

const request = require('supertest');
const app     = require('../src/app');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('requestId');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

export {};
