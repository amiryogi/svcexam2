import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@svi/shared';
import { isProd } from '../config/env.js';
import { AppError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('Endpoint'));

function translate(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string | undefined) ?? '';
        return new AppError(409, 'DUPLICATE', 'A record with the same value already exists', {
          fields: [].concat(target as never),
        });
      }
      case 'P2003':
      case 'P2014':
        return new AppError(409, 'IN_USE', 'This record is linked to other records and cannot be changed or removed');
      case 'P2025':
        return notFound();
    }
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return new AppError(400, 'BAD_JSON', 'Malformed JSON body');
  if (e?.type === 'entity.too.large') return new AppError(413, 'TOO_LARGE', 'Request body is too large');
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = translate(err);
  if (appErr) {
    if (appErr.status >= 500) logger.error({ err, reqId: req.id }, appErr.message);
    const body: ApiErrorBody = { error: { code: appErr.code, message: appErr.message, details: appErr.details } };
    res.status(appErr.status).json(body);
    return;
  }
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  const body: ApiErrorBody = {
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again.',
      details: isProd ? undefined : String((err as Error)?.stack ?? err),
    },
  };
  res.status(500).json(body);
};
