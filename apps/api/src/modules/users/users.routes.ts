import { Router } from 'express';
import { idParams, passwordSchema, userCreateSchema, userUpdateSchema } from '@svi/shared';
import { z } from 'zod';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { badRequest, parse } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireRole, toAuthUser } from '../../middleware/auth.js';
import { hashPassword } from '../auth/auth.service.js';

export const usersRouter = Router();
usersRouter.use(requireRole('SUPER_ADMIN'));

const publicUser = (u: Parameters<typeof toAuthUser>[0]) => ({
  ...toAuthUser(u),
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt,
  lockedUntil: u.lockedUntil,
  createdAt: u.createdAt,
});

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { username: 'asc' } });
  res.json(users.map(publicUser));
});

usersRouter.post('/', async (req, res) => {
  const input = parse(userCreateSchema, req.body);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        email: input.email ?? null,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      },
    });
    await recordAudit(tx, ctxOf(req), { action: 'CREATE', entity: 'user', entityId: created.id, after: publicUser(created) });
    return created;
  });
  res.status(201).json(publicUser(user));
});

usersRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(userUpdateSchema, req.body);
  if (id === req.auth!.user.id && (input.isActive === false || (input.role && input.role !== 'SUPER_ADMIN'))) {
    throw badRequest('You cannot deactivate or demote your own account');
  }
  const user = await prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id } });
    const updated = await tx.user.update({ where: { id }, data: input });
    if (input.isActive === false) {
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'user', entityId: id, before: publicUser(before), after: publicUser(updated) });
    return updated;
  });
  res.json(publicUser(user));
});

usersRouter.post('/:id/reset-password', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { password } = parse(z.object({ password: passwordSchema }), req.body);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await recordAudit(tx, ctxOf(req), { action: 'PASSWORD_RESET', entity: 'user', entityId: id });
  });
  res.status(204).end();
});
