import { Prisma, PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';
export const prisma = new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
});
/** Decimal | number | null -> number | null */
export const num = (v) => v === null || v === undefined ? null : Number(v);
/** Decimal | number -> number (for non-null columns) */
export const n = (v) => Number(v);
export const dateOnly = (d) => d ? d.toISOString().slice(0, 10) : null;
//# sourceMappingURL=prisma.js.map