import { Router } from 'express';
import { academicYearSchema, idParams, streamSchema } from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { conflict, parse } from '../../lib/errors.js';
import { dateOnly, prisma, type Db } from '../../lib/prisma.js';

const toYear = (y: { id: number; name: string; startDateAd: Date | null; endDateAd: Date | null; isCurrent: boolean }) => ({
  id: y.id,
  name: y.name,
  startDateAd: dateOnly(y.startDateAd),
  endDateAd: dateOnly(y.endDateAd),
  isCurrent: y.isCurrent,
});

const yearData = (input: { name: string; startDateAd?: string | null; endDateAd?: string | null }) => ({
  name: input.name,
  startDateAd: input.startDateAd ? new Date(input.startDateAd) : null,
  endDateAd: input.endDateAd ? new Date(input.endDateAd) : null,
});

// ───────── Academic years ─────────
export const academicYearsRouter = Router();

academicYearsRouter.get('/', async (_req, res) => {
  const [years, published] = await Promise.all([
    prisma.academicYear.findMany({
      orderBy: { name: 'desc' },
      include: { _count: { select: { enrollments: true, exams: true } } },
    }),
    prisma.exam.groupBy({ by: ['academicYearId'], where: { status: { in: ['PUBLISHED', 'LOCKED'] } }, _count: { _all: true } }),
  ]);
  const publishedBy = new Map(published.map((p) => [p.academicYearId, p._count._all]));
  res.json(
    years.map((y) => ({
      ...toYear(y),
      enrollmentCount: y._count.enrollments,
      examCount: y._count.exams,
      publishedExamCount: publishedBy.get(y.id) ?? 0,
    })),
  );
});

/** Clear message for the unique name constraint instead of the generic "same value" error. */
async function assertNameFree(db: Db, name: string, exceptId?: number) {
  const clash = await db.academicYear.findUnique({ where: { name } });
  if (clash && clash.id !== exceptId) throw conflict(`Academic year ${name} already exists`);
}

academicYearsRouter.post('/', async (req, res) => {
  const input = parse(academicYearSchema, req.body);
  const year = await prisma.$transaction(async (tx) => {
    await assertNameFree(tx, input.name);
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
    if (input.name !== before.name) {
      await assertNameFree(tx, input.name, id);
      // Published grade sheets print the exam's year, which follows the academic year unless the exam
      // has its own "conducted in" year. Renaming would change what those official sheets print.
      const affected = await tx.exam.findMany({
        where: { academicYearId: id, status: { in: ['PUBLISHED', 'LOCKED'] }, examYearBs: null },
        select: { name: true, grade: true },
      });
      if (affected.length && !input.confirmRename) {
        throw conflict(
          `Renaming ${before.name} to ${input.name} changes the year printed on the published grade sheets of: ` +
            affected.map((e) => `${e.name} (Grade ${e.grade})`).join(', '),
          { needsConfirmation: true, exams: affected },
        );
      }
    }
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
    const year = await tx.academicYear.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { enrollments: true, exams: true } } },
    });
    if (year.isCurrent) throw conflict(`${year.name} is the current academic year. Make another year current before deleting it.`);
    if (year._count.enrollments || year._count.exams) {
      throw conflict(
        `${year.name} still has ${year._count.enrollments} enrollment(s) and ${year._count.exams} exam(s); only an unused year can be deleted.`,
      );
    }
    const before = await tx.academicYear.delete({ where: { id } });
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
