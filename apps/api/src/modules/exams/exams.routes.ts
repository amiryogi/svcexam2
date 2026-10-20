import { Router } from 'express';
import { z } from 'zod';
import {
  EXAM_PRINT_FIELDS,
  EXAM_STATUS_TRANSITIONS,
  INTERNAL_REQUIRED_EXAM_TYPES,
  examComponentsSchema,
  examIncludesInternal,
  examListQuery,
  examSheetLayout,
  examSchema,
  examStatusSchema,
  examUpdateSchema,
  idParams,
  idSchema,
  marksQuery,
  marksUpsertSchema,
  publishSchema,
  resultsQuery,
  unpublishSchema,
} from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { conflict, notFound, parse } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { requireRole } from '../../middleware/auth.js';
import { examProgress, getMarksGrid, saveMarks } from '../marks/marks.service.js';
import { gradeSheets, examResultRows, publishExam, unpublishExam } from '../results/results.service.js';
import { defaultGradeScaleId } from '../subjects/subjects.service.js';
import { assertStatus, effectiveComponents, getExam, toExamDto } from './exams.service.js';

export const examsRouter = Router();

examsRouter.get('/', async (req, res) => {
  const q = parse(examListQuery, req.query);
  const exams = await prisma.exam.findMany({
    where: { academicYearId: q.academicYearId, grade: q.grade, status: q.status },
    include: { academicYear: true },
    orderBy: [{ academicYear: { name: 'desc' } }, { grade: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(exams.map(toExamDto));
});

examsRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(toExamDto(await getExam(prisma, id)));
});

examsRouter.post('/', async (req, res) => {
  const input = parse(examSchema, req.body);
  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        ...input,
        examYearBs: input.examYearBs ?? null,
        examYearAd: input.examYearAd ?? null,
        resultDateBs: input.resultDateBs ?? null,
        issueDateBs: input.issueDateBs ?? null,
        // New terminal exams are theory only unless internal marks are asked for.
        includeInternal: examIncludesInternal(input.type, input.includeInternal ?? false),
        sheetLayout: examSheetLayout(input.type, input.sheetLayout),
        gradeScaleId: input.gradeScaleId ?? (await defaultGradeScaleId(tx)),
      },
      include: { academicYear: true },
    });
    await recordAudit(tx, ctxOf(req), { action: 'CREATE', entity: 'exam', entityId: created.id, after: toExamDto(created) });
    return created;
  });
  res.status(201).json(toExamDto(exam));
});

examsRouter.put('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(examUpdateSchema, req.body);
  const exam = await prisma.$transaction(async (tx) => {
    const before = await getExam(tx, id);
    let data: typeof input = {
      ...input,
      // Switching to send-up / final turns internal marks on; turning them off keeps entered marks, they are just not counted.
      includeInternal: examIncludesInternal(input.type ?? before.type, input.includeInternal ?? before.includeInternal),
      // Send-up and final exams always print the official sheet.
      sheetLayout: examSheetLayout(input.type ?? before.type, input.sheetLayout ?? before.sheetLayout),
    };
    if (before.status === 'PUBLISHED') {
      // Only print details may change after publishing; results stay frozen.
      const isPrintField = (k: string) => (EXAM_PRINT_FIELDS as readonly string[]).includes(k);
      const changed = (Object.keys(input) as (keyof typeof input)[]).filter(
        (k) => !isPrintField(k) && input[k] !== undefined && input[k] !== before[k as keyof typeof before],
      );
      if (changed.length) {
        throw conflict(`Only the print details can be changed after publishing (not: ${changed.join(', ')})`);
      }
      data = Object.fromEntries(Object.entries(input).filter(([k]) => isPrintField(k)));
      if (input.sheetLayout !== undefined) data.sheetLayout = examSheetLayout(before.type, input.sheetLayout);
    } else {
      assertStatus(before, ['DRAFT', 'MARK_ENTRY'], 'edit the exam');
      const moving =
        (input.grade !== undefined && input.grade !== before.grade) ||
        (input.academicYearId !== undefined && input.academicYearId !== before.academicYearId);
      if (moving) {
        // Marks belong to a year's class and a grade's subjects, so they cannot follow the exam.
        const marks = await tx.mark.count({ where: { examId: id } });
        if (marks) throw conflict(`This exam already has ${marks} mark(s); its year and grade can no longer change`);
        // Full-mark overrides refer to the old grade's subjects.
        await tx.examComponent.deleteMany({ where: { examId: id } });
      }
    }
    const updated = await tx.exam.update({ where: { id }, data, include: { academicYear: true } });
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'exam', entityId: id, before: toExamDto(before), after: toExamDto(updated) });
    return updated;
  });
  res.json(toExamDto(exam));
});

examsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  await prisma.$transaction(async (tx) => {
    const exam = await getExam(tx, id);
    assertStatus(exam, ['DRAFT'], 'delete the exam');
    if (await tx.mark.count({ where: { examId: id } })) throw conflict('Marks exist for this exam; it cannot be deleted');
    // Deleting the exam would cascade to the record of results it once published.
    if (await tx.supersededResultSnapshot.count({ where: { examId: id } })) {
      throw conflict('This exam has published results on record; it cannot be deleted');
    }
    await tx.exam.delete({ where: { id } });
    await recordAudit(tx, ctxOf(req), { action: 'DELETE', entity: 'exam', entityId: id, before: toExamDto(exam) });
  });
  res.status(204).end();
});

