import { Router } from 'express';
import type { z } from 'zod';
import {
  bulkSymbolSchema,
  enrollmentListQuery,
  enrollmentSchema,
  enrollmentSubjectsSchema,
  enrollmentUpdateSchema,
  fullName,
  idParams,
  promoteSchema,
} from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { badRequest, conflict, notFound, parse } from '../../lib/errors.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { validateSubjectSelection } from '../subjects/curriculum.logic.js';
import { loadGroupRules } from '../subjects/subjects.service.js';

export const enrollmentsRouter = Router();

async function assertValidSubjects(db: Db, streamId: number, grade: number, subjectIds: number[]) {
  const subjects = await db.subject.findMany({ where: { id: { in: subjectIds } } });
  if (subjects.length !== new Set(subjectIds).size) throw badRequest('Some subjects do not exist');
  if (subjects.some((s) => s.grade !== grade)) throw badRequest(`Only Grade ${grade} subjects can be selected`);
  if (subjects.some((s) => !s.isActive)) throw badRequest('Inactive subjects cannot be selected');
  const problems = validateSubjectSelection(await loadGroupRules(db, streamId, grade), subjectIds);
  if (problems.length) {
    throw badRequest('The subject selection does not match the curriculum', {
      fields: problems.map((message) => ({ path: 'subjectIds', message })),
    });
  }
}

const enrollmentInclude = {
  student: true,
  stream: true,
  academicYear: true,
  subjects: true,
} as const;

type EnrollmentRow = NonNullable<Awaited<ReturnType<typeof findEnrollment>>>;
const findEnrollment = (db: Db, id: number) =>
  db.enrollment.findUnique({ where: { id }, include: enrollmentInclude });

const toDto = (e: EnrollmentRow) => ({
  id: e.id,
  studentId: e.studentId,
  admissionNo: e.student.admissionNo,
  fullName: fullName(e.student),
  gender: e.student.gender,
  academicYearId: e.academicYearId,
  academicYear: e.academicYear.name,
  grade: e.grade,
  streamId: e.streamId,
  stream: e.stream.name,
  section: e.section,
  rollNo: e.rollNo,
  symbolNo: e.symbolNo,
  subjectIds: e.subjects.map((s) => s.subjectId),
});

enrollmentsRouter.get('/', async (req, res) => {
  const q = parse(enrollmentListQuery, req.query);
  const rows = await prisma.enrollment.findMany({
    where: {
      academicYearId: q.academicYearId,
      grade: q.grade,
      streamId: q.streamId,
      section: q.section,
      student: { deletedAt: null },
    },
    include: enrollmentInclude,
    orderBy: [{ grade: 'asc' }, { section: 'asc' }, { rollNo: 'asc' }, { student: { firstName: 'asc' } }],
  });
  res.json(rows.map(toDto));
});

enrollmentsRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const e = await findEnrollment(prisma, id);
  if (!e) throw notFound('Enrollment');
  res.json(toDto(e));
});

enrollmentsRouter.post('/', async (req, res) => {
  const input = parse(enrollmentSchema, req.body);
  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: input.studentId } });
    if (!student || student.deletedAt) throw notFound('Student');
    await assertValidSubjects(tx, input.streamId, input.grade, input.subjectIds);
    const created = await tx.enrollment.create({
      data: {
        studentId: input.studentId,
        academicYearId: input.academicYearId,
        grade: input.grade,
        streamId: input.streamId,
        section: input.section,
        rollNo: input.rollNo ?? null,
        symbolNo: input.symbolNo,
        subjects: { create: input.subjectIds.map((subjectId) => ({ subjectId })) },
      },
      include: enrollmentInclude,
    });
    await recordAudit(tx, ctxOf(req), { action: 'CREATE', entity: 'enrollment', entityId: created.id, after: toDto(created) });
    return created;
  });
  res.status(201).json(toDto(result));
});

enrollmentsRouter.patch('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(enrollmentUpdateSchema, req.body);
  const result = await prisma.$transaction(async (tx) => {
    const before = await findEnrollment(tx, id);
    if (!before) throw notFound('Enrollment');
    if (input.streamId && input.streamId !== before.streamId) {
      await assertValidSubjects(tx, input.streamId, before.grade, before.subjects.map((s) => s.subjectId));
    }
    const updated = await tx.enrollment.update({
      where: { id },
      data: {
        streamId: input.streamId,
        section: input.section,
        ...(input.rollNo !== undefined && { rollNo: input.rollNo }),
        ...(input.symbolNo !== undefined && { symbolNo: input.symbolNo }),
      },
      include: enrollmentInclude,
    });
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE', entity: 'enrollment', entityId: id, before: toDto(before), after: toDto(updated) });
    return updated;
  });
  res.json(toDto(result));
});

enrollmentsRouter.put('/:id/subjects', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { subjectIds } = parse(enrollmentSubjectsSchema, req.body);
  const result = await prisma.$transaction(async (tx) => {
    const before = await findEnrollment(tx, id);
    if (!before) throw notFound('Enrollment');
    await assertValidSubjects(tx, before.streamId, before.grade, subjectIds);
    const removed = before.subjects.map((s) => s.subjectId).filter((sid) => !subjectIds.includes(sid));
    if (removed.length) {
      const marks = await tx.mark.count({
        where: { enrollmentId: id, subjectComponent: { subjectId: { in: removed } } },
      });
      if (marks) throw conflict('Marks are already entered for a subject you are removing. Delete those marks first.');
    }
    await tx.enrollmentSubject.deleteMany({ where: { enrollmentId: id } });
    await tx.enrollmentSubject.createMany({ data: subjectIds.map((subjectId) => ({ enrollmentId: id, subjectId })) });
    const after = (await findEnrollment(tx, id))!;
    await recordAudit(tx, ctxOf(req), { action: 'UPDATE_SUBJECTS', entity: 'enrollment', entityId: id, before: toDto(before), after: toDto(after) });
    return after;
  });
  res.json(toDto(result));
});

enrollmentsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  await prisma.$transaction(async (tx) => {
    const before = await findEnrollment(tx, id);
    if (!before) throw notFound('Enrollment');
    const [marks, snapshots] = await Promise.all([
      tx.mark.count({ where: { enrollmentId: id } }),
      tx.resultSnapshot.count({ where: { enrollmentId: id } }),
    ]);
    if (marks || snapshots) throw conflict('This enrollment has marks or published results and cannot be deleted');
    await tx.enrollment.delete({ where: { id } });
    await recordAudit(tx, ctxOf(req), { action: 'DELETE', entity: 'enrollment', entityId: id, before: toDto(before) });
  });
  res.status(204).end();
});

/** Grade 11 -> Grade 12: same stream/section/roll no; subjects mapped by family code. */
enrollmentsRouter.post('/promote', async (req, res) => {
  const input: z.output<typeof promoteSchema> = parse(promoteSchema, req.body);
  if (input.fromAcademicYearId === input.toAcademicYearId) throw badRequest('Choose a different target year');

  const report = await prisma.$transaction(
    async (tx) => {
      const sources = await tx.enrollment.findMany({
        where: {
          academicYearId: input.fromAcademicYearId,
          grade: 11,
          streamId: input.streamId,
          section: input.section,
          ...(input.enrollmentIds && { id: { in: input.enrollmentIds } }),
          student: { deletedAt: null, status: 'ACTIVE' },
        },
        include: { student: true, subjects: { include: { subject: true } } },
      });
      const grade12 = await tx.subject.findMany({ where: { grade: 12, isActive: true } });
      const byFamily = new Map(grade12.map((s) => [s.familyCode, s.id]));

      // Fail early with one clear message instead of skipping every student for the same reason.
      if (sources.length === 0) throw badRequest('No active Grade XI students match this selection');
      if (grade12.length === 0) {
        throw conflict('No Grade XII subjects are set up yet. Go to Setup → Subjects → Grade XII and use "Copy from Grade XI", then check the NEB codes.', {
          setup: 'subjects',
        });
      }
      const streamIds = [...new Set(sources.map((e) => e.streamId))];
      const missingCurriculum: string[] = [];
      for (const streamId of streamIds) {
        if (!(await tx.curriculumGroup.count({ where: { streamId, grade: 12 } }))) {
          missingCurriculum.push((await tx.stream.findUniqueOrThrow({ where: { id: streamId } })).name);
        }
      }
      if (missingCurriculum.length) {
        throw conflict(`No Grade XII curriculum is set up for: ${missingCurriculum.join(', ')}. Configure it under Setup → Curriculum (Grade XII).`, {
          setup: 'curriculum',
        });
      }

      const promoted: number[] = [];
      const skipped: { studentId: number; name: string; reason: string }[] = [];
      for (const e of sources) {
        const name = fullName(e.student);
        const exists = await tx.enrollment.findUnique({
          where: { studentId_academicYearId: { studentId: e.studentId, academicYearId: input.toAcademicYearId } },
        });
        if (exists) {
          skipped.push({ studentId: e.studentId, name, reason: 'Already enrolled in the target year' });
          continue;
        }
        const missing = e.subjects.filter((s) => !byFamily.has(s.subject.familyCode));
        if (missing.length) {
          skipped.push({
            studentId: e.studentId,
            name,
            reason: `No Grade 12 subject for: ${missing.map((m) => m.subject.name).join(', ')}`,
          });
          continue;
        }
        const subjectIds = e.subjects.map((s) => byFamily.get(s.subject.familyCode)!);
        const problems = validateSubjectSelection(await loadGroupRules(tx, e.streamId, 12), subjectIds);
        if (problems.length) {
          skipped.push({ studentId: e.studentId, name, reason: problems.join('; ') });
          continue;
        }
        const created = await tx.enrollment.create({
          data: {
            studentId: e.studentId,
            academicYearId: input.toAcademicYearId,
            grade: 12,
            streamId: e.streamId,
            section: e.section,
            rollNo: e.rollNo,
            subjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
          },
        });
        promoted.push(created.id);
      }
      await recordAudit(tx, ctxOf(req), {
        action: 'PROMOTE',
        entity: 'enrollment',
        after: { ...input, promoted: promoted.length, skipped: skipped.length },
      });
      return { promoted: promoted.length, skipped };
    },
    { timeout: 60_000 },
  );
  res.json(report);
});

enrollmentsRouter.post('/bulk-symbol-numbers', async (req, res) => {
  const { items } = parse(bulkSymbolSchema, req.body);
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      await tx.enrollment.update({ where: { id: item.enrollmentId }, data: { symbolNo: item.symbolNo } });
    }
    await recordAudit(tx, ctxOf(req), { action: 'BULK_SYMBOL_NO', entity: 'enrollment', after: items });
  });
  res.status(204).end();
});
