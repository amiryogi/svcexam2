import type { Prisma } from '@prisma/client';
import {
  computeResult,
  examIncludesInternal,
  examYears,
  fullName,
  hasMissingMarks,
  ROMAN_GRADE,
  type ComponentInput,
  type GradeLevel,
  type GradeSheetData,
  type ResultRow,
  type SubjectInput,
} from '@svi/shared';
import { recordAudit, type Ctx } from '../../lib/audit.js';
import { conflict } from '../../lib/errors.js';
import { dateOnly, num, prisma, type Db } from '../../lib/prisma.js';
import { getSettingsRow, toSchoolInfo } from '../settings/settings.service.js';
import { loadGradingRules } from '../subjects/subjects.service.js';
import { assertStatus, effectiveComponents, getExam } from '../exams/exams.service.js';

export interface ResultFilters {
  streamId?: number;
  section?: string;
  enrollmentIds?: number[];
}

type ExamWithYear = Awaited<ReturnType<typeof getExam>>;

/** Computes results live from the current marks. */
export async function computeExamResults(db: Db, exam: ExamWithYear, filters: ResultFilters = {}): Promise<ResultRow[]> {
  const [rules, components, enrollments, marks] = await Promise.all([
    loadGradingRules(db, exam.gradeScaleId),
    effectiveComponents(db, exam),
    db.enrollment.findMany({
      where: {
        academicYearId: exam.academicYearId,
        grade: exam.grade,
        streamId: filters.streamId,
        section: filters.section,
        ...(filters.enrollmentIds && { id: { in: filters.enrollmentIds } }),
        student: { deletedAt: null },
      },
      include: { student: true, stream: true, subjects: { include: { subject: true } } },
      orderBy: [{ section: 'asc' }, { rollNo: 'asc' }, { student: { firstName: 'asc' } }],
    }),
    db.mark.findMany({ where: { examId: exam.id } }),
  ]);

  const included = components.filter((c) => c.included);
  const componentsBySubject = new Map<number, typeof included>();
  for (const c of included) componentsBySubject.set(c.subjectId, [...(componentsBySubject.get(c.subjectId) ?? []), c]);
  const markByKey = new Map(marks.map((m) => [`${m.enrollmentId}:${m.subjectComponentId}`, m]));

  return enrollments.map((e) => {
    const subjects: SubjectInput[] = e.subjects
      .map((es) => es.subject)
      .filter((s) => componentsBySubject.has(s.id))
      // compulsory first, then by NEB code of the first component
      .sort((a, b) => a.category.localeCompare(b.category) || (componentsBySubject.get(a.id)![0]!.nebCode).localeCompare(componentsBySubject.get(b.id)![0]!.nebCode))
      .map((s) => ({
        subjectId: s.id,
        name: s.name,
        components: componentsBySubject.get(s.id)!.map((c): ComponentInput => {
          const m = markByKey.get(`${e.id}:${c.subjectComponentId}`);
          return {
            componentId: c.subjectComponentId,
            type: c.type,
            code: c.nebCode,
            creditHour: c.creditHour,
            fullMark: c.fullMark,
            passPercent: c.passPercent,
            marks: num(m?.marks),
            status: m?.status ?? 'PRESENT',
          };
        }),
      }));
    return {
      studentId: e.studentId,
      enrollmentId: e.id,
      admissionNo: e.student.admissionNo,
      fullName: fullName(e.student),
      dobBs: e.student.dobBs,
      dobAd: dateOnly(e.student.dobAd),
      nebRegistrationNo: e.student.nebRegistrationNo,
      symbolNo: e.symbolNo,
      rollNo: e.rollNo,
      stream: e.stream.name,
      section: e.section,
      result: computeResult(subjects, rules),
    };
  });
}

function examMeta(exam: ExamWithYear): GradeSheetData['exam'] {
  const years = examYears(exam.examYearBs, exam.examYearAd, exam.academicYear.name);
  return {
    id: exam.id,
    name: exam.name,
    type: exam.type,
    grade: exam.grade,
    gradeRoman: ROMAN_GRADE[exam.grade as GradeLevel] ?? String(exam.grade),
    academicYear: exam.academicYear.name,
    examYearBs: years.bs,
    examYearAd: years.ad,
    resultDateBs: exam.resultDateBs,
    issueDateBs: exam.issueDateBs,
    theoryOnly: !examIncludesInternal(exam.type, exam.includeInternal),
  };
}

/** Result rows for screens and ledgers: the frozen snapshot once published, live results before. */
export async function examResultRows(examId: number, filters: ResultFilters): Promise<ResultRow[]> {
  const sheets = await gradeSheets(examId, filters);
  return sheets.map((s) => ({ ...s.student, result: s.result }));
}

