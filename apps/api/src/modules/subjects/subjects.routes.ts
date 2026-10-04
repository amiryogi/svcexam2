import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  copyGradeSchema,
  curriculumQuery,
  curriculumSchema,
  gradeLevelSchema,
  gradeScaleSchema,
  idParams,
  subjectSchema,
} from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { badRequest, parse } from '../../lib/errors.js';
import { n, prisma } from '../../lib/prisma.js';
import { applyGradeSetup, buildGradeSetupPlan } from './gradeSetup.service.js';
import { loadCurriculum, subjectInclude, toSubjectDto } from './subjects.service.js';

// ───────── Subjects ─────────
export const subjectsRouter = Router();

subjectsRouter.get('/', async (req, res) => {
  const { grade, active } = parse(
    z.object({ grade: gradeLevelSchema.optional(), active: z.enum(['true', 'false']).optional() }),
    req.query,
  );
  const subjects = await prisma.subject.findMany({
    where: { grade, ...(active && { isActive: active === 'true' }) },
    include: subjectInclude,
    orderBy: [{ grade: 'asc' }, { category: 'asc' }, { name: 'asc' }],
  });
  res.json(subjects.map(toSubjectDto));
});

subjectsRouter.post('/', async (req, res) => {
  const { components, ...input } = parse(subjectSchema, req.body);
  const subject = await prisma.$transaction(async (tx) => {
    const created = await tx.subject.create({
      data: { ...input, components: { create: components.map(({ id: _id, ...c }) => c) } },
      include: subjectInclude,
    });
    await recordAudit(tx, ctxOf(req), { action: 'CREATE', entity: 'subject', entityId: created.id, after: toSubjectDto(created) });
    return created;
  });
  res.status(201).json(toSubjectDto(subject));
});

subjectsRouter.put('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { components, ...input } = parse(subjectSchema, req.body);
  const subject = await prisma.$transaction(async (tx) => {
    const before = await tx.subject.findUniqueOrThrow({ where: { id }, include: subjectInclude });
    if (before.grade !== input.grade) {
      const used = await tx.enrollmentSubject.count({ where: { subjectId: id } });
      if (used) throw badRequest('Grade cannot change for a subject that students are enrolled in');
    }
    await tx.subject.update({ where: { id }, data: input });

    const keepIds = components.flatMap((c) => (c.id ? [c.id] : []));
    // Removing a component that has marks fails on the FK (reported as 409 IN_USE).
    await tx.subjectComponent.deleteMany({ where: { subjectId: id, id: { notIn: keepIds } } });
    for (const { id: componentId, ...c } of components) {
      if (componentId) {
        await tx.subjectComponent.update({ where: { id: componentId, subjectId: id }, data: c });
      } else {
        await tx.subjectComponent.create({ data: { ...c, subjectId: id } });
      }
    }
    const after = await tx.subject.findUniqueOrThrow({ where: { id }, include: subjectInclude });
    await recordAudit(tx, ctxOf(req), {
      action: 'UPDATE',
      entity: 'subject',
      entityId: id,
      before: toSubjectDto(before),
      after: toSubjectDto(after),
    });
    return after;
  });
  res.json(toSubjectDto(subject));
});

/** Which subjects the next grade still needs, pre-filled from the official NEB catalog. */
subjectsRouter.get('/grade-setup-plan', async (req, res) => {
  const { from, to } = parse(z.object({ from: gradeLevelSchema, to: gradeLevelSchema }), req.query);
  res.json(await buildGradeSetupPlan(prisma, from, to));
});

/** Creates the next grade's subjects (auto = NEB catalog, manual = admin's values) and copies curricula. */
subjectsRouter.post('/copy-grade', async (req, res) => {
  const input = parse(copyGradeSchema, req.body);
  res.json(await prisma.$transaction((tx) => applyGradeSetup(tx, input, ctxOf(req))));
});

// ───────── Curriculum (subject groups per stream & grade) ─────────
export const curriculumRouter = Router();

curriculumRouter.get('/', async (req, res) => {
  const { streamId, grade } = parse(curriculumQuery, req.query);
  res.json(await loadCurriculum(prisma, streamId, grade));
});

curriculumRouter.put('/', async (req, res) => {
  const input = parse(curriculumSchema, req.body);
  const allIds = [...new Set(input.groups.flatMap((g) => g.subjectIds))];
  const subjects = await prisma.subject.findMany({ where: { id: { in: allIds } } });
  if (subjects.length !== allIds.length) throw badRequest('Some subjects do not exist');
  if (subjects.some((s) => s.grade !== input.grade)) throw badRequest(`All subjects must be Grade ${input.grade} subjects`);

  const result = await prisma.$transaction(async (tx) => {
    const before = await loadCurriculum(tx, input.streamId, input.grade);
    await tx.curriculumGroup.deleteMany({ where: { streamId: input.streamId, grade: input.grade } });
    for (const [i, g] of input.groups.entries()) {
      await tx.curriculumGroup.create({
        data: {
          streamId: input.streamId,
          grade: input.grade,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: i,
          subjects: { create: g.subjectIds.map((subjectId) => ({ subjectId })) },
        },
      });
    }
    const after = await loadCurriculum(tx, input.streamId, input.grade);
    await recordAudit(tx, ctxOf(req), {
      action: 'UPDATE',
      entity: 'curriculum',
      entityId: `${input.streamId}:${input.grade}`,
      before,
      after,
    });
    return after;
  });
  res.json(result);
});

// ───────── Grade scales ─────────
export const gradeScalesRouter = Router();

const scaleInclude = {
  bands: { orderBy: { minPercent: 'desc' } },
  finalBands: { orderBy: [{ minGp: 'desc' }, { inclusive: 'asc' }] },
} satisfies Prisma.GradeScaleInclude;

const toScaleDto = (s: Awaited<ReturnType<typeof findScales>>[number]) => ({
  id: s.id,
  name: s.name,
  isDefault: s.isDefault,
  withholdGpaOnNg: s.withholdGpaOnNg,
  gradeBands: s.bands.map((b) => ({ minPercent: n(b.minPercent), letter: b.letter, gradePoint: n(b.gradePoint) })),
  finalGradeBands: s.finalBands.map((b) => ({ minGp: n(b.minGp), inclusive: b.inclusive, letter: b.letter })),
});

const findScales = () => prisma.gradeScale.findMany({ include: scaleInclude, orderBy: { id: 'asc' } });

gradeScalesRouter.get('/', async (_req, res) => {
  res.json((await findScales()).map(toScaleDto));
});

gradeScalesRouter.put('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(gradeScaleSchema, req.body);
  await prisma.$transaction(async (tx) => {
    const before = await tx.gradeScale.findUniqueOrThrow({ where: { id }, include: scaleInclude });
    await tx.gradeBand.deleteMany({ where: { scaleId: id } });
    await tx.finalGradeBand.deleteMany({ where: { scaleId: id } });
    await tx.gradeScale.update({
      where: { id },
      data: {
        name: input.name,
        withholdGpaOnNg: input.withholdGpaOnNg,
        bands: { create: input.gradeBands },
        finalBands: { create: input.finalGradeBands },
      },
    });
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'grade_scale', entityId: id, before, after: input });
  });
  const scale = await prisma.gradeScale.findUniqueOrThrow({ where: { id }, include: scaleInclude });
  res.json(toScaleDto(scale));
});
