import type { RequestHandler } from 'express';
import type { User } from '@prisma/client';
import type { AuthUser, Role } from '@svi/shared';
import { env, SESSION_COOKIE } from '../config/env.js';
import { sha256 } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  username: u.username,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
});

const TOUCH_INTERVAL_MS = 60_000;

/** Resolves the session cookie into req.auth. Never fails the request by itself. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return next();

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now || !session.user.isActive) {
    return next();
  }
  if (now - session.lastSeenAt.getTime() > env.SESSION_IDLE_MINUTES * 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return next();
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  req.auth = { user: toAuthUser(session.user), session: { id: session.id, csrfToken: session.csrfToken } };
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) =>
  req.auth ? next() : next(unauthorized());

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    return roles.includes(req.auth.user.role) ? next() : next(forbidden());
  };
