import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { safeEqual } from '../lib/crypto.js';
import { forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Rejects state-changing requests whose Origin / Referer is not the web app. */
export const originCheck: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin) return origin === env.APP_ORIGIN ? next() : next(forbidden('Cross-site request blocked'));
  const referer = req.get('referer');
  if (referer && !referer.startsWith(`${env.APP_ORIGIN}/`)) {
    return next(forbidden('Cross-site request blocked'));
  }
  next();
};

/**
 * Synchronizer-token CSRF protection: every authenticated state-changing request must send
 * the session's CSRF token in X-CSRF-Token (the SPA receives it from /auth/login and /auth/me).
 */
export const csrfProtect: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || !req.auth) return next();
  const header = req.get('x-csrf-token');
  if (!header || !safeEqual(header, req.auth.session.csrfToken)) {
    return next(forbidden('Invalid or missing CSRF token. Reload the page and try again.'));
  }
  next();
};