// ───────── Components (per-exam full marks) ─────────

examsRouter.get('/:id/components', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await effectiveComponents(prisma, await getExam(prisma, id)));
});

examsRouter.put('/:id/components', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { items } = parse(examComponentsSchema, req.body);
  const result = await prisma.$transaction(async (tx) => {
    const exam = await getExam(tx, id);
    assertStatus(exam, ['DRAFT', 'MARK_ENTRY'], 'change exam components');
    const allRequired = INTERNAL_REQUIRED_EXAM_TYPES.includes(exam.type);
    if (allRequired && items.some((i) => !i.included)) {
      throw conflict('Send-up and final exams must include every theory and internal component');
    }
    const defaults = new Map(
      (await tx.subjectComponent.findMany({ where: { id: { in: items.map((i) => i.subjectComponentId) } } })).map((c) => [c.id, c]),
    );
    for (const item of items) {
      const d = defaults.get(item.subjectComponentId);
      if (!d) throw notFound(`Subject component ${item.subjectComponentId}`);
      // A theory-only exam ignores internal components; keep their settings for when internal is turned back on.
      if (d.type === 'IN' && !examIncludesInternal(exam.type, exam.includeInternal)) continue;
      const isDefault = item.included && Number(d.fullMark) === item.fullMark && Number(d.passPercent) === item.passPercent;
      const where = { examId_subjectComponentId: { examId: id, subjectComponentId: item.subjectComponentId } };
      if (isDefault) {
        await tx.examComponent.deleteMany({ where: { examId: id, subjectComponentId: item.subjectComponentId } });
      } else {
        if (item.fullMark < Number(d.fullMark)) {
          const over = await tx.mark.count({ where: { examId: id, subjectComponentId: item.subjectComponentId, marks: { gt: item.fullMark } } });
          if (over) throw conflict(`${over} entered mark(s) are above the new full mark ${item.fullMark}`);
        }
        await tx.examComponent.upsert({
          where,
          create: { examId: id, ...item },
          update: { fullMark: item.fullMark, passPercent: item.passPercent, included: item.included },
        });
      }
    }
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE_COMPONENTS', entity: 'exam', entityId: id, after: items });
    return effectiveComponents(tx, exam);
  });
  res.json(result);
});

// ───────── Status workflow ─────────

examsRouter.post('/:id/status', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { status } = parse(examStatusSchema, req.body);
  const exam = await prisma.$transaction(async (tx) => {
    const before = await getExam(tx, id);
    if (!EXAM_STATUS_TRANSITIONS[before.status].includes(status)) {
      throw conflict(`Cannot change status from ${before.status} to ${status}`);
    }
    const updated = await tx.exam.update({ where: { id }, data: { status }, include: { academicYear: true } });
    await recordAudit(tx, ctxOf(req), { action: 'STATUS', entity: 'exam', entityId: id, before: { status: before.status }, after: { status } });
    return updated;
  });
  res.json(toExamDto(exam));
});

examsRouter.post('/:id/publish', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(publishSchema, req.body ?? {});
  res.json(await publishExam(id, input.allowIncomplete, input.reason, ctxOf(req)));
});

examsRouter.post('/:id/unpublish', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { reason } = parse(unpublishSchema, req.body);
  await unpublishExam(id, reason, ctxOf(req));
  res.status(204).end();
});

/** Unlocking a locked exam is restricted to super admins and needs a reason. */
examsRouter.post('/:id/unlock', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { reason } = parse(unpublishSchema, req.body);
  await prisma.$transaction(async (tx) => {
    const exam = await getExam(tx, id);
    assertStatus(exam, ['LOCKED'], 'unlock');
    await tx.exam.update({ where: { id }, data: { status: 'PUBLISHED' } });
    await recordAudit(tx, ctxOf(req), { action: 'UNLOCK', entity: 'exam', entityId: id, after: { reason } });
  });
  res.status(204).end();
});

// ───────── Marks ─────────

examsRouter.get('/:id/marks', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await getMarksGrid(id, parse(marksQuery, req.query)));
});

examsRouter.put('/:id/marks', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await saveMarks(id, parse(marksUpsertSchema, req.body), ctxOf(req)));
});

examsRouter.get('/:id/progress', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await examProgress(id));
});

// ───────── Results ─────────

examsRouter.get('/:id/results', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await examResultRows(id, parse(resultsQuery, req.query)));
});

examsRouter.get('/:id/gradesheets/:enrollmentId', async (req, res) => {
  const { id, enrollmentId } = parse(idParams.extend({ enrollmentId: idSchema }), req.params);
  const [sheet] = await gradeSheets(id, { enrollmentIds: [enrollmentId] });
  if (!sheet) throw notFound('Result for this student');
  res.json(sheet);
});

examsRouter.get('/:id/gradesheets', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const q = parse(resultsQuery.extend({ enrollmentId: z.coerce.number().int().positive().optional() }), req.query);
  res.json(await gradeSheets(id, { streamId: q.streamId, section: q.section, enrollmentIds: q.enrollmentId ? [q.enrollmentId] : undefined }));
});
