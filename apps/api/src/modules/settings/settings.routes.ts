import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { settingsSchema } from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { notFound, parse } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getSettingsRow, readLogo, removeLogo, saveLogo, toSchoolInfo, type LogoKind } from './settings.service.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res) => {
  res.json(toSchoolInfo(await getSettingsRow()));
});

settingsRouter.put('/', async (req, res) => {
  const input = parse(settingsSchema, req.body);
  const before = await getSettingsRow();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.schoolSetting.update({ where: { id: 1 }, data: input });
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'settings', entityId: 1, before, after: row });
    return row;
  });
  res.json(toSchoolInfo(updated));
});

/** ?kind=print (default): black & white grade sheet logo · ?kind=web: colour website logo. */
const logoKind = (req: Request): LogoKind => parse(z.object({ kind: z.enum(['print', 'web']).default('print') }), req.query).kind;

settingsRouter.post(
  '/logo',
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '2mb' }),
  async (req, res) => {
    const kind = logoKind(req);
    await getSettingsRow();
    const file = await saveLogo(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), kind);
    await recordAudit(prisma, ctxOf(req), { action: 'UPDATE_LOGO', entity: 'settings', entityId: 1, after: { kind, file } });
    res.status(204).end();
  },
);

settingsRouter.delete('/logo', async (req, res) => {
  const kind = logoKind(req);
  await getSettingsRow();
  await removeLogo(kind);
  await recordAudit(prisma, ctxOf(req), { action: 'REMOVE_LOGO', entity: 'settings', entityId: 1, after: { kind } });
  res.status(204).end();
});

settingsRouter.get('/logo', async (req, res) => {
  const logo = await readLogo(logoKind(req));
  if (!logo) throw notFound('Logo');
  res.setHeader('Content-Type', logo.mime);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(logo.data);
});
