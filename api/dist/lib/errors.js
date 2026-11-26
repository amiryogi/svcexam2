export class AppError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do this') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Record') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
/** Parse untrusted input; throws a 400 with field errors on failure. */
export function parse(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', {
            fields: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
    }
    return result.data;
}
//# sourceMappingURL=errors.js.map