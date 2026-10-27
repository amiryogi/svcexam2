import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * Lets the web app call the API from its own origin (e.g. svc.example.com.np → api.example.com.np).
 * Only APP_ORIGIN is allowed, with credentials, so the session cookie is sent; both are on the same
 * site, so the SameSite=Strict cookie still applies. X-Request-Id is exposed because the web app
 * uses it to tell API errors from hosting-firewall blocks.
 */
export const corsForWebApp: RequestHandler = (req, res, next) => {
  const origin = req.get('origin');
  res.vary('Origin');
  const allowed = origin === env.APP_ORIGIN;
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');
  }
  // Preflight: answer here, before rate limiting and authentication.
  if (req.method === 'OPTIONS' && origin && req.get('access-control-request-method')) {
    if (!allowed) return void res.status(403).end();
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-CSRF-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    return void res.status(204).end();
  }
  next();
};
