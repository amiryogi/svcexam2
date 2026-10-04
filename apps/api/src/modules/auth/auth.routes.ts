import { Router, type CookieOptions } from 'express';
import { changePasswordSchema, loginSchema, type LoginResponse } from '@svi/shared';
import { env, SESSION_COOKIE } from '../../config/env.js';
import { ctxOf } from '../../lib/audit.js';
import { parse } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter, loginLimiter } from '../../middleware/rateLimit.js';
import * as auth from './auth.service.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict',
  path: '/',
};

export const authRouter = Router();
authRouter.use(authLimiter);

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = parse(loginSchema, req.body);
  const result = await auth.login(username, password, {
    ...ctxOf(req),
    userAgent: req.get('user-agent') ?? null,
  });
  res.cookie(SESSION_COOKIE, result.token, {
    ...cookieOptions,
    maxAge: env.SESSION_ABSOLUTE_HOURS * 3_600_000,
  });
  const body: LoginResponse = { user: result.user, csrfToken: result.csrfToken };
  res.json(body);
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await auth.logout(req.auth!.session.id, ctxOf(req));
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  const body: LoginResponse = { user: req.auth!.user, csrfToken: req.auth!.session.csrfToken };
  res.json(body);
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const input = parse(changePasswordSchema, req.body);
  await auth.changePassword(
    { ...ctxOf(req), userId: req.auth!.user.id },
    req.auth!.session.id,
    input.currentPassword,
    input.newPassword,
  );
  res.status(204).end();
});
