import type { Prisma } from '@prisma/client';
import type { ExamResult } from '@svi/shared';
import type { Db } from '../../lib/prisma.js';

const GRADE_LABEL = { 11: 'XI', 12: 'XII' } as const;

/**
 * Published Final-exam results of one grade in one academic year, used to decide who may move on
 * (Grade XI → XII promotion, Grade XII → passed out). A pass in any published Final of that year
 * counts, so a re-run or supplementary Final can clear an earlier NG.
 */
export async function loadFinalResults(db: Db, academicYearId: number, grade: 11 | 12, enrollmentIds: number[]) {
  const finalExam: Prisma.ExamWhereInput = { academicYearId, grade, type: 'FINAL', status: { in: ['PUBLISHED', 'LOCKED'] } };
  const [publishedFinals, snapshots] = await Promise.all([
    db.exam.count({ where: finalExam }),
    db.resultSnapshot.findMany({
      where: { enrollmentId: { in: enrollmentIds }, exam: finalExam },
      select: { enrollmentId: true, outcome: true, payload: true },
      orderBy: { publishedAt: 'asc' },
    }),
  ]);
  const byEnrollment = new Map<number, typeof snapshots>();
  for (const s of snapshots) byEnrollment.set(s.enrollmentId, [...(byEnrollment.get(s.enrollmentId) ?? []), s]);
  const exam = `Grade ${GRADE_LABEL[grade]} Final`;

  return {
    exam,
    /** False when no Final exam of that year and grade has been published yet. */
    published: publishedFinals > 0,
    /** Null when the student passed; otherwise why not, e.g. "Failed the Grade XI Final: NG in Physics". */
    notPassedReason(enrollmentId: number): string | null {
      const results = byEnrollment.get(enrollmentId) ?? [];
      if (results.some((r) => r.outcome === 'PASS')) return null;
      const latest = results.at(-1);
      if (!latest) return `Has no ${exam} result`;
      if (latest.outcome === 'NG') {
        const result = (latest.payload as { result?: ExamResult }).result;
        const ng = result?.subjects.filter((s) => s.outcome === 'NG').map((s) => s.name) ?? [];
        return `Failed the ${exam}${ng.length ? `: NG in ${ng.join(', ')}` : ''}`;
      }
      return `${exam} result is incomplete (marks missing)`;
    },
  };
}
