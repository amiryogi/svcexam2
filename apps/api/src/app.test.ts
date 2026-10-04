import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

// These tests exercise the security middleware without touching the database.
const app = createApp();
const ORIGIN = 'http://localhost:5173';

describe('security middleware', () => {
  it('rejects unauthenticated API calls', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects state-changing requests from another origin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ username: 'admin', password: 'x' });
    expect(res.status).toBe(403);
  });

  it('validates the login body before touching the database', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Origin', ORIGIN).send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"username":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 404 outside the API', async () => {
    expect((await request(app).get('/nope')).status).toBe(404);
  });
});
