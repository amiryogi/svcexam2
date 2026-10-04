import { Prisma, PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isProd ? ['error'] : ['warn', 'error'],
});

export type Db = PrismaClient | Prisma.TransactionClient;

/** Decimal | number | null -> number | null */
export const num = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Decimal | number -> number (for non-null columns) */
export const n = (v: Prisma.Decimal | number): number => Number(v);

export const dateOnly = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;
