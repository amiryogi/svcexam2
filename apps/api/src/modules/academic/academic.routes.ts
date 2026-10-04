import { Router } from 'express';
import { academicYearSchema, idParams, streamSchema } from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { parse } from '../../lib/errors.js';
import { dateOnly, prisma } from '../../lib/prisma.js';

const toYear = (y: { id: number; name: string; startDateAd: Date | null; endDateAd: Date | null; isCurrent: boolean }) => ({
  id: y.id,
  name: y.name,
  startDateAd: dateOnly(y.startDateAd),
  endDateAd: dateOnly(y.endDateAd),
  isCurrent: y.isCurrent,
});

const yearData = (input: ReturnType<typeof academicYearSchema.parse>) => ({
  name: input.name,
  startDateAd: input.startDateAd ? new Date(input.startDateAd) : null,
  endDateAd: input.endDateAd ? new Date(input.endDateAd) : null,
});

// ───────── Academic years ─────────
export const academicYearsRouter = Router();

academicYearsRouter.get('/', async (_req, res) => {
  const years = await prisma.academicYear.findMany({ orderBy: { name: 'desc' } });
  res.json(years.map(toYear));
});

academicYearsRouter.post('/', async (req, res) => {
  const input = parse(academicYearSchema, req.body);
  const year = await prisma.$transaction(async (tx) => {
    const isFirst = (await tx.academicYear.count()) === 0;
    const created = await tx.academicYear.create({ data: { ...yearData(input), isCurrent: isFirst } });
    await recordAudit(tx, ctxOf(req), { action: 'CREATE', entity: 'academic_year', entityId: created.id, after: created });
    return created;
  });
  res.status(201).json(toYear(year));
});

academicYearsRouter.put('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(academicYearSchema, req.body);
  const year = await prisma.$transaction(async (tx) => {
    const before = await tx.academicYear.findUniqueOrThrow({ where: { id } });
    const updated = await tx.academicYear.update({ where: { id }, data: yearData(input) });
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'academic_year', entityId: id, before, after: updated });
    return updated;
  });
  res.json(toYear(year));
});

academicYearsRouter.post('/:id/set-current', async (req, res) => {
  const { id } = parse(idParams, req.params);
  await prisma.$transaction(async (tx) => {
    await tx.academicYear.findUniqueOrThrow({ where: { id } });
    await tx.academicYear.updateMany({ data: { isCurrent: false } });
    await tx.academicYear.update({ where: { id }, data: { isCurrent: true } });
    await recordAudit(tx, ctxOf(req), { action: 'SET_CURRENT', entity: 'academic_year', entityId: id });
  });
  res.status(204).end();
});

academicYearsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  await prisma.$transaction(async (tx) => {
    const before = await tx.academicYear.delete({ where: { id } }); // FK restrict blocks years in use
    await recordAudit(tx, ctxOf(req), { action: 'DELETE', entity: 'academic_year', entityId: id, before });
  });
  res.status(204).end();
});

// ───────── Streams ─────────
export const streamsRouter = Router();

streamsRouter.get('/', async (_req, res) => {
  res.json(await prisma.stream.findMany({ orderBy: { name: 'asc' } }));
});

streamsRouter.post('/', async (req, res) => {
  const input = parse(streamSchema, req.body);
  const stream = await prisma.$transaction(async (tx) => {
    const created = await tx.stream.create({ data: input });
    await recordAudit(tx, ctxOf(req), { action: 'CREATE', entity: 'stream', entityId: created.id, after: created });
    return created;
  });
  res.status(201).json(stream);
});

streamsRouter.put('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(streamSchema, req.body);
  const stream = await prisma.$transaction(async (tx) => {
    const before = await tx.stream.findUniqueOrThrow({ where: { id } });
    const updated = await tx.stream.update({ where: { id }, data: input });
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'stream', entityId: id, before, after: updated });
    return updated;
  });
  res.json(stream);
});
