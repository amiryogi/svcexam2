import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

const tooMany = new AppError(429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please wait and try again.');

/**
 * Failed logins per IP + username. Successful logins don't count.
 * Account lockout (stored in the database, so it works across API replicas) is the second layer.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.toLowerCase().slice(0, 50) : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${username}`;
  },
  handler: (_req, _res, next) => next(tooMany),
});

/** Coarse limit on all auth endpoints per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(tooMany),
});

/** General API limit per IP – generous, only stops runaway clients. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 1200,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(tooMany),
});