/**
 * Grade sheet data for printing. Published / locked exams print the frozen student details and
 * results from their snapshots; other exams print live results marked as provisional.
 * The letterhead (school details, logo, signatories) and the exam's print details (conducted
 * year, issue date) always come from the current settings so corrections show on re-prints.
 */
export async function gradeSheets(examId: number, filters: ResultFilters): Promise<GradeSheetData[]> {
  const exam = await getExam(prisma, examId);
  const school = toSchoolInfo(await getSettingsRow());
  if (exam.status === 'PUBLISHED' || exam.status === 'LOCKED') {
    const snapshots = await prisma.resultSnapshot.findMany({
      where: {
        examId,
        enrollment: {
          streamId: filters.streamId,
          section: filters.section,
          ...(filters.enrollmentIds && { id: { in: filters.enrollmentIds } }),
        },
      },
      include: { enrollment: true },
      orderBy: [{ enrollment: { section: 'asc' } }, { enrollment: { rollNo: 'asc' } }],
    });
    const meta = examMeta(exam);
    return snapshots.map((s) => ({ ...(s.payload as unknown as GradeSheetData), school, exam: meta }));
  }
  const rows = await computeExamResults(prisma, exam, filters);
  return rows.map(({ result, ...student }) => ({
    school,
    exam: examMeta(exam),
    student,
    result,
    provisional: true,
    publishedAt: null,
  }));
}

export async function publishExam(examId: number, allowIncomplete: boolean, reason: string | null, ctx: Ctx) {
  return prisma.$transaction(
    async (tx) => {
      const exam = await getExam(tx, examId);
      assertStatus(exam, ['MARK_ENTRY'], 'publish');
      const rows = await computeExamResults(tx, exam);
      if (rows.length === 0) throw conflict('No students are enrolled for this exam');
      const incomplete = rows.filter((r) => hasMissingMarks(r.result));
      if (incomplete.length && !allowIncomplete) {
        throw conflict(`${incomplete.length} of ${rows.length} student(s) have missing marks`, {
          total: rows.length,
          incomplete: incomplete.length,
          students: incomplete.slice(0, 50).map((r) => ({ enrollmentId: r.enrollmentId, name: r.fullName })),
        });
      }
      const publishedAt = new Date();
      const school = toSchoolInfo(await getSettingsRow(tx));
      // Normally none exist here (unpublishing already archived them); archive any leftovers anyway.
      await archiveSnapshots(tx, examId, 'Replaced by re-publishing');
      await tx.resultSnapshot.createMany({
        data: rows.map(({ result, ...student }) => {
          const payload: GradeSheetData = {
            school,
            exam: examMeta(exam),
            student,
            result,
            provisional: false,
            publishedAt: publishedAt.toISOString(),
          };
          return {
            examId,
            enrollmentId: student.enrollmentId,
            payload: payload as unknown as Prisma.InputJsonValue,
            gpa: result.gpa,
            outcome: result.outcome,
            publishedAt,
          };
        }),
      });
      await tx.exam.update({ where: { id: examId }, data: { status: 'PUBLISHED', publishedAt } });
      await recordAudit(tx, ctx, {
        action: 'PUBLISH',
        entity: 'exam',
        entityId: examId,
        after: { students: rows.length, incomplete: incomplete.length, reason },
      });
      return { published: rows.length, incomplete: incomplete.length };
    },
    { timeout: 120_000 },
  );
}

export async function unpublishExam(examId: number, reason: string, ctx: Ctx) {
  await prisma.$transaction(async (tx) => {
    const exam = await getExam(tx, examId);
    assertStatus(exam, ['PUBLISHED'], 'unpublish');
    const archived = await archiveSnapshots(tx, examId, reason);
    await tx.exam.update({ where: { id: examId }, data: { status: 'MARK_ENTRY', publishedAt: null } });
    await recordAudit(tx, ctx, { action: 'UNPUBLISH', entity: 'exam', entityId: examId, after: { reason, archived } });
  });
}

/**
 * Moves an exam's result snapshots to superseded_result_snapshots, so the version printed on grade
 * sheets that were already handed out stays on record. Returns how many were moved.
 */
async function archiveSnapshots(tx: Prisma.TransactionClient, examId: number, reason: string | null) {
  const snapshots = await tx.resultSnapshot.findMany({ where: { examId } });
  if (snapshots.length === 0) return 0;
  await tx.supersededResultSnapshot.createMany({
    data: snapshots.map((s) => ({
      examId: s.examId,
      enrollmentId: s.enrollmentId,
      payload: s.payload as Prisma.InputJsonValue,
      gpa: s.gpa,
      outcome: s.outcome,
      publishedAt: s.publishedAt,
      reason: reason?.slice(0, 500) ?? null,
    })),
  });
  await tx.resultSnapshot.deleteMany({ where: { examId } });
  return snapshots.length;
}
