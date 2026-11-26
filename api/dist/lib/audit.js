import { Prisma } from '@prisma/client';
export const ctxOf = (req) => ({ userId: req.auth?.user.id ?? null, ip: req.ip ?? null });
const json = (v) => v === undefined || v === null
    ? Prisma.DbNull
    : JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? String(val) : val)));
export async function recordAudit(db, ctx, entry) {
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
//# sourceMappingURL=audit.js.map