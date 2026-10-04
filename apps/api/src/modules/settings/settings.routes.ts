import express, { Router } from 'express';
import { settingsSchema } from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { notFound, parse } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getSettingsRow, readLogo, saveLogo, toSchoolInfo } from './settings.service.js';

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

settingsRouter.post(
  '/logo',
  express.raw({ type: ['image/png', 'image/jpeg'], limit: '1mb' }),
  async (req, res) => {
    await getSettingsRow();
    const file = await saveLogo(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    await recordAudit(prisma, ctxOf(req), { action: 'UPDATE_LOGO', entity: 'settings', entityId: 1, after: { file } });
    res.status(204).end();
  },
);

settingsRouter.get('/logo', async (_req, res) => {
  const logo = await readLogo();
  if (!logo) throw notFound('Logo');
  res.setHeader('Content-Type', logo.mime);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(logo.data);
});
