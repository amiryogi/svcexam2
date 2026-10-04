import type { z } from 'zod';
import {
  fullName,
  type ExamProgressItem,
  type marksQuery,
  type MarksGrid,
  type MarksSaveResult,
  type marksUpsertSchema,
} from '@svi/shared';
import { recordAudit, type Ctx } from '../../lib/audit.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { num, prisma } from '../../lib/prisma.js';
import { assertStatus, effectiveComponents, getExam, toExamDto } from '../exams/exams.service.js';

export async function getMarksGrid(examId: number, q: z.output<typeof marksQuery>): Promise<MarksGrid> {
  const exam = await getExam(prisma, examId);
  const component = (await effectiveComponents(prisma, exam)).find(
    (c) => c.subjectComponentId === q.subjectComponentId,
  );
  if (!component) throw notFound('Subject component for this exam');

  const enrollments = await prisma.enrollment.findMany({
    where: {
      academicYearId: exam.academicYearId,
      grade: exam.grade,
      streamId: q.streamId,
      section: q.section,
      student: { deletedAt: null },
      subjects: { some: { subjectId: component.subjectId } },
    },
    include: {
      student: true,
      stream: true,
      marks: { where: { examId, subjectComponentId: q.subjectComponentId } },
    },
    orderBy: [{ section: 'asc' }, { rollNo: 'asc' }, { student: { firstName: 'asc' } }],
  });

  return {
    exam: toExamDto(exam),
    component,
    editable: exam.status === 'MARK_ENTRY' && component.included,
    rows: enrollments.map((e) => {
      const m = e.marks[0];
      return {
        enrollmentId: e.id,
        studentId: e.studentId,
        fullName: fullName(e.student),
        rollNo: e.rollNo,
        symbolNo: e.symbolNo,
        section: e.section,
        stream: e.stream.name,
        marks: num(m?.marks),
        status: m?.status ?? 'PRESENT',
        version: m?.version ?? null,
      };
    }),
  };
}

export async function saveMarks(
  examId: number,
  input: z.output<typeof marksUpsertSchema>,
  ctx: Ctx,
): Promise<MarksSaveResult> {
  const exam = await getExam(prisma, examId);
  assertStatus(exam, ['MARK_ENTRY'], 'enter marks');
  const components = new Map((await effectiveComponents(prisma, exam)).map((c) => [c.subjectComponentId, c]));

  // Validate everything before writing anything.
  const enrollmentIds = [...new Set(input.items.map((i) => i.enrollmentId))];
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds }, academicYearId: exam.academicYearId, grade: exam.grade },
    include: { subjects: true },
  });
  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
  for (const item of input.items) {
    const c = components.get(item.subjectComponentId);
    if (!c || !c.included) throw badRequest(`Component ${item.subjectComponentId} is not part of this exam`);
    const e = enrollmentById.get(item.enrollmentId);
    if (!e) throw badRequest(`Enrollment ${item.enrollmentId} is not in this exam's class`);
    if (!e.subjects.some((s) => s.subjectId === c.subjectId)) {
      throw badRequest(`Enrollment ${item.enrollmentId} does not take ${c.subjectName}`);
    }
    if (item.status === 'PRESENT' && item.marks !== null && item.marks > c.fullMark) {
      throw badRequest(`Marks ${item.marks} exceed the full mark ${c.fullMark} for ${c.subjectName} (${c.type})`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.mark.findMany({
      where: {
        examId,
        OR: input.items.map((i) => ({ enrollmentId: i.enrollmentId, subjectComponentId: i.subjectComponentId })),
      },
    });
    const key = (a: { enrollmentId: number; subjectComponentId: number }) => `${a.enrollmentId}:${a.subjectComponentId}`;
    const existingByKey = new Map(existing.map((m) => [key(m), m]));

    const result: MarksSaveResult = { saved: 0, conflicts: [], rows: [] };
    const changes: unknown[] = [];
    for (const item of input.items) {
      const marks = item.status === 'PRESENT' ? item.marks : null;
      const current = existingByKey.get(key(item));

      if (current) {
        const same = num(current.marks) === marks && current.status === item.status;
        if (same) {
          result.rows.push({ ...item, version: current.version });
          continue;
        }
        // Someone else changed this cell since the client loaded it.
        if (item.version !== current.version) {
          result.conflicts.push({ ...item, currentVersion: current.version });
          continue;
        }
        if (item.status === 'PRESENT' && marks === null) {
          await tx.mark.delete({ where: { id: current.id } });
          result.rows.push({ ...item, version: 0 });
        } else {
          const updated = await tx.mark.update({
            where: { id: current.id, version: current.version },
            data: { marks, status: item.status, version: { increment: 1 }, enteredById: ctx.userId },
          });
          result.rows.push({ ...item, version: updated.version });
        }
        changes.push({
          enrollmentId: item.enrollmentId,
          subjectComponentId: item.subjectComponentId,
          before: { marks: num(current.marks), status: current.status },
          after: { marks, status: item.status },
        });
        result.saved++;
      } else {
        if (item.status === 'PRESENT' && marks === null) continue; // nothing to store
        const created = await tx.mark.create({
          data: {
            examId,
            enrollmentId: item.enrollmentId,
            subjectComponentId: item.subjectComponentId,
            marks,
            status: item.status,
            enteredById: ctx.userId,
          },
        });
        result.rows.push({ ...item, version: created.version });
        changes.push({ enrollmentId: item.enrollmentId, subjectComponentId: item.subjectComponentId, after: { marks, status: item.status } });
        result.saved++;
      }
    }
    if (changes.length) {
      await recordAudit(tx, ctx, { action: 'MARKS_SAVE', entity: 'exam', entityId: examId, after: changes });
    }
    return result;
  });
}

export async function examProgress(examId: number): Promise<ExamProgressItem[]> {
  const exam = await getExam(prisma, examId);
  const components = (await effectiveComponents(prisma, exam)).filter((c) => c.included);
  const [expected, entered] = await Promise.all([
    prisma.enrollmentSubject.groupBy({
      by: ['subjectId'],
      where: { enrollment: { academicYearId: exam.academicYearId, grade: exam.grade, student: { deletedAt: null } } },
      _count: { _all: true },
    }),
    prisma.mark.groupBy({
      by: ['subjectComponentId'],
      where: { examId, OR: [{ marks: { not: null } }, { status: { not: 'PRESENT' } }] },
      _count: { _all: true },
    }),
  ]);
  const expectedBySubject = new Map(expected.map((e) => [e.subjectId, e._count._all]));
  const enteredByComponent = new Map(entered.map((e) => [e.subjectComponentId, e._count._all]));
  return components
    .map((c) => ({
      subjectComponentId: c.subjectComponentId,
      subjectName: c.subjectName,
      type: c.type,
      nebCode: c.nebCode,
      expected: expectedBySubject.get(c.subjectId) ?? 0,
      entered: enteredByComponent.get(c.subjectComponentId) ?? 0,
    }))
    .filter((p) => p.expected > 0);
}
