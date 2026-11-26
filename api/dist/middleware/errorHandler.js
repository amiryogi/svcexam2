import { Prisma } from '@prisma/client';
import { isProd } from '../config/env.js';
import { AppError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
export const notFoundHandler = (_req, _res, next) => next(notFound('Endpoint'));
function translate(err) {
    if (err instanceof AppError)
        return err;
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': {
                const target = err.meta?.target ?? '';
                return new AppError(409, 'DUPLICATE', 'A record with the same value already exists', {
                    fields: [].concat(target),
                });
            }
            case 'P2003':
            case 'P2014':
                return new AppError(409, 'IN_USE', 'This record is linked to other records and cannot be changed or removed');
            case 'P2025':
                return notFound();
        }
    }
    const e = err;
    if (e?.type === 'entity.parse.failed')
        return new AppError(400, 'BAD_JSON', 'Malformed JSON body');
    if (e?.type === 'entity.too.large')
        return new AppError(413, 'TOO_LARGE', 'Request body is too large');
    return null;
}
export const errorHandler = (err, req, res, _next) => {
    const appErr = translate(err);
    if (appErr) {
        if (appErr.status >= 500)
            logger.error({ err, reqId: req.id }, appErr.message);
        const body = { error: { code: appErr.code, message: appErr.message, details: appErr.details } };
        res.status(appErr.status).json(body);
        return;
    }
    logger.error({ err, reqId: req.id }, 'Unhandled error');
    const body = {
        error: {
            code: 'INTERNAL',
            message: 'Something went wrong. Please try again.',
            details: isProd ? undefined : String(err?.stack ?? err),
        },
    };
    res.status(500).json(body);
};
//# sourceMappingURL=errorHandler.js.map