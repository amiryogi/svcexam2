import type { AcademicYear, Exam } from '@prisma/client';
import { examYears, type EffectiveExamComponent, type ExamDto } from '@svi/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { n, type Db } from '../../lib/prisma.js';

export const toExamDto = (e: Exam & { academicYear: AcademicYear }): ExamDto => {
  const years = examYears(e.examYearBs, e.examYearAd, e.academicYear.name);
  return {
  id: e.id,
  academicYearId: e.academicYearId,
  academicYear: e.academicYear.name,
  grade: e.grade,
  name: e.name,
  type: e.type,
  examYearBs: e.examYearBs,
  examYearAd: e.examYearAd,
  effectiveYearBs: years.bs,
  effectiveYearAd: years.ad,
  resultDateBs: e.resultDateBs,
  issueDateBs: e.issueDateBs,
  status: e.status,
  gradeScaleId: e.gradeScaleId,
  remarks: e.remarks,
  publishedAt: e.publishedAt?.toISOString() ?? null,
  };
};

export async function getExam(db: Db, id: number) {
  const exam = await db.exam.findUnique({ where: { id }, include: { academicYear: true } });
  if (!exam) throw notFound('Exam');
  return exam;
}

export function assertStatus(exam: Exam, allowed: Exam['status'][], action: string) {
  if (!allowed.includes(exam.status)) {
    throw conflict(`Cannot ${action} while the exam is ${exam.status.replace('_', ' ').toLowerCase()}`);
  }
}

/**
 * Subject components for the exam's grade with per-exam overrides applied.
 * Components without an override use the subject's full mark / pass percent and are included.
 */
export async function effectiveComponents(db: Db, exam: Exam): Promise<EffectiveExamComponent[]> {
  const [components, overrides] = await Promise.all([
    db.subjectComponent.findMany({
      where: { subject: { grade: exam.grade } },
      include: { subject: true },
      orderBy: [{ subject: { category: 'asc' } }, { nebCode: 'asc' }],
    }),
    db.examComponent.findMany({ where: { examId: exam.id } }),
  ]);
  const byId = new Map(overrides.map((o) => [o.subjectComponentId, o]));
  return components
    .filter((c) => c.subject.isActive || byId.has(c.id))
    .map((c) => {
      const o = byId.get(c.id);
      return {
        subjectComponentId: c.id,
        subjectId: c.subjectId,
        subjectName: c.subject.name,
        type: c.type,
        nebCode: c.nebCode,
        creditHour: n(c.creditHour),
        fullMark: n(o?.fullMark ?? c.fullMark),
        passPercent: n(o?.passPercent ?? c.passPercent),
        included: o?.included ?? true,
        overridden: Boolean(o),
      };
    });
}
