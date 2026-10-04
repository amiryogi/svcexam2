import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import type { Db } from './prisma.js';

export interface Ctx {
  userId: number | null;
  ip: string | null;
}

export const ctxOf = (req: Request): Ctx => ({ userId: req.auth?.user.id ?? null, ip: req.ip ?? null });

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

const json = (v: unknown) =>
  v === undefined || v === null
    ? Prisma.DbNull
    : (JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? String(val) : val))) as Prisma.InputJsonValue);

export async function recordAudit(db: Db, ctx: Ctx, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: ctx.userId,
      ip: ctx.ip,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
      before: json(entry.before),
      after: json(entry.after),
    },
  });
}
