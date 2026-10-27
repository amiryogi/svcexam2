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

  it('allows the web app origin with credentials and exposes X-Request-Id', async () => {
    const res = await request(app).get('/api/v1/students').set('Origin', ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toBe('X-Request-Id');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
  });

  it('answers preflights from the web app and refuses other origins', async () => {
    const ok = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type, x-csrf-token');
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-headers']).toContain('X-CSRF-Token');

    const evil = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.status).toBe(403);
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns 404 outside the API', async () => {
    expect((await request(app).get('/nope')).status).toBe(404);
  });
});
