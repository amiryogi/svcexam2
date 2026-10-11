import * as argon2 from '@node-rs/argon2';
import { env } from '../../config/env.js';
import { recordAudit, type Ctx } from '../../lib/audit.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { AppError, unauthorized } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { toAuthUser } from '../../middleware/auth.js';

// OWASP recommended argon2id parameters (argon2id is the library default). @node-rs/argon2 is used
// because its Linux build needs only glibc 2.14, so it runs on older shared hosting (CloudLinux 8).
const HASH_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const ARGON2ID = 2; // Algorithm.Argon2id (an ambient const enum, unusable with isolatedModules)

export const hashPassword = (password: string) => argon2.hash(password, HASH_OPTIONS);

/** True when a stored hash was made with other parameters than HASH_OPTIONS. */
function needsRehash(hash: string): boolean {
  try {
    const p = argon2.parseOptions(hash);
    return (
      p.algorithm !== ARGON2ID ||
      p.memoryCost !== HASH_OPTIONS.memoryCost ||
      p.timeCost !== HASH_OPTIONS.timeCost ||
      p.parallelism !== HASH_OPTIONS.parallelism
    );
  } catch {
    return true;
  }
}

let dummyHash: Promise<string> | null = null;
/** Verifies against a throwaway hash so unknown usernames take as long as wrong passwords. */
async function burnTime(password: string) {
  dummyHash ??= hashPassword(randomToken());
  await argon2.verify(await dummyHash, password).catch(() => false);
}

const INVALID = 'Invalid username or password';

export async function login(
  username: string,
  password: string,
  meta: Ctx & { userAgent: string | null },
) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    await burnTime(password);
    throw unauthorized(INVALID);
  }
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
    throw new AppError(423, 'LOCKED', `Too many failed attempts. Try again in ${minutes} minute(s).`);
  }

  const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= env.LOGIN_MAX_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60_000) : null,
      },
    });
    await recordAudit(prisma, { userId: user.id, ip: meta.ip }, {
      action: lock ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
      entity: 'user',
      entityId: user.id,
    });
    throw unauthorized(INVALID);
  }

  const passwordHash = needsRehash(user.passwordHash) ? await hashPassword(password) : undefined;

  const token = randomToken(32);
  const csrfToken = randomToken(32);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, ...(passwordHash && { passwordHash }) },
    });
    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        csrfToken,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        expiresAt: new Date(now.getTime() + env.SESSION_ABSOLUTE_HOURS * 3_600_000),
      },
    });
    await recordAudit(tx, { userId: user.id, ip: meta.ip }, { action: 'LOGIN', entity: 'user', entityId: user.id });
  });
  return { token, csrfToken, user: toAuthUser(user) };
}

export async function logout(sessionId: number, ctx: Ctx) {
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await recordAudit(prisma, ctx, { action: 'LOGOUT', entity: 'user', entityId: ctx.userId });
}

export async function changePassword(
  ctx: Ctx & { userId: number },
  sessionId: number,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  if (!(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect', {
      fields: [{ path: 'currentPassword', message: 'Current password is incorrect' }],
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
    // Sign out every other device.
    await tx.session.updateMany({
      where: { userId: user.id, id: { not: sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await recordAudit(tx, ctx, { action: 'PASSWORD_CHANGED', entity: 'user', entityId: user.id });
  });
}

/** Removes sessions that expired or were revoked more than a day ago. */
export async function purgeSessions() {
  const cutoff = new Date(Date.now() - 86_400_000);
  await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
}
