import type { ExamResult } from './types.js';

interface Ranked {
  enrollmentId: number;
  result: Pick<ExamResult, 'gpa' | 'outcome'>;
}

/**
 * Class position by GPA among students who passed every subject. Ties share a position and the
 * next one is skipped (3.60, 3.60, 3.40 → 1, 1, 3). Students with NG, missing marks or a withheld
 * GPA get no position. GPAs are compared in hundredths so float noise can't split a tie.
 */
export function rankByGpa(rows: Ranked[]): Map<number, number> {
  const ranked = rows
    .filter((r) => r.result.outcome === 'PASS' && r.result.gpa !== null)
    .map((r) => ({ id: r.enrollmentId, gpaH: Math.round((r.result.gpa as number) * 100) }))
    .sort((a, b) => b.gpaH - a.gpaH);
  const ranks = new Map<number, number>();
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    ranks.set(r.id, prev && prev.gpaH === r.gpaH ? ranks.get(prev.id)! : i + 1);
  });
  return ranks;
}

export interface SubjectStat {
  subjectId: number;
  name: string;
  /** Students taking the subject in this selection. */
  students: number;
  /** Students with a final result (not waiting for marks). */
  graded: number;
  passed: number;
  /** NG, absent or withheld. */
  ng: number;
  /** passed / graded × 100, one decimal; null when nobody is graded yet. */
  passPercent: number | null;
  /** Mean final grade point of the students who passed; null when nobody passed. */
  averageGp: number | null;
  highestGp: number | null;
  /** Final grades with counts, best grade first, NG last. */
  grades: { letter: string; count: number }[];
}

/** Per-subject pass rate, grade points and grade spread, in the order subjects first appear. */
export function subjectStats(rows: { result: Pick<ExamResult, 'subjects'> }[]): SubjectStat[] {
  const acc = new Map<
    number,
    { name: string; students: number; graded: number; passed: number; ng: number; gpH: number[]; grades: Map<string, number>; best: Map<string, number> }
  >();
  for (const row of rows) {
    for (const s of row.result.subjects) {
      let a = acc.get(s.subjectId);
      if (!a) {
        a = { name: s.name, students: 0, graded: 0, passed: 0, ng: 0, gpH: [], grades: new Map(), best: new Map() };
        acc.set(s.subjectId, a);
      }
      a.students++;
      if (s.outcome === 'PENDING') continue;
      a.graded++;
      const letter = s.outcome === 'NG' ? 'NG' : s.finalGrade;
      a.grades.set(letter, (a.grades.get(letter) ?? 0) + 1);
      if (s.outcome === 'PASS' && s.finalGradePoint !== null) {
        a.passed++;
        const h = Math.round(s.finalGradePoint * 100);
        a.gpH.push(h);
        a.best.set(letter, Math.max(a.best.get(letter) ?? 0, h));
      } else {
        a.ng++;
      }
    }
  }
  return [...acc.entries()].map(([subjectId, a]) => ({
    subjectId,
    name: a.name,
    students: a.students,
    graded: a.graded,
    passed: a.passed,
    ng: a.ng,
    passPercent: a.graded ? Math.round((a.passed * 1000) / a.graded) / 10 : null,
    averageGp: a.gpH.length ? Math.round(a.gpH.reduce((x, y) => x + y, 0) / a.gpH.length) / 100 : null,
    highestGp: a.gpH.length ? Math.max(...a.gpH) / 100 : null,
    grades: [...a.grades.entries()]
      .map(([letter, count]) => ({ letter, count }))
      .sort((x, y) => (a.best.get(y.letter) ?? -1) - (a.best.get(x.letter) ?? -1)),
  }));
}
