import { describe, expect, it } from 'vitest';
import { rankByGpa, subjectStats } from './stats.js';
import type { SubjectResult } from './types.js';

const r = (enrollmentId: number, gpa: number | null, outcome: 'PASS' | 'NG' | 'INCOMPLETE' = 'PASS') => ({
  enrollmentId,
  result: { gpa, outcome },
});

describe('rankByGpa', () => {
  it('gives tied GPAs the same position and skips the next', () => {
    const ranks = rankByGpa([r(1, 3.4), r(2, 3.6), r(3, 3.6), r(4, 2.0)]);
    expect([...ranks.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 3],
      [2, 1],
      [3, 1],
      [4, 4],
    ]);
  });
  it('treats float noise as a tie', () => {
    const ranks = rankByGpa([r(1, 0.3), r(2, 0.1 + 0.2)]); // 0.30000000000000004
    expect(ranks.get(1)).toBe(1);
    expect(ranks.get(2)).toBe(1);
  });
  it('leaves out NG, incomplete and withheld results', () => {
    const ranks = rankByGpa([r(1, 3.0), r(2, 3.9, 'NG'), r(3, null, 'INCOMPLETE'), r(4, null)]);
    expect([...ranks.keys()]).toEqual([1]);
  });
});

const subj = (subjectId: number, outcome: SubjectResult['outcome'], finalGrade: string, finalGradePoint: number | null): SubjectResult => ({
  subjectId,
  name: `S${subjectId}`,
  creditHour: 4,
  components: [],
  outcome,
  finalGrade,
  finalGradePoint,
  remarks: outcome === 'NG' ? 'NG' : '',
});

describe('subjectStats', () => {
  it('counts pass rate, grade points and grade spread per subject', () => {
    const rows = [
      { result: { subjects: [subj(1, 'PASS', 'A', 3.4), subj(2, 'PASS', 'B', 2.6)] } },
      { result: { subjects: [subj(1, 'PASS', 'A+', 3.8), subj(2, 'NG', 'NG', null)] } },
      { result: { subjects: [subj(1, 'PASS', 'A', 3.3), subj(2, 'PENDING', '—', null)] } },
    ];
    const [s1, s2] = subjectStats(rows);
    expect(s1).toMatchObject({ subjectId: 1, students: 3, graded: 3, passed: 3, ng: 0, passPercent: 100, averageGp: 3.5, highestGp: 3.8 });
    expect(s1!.grades).toEqual([
      { letter: 'A+', count: 1 },
      { letter: 'A', count: 2 },
    ]);
    expect(s2).toMatchObject({ students: 3, graded: 2, passed: 1, ng: 1, passPercent: 50, averageGp: 2.6, highestGp: 2.6 });
    expect(s2!.grades.at(-1)).toEqual({ letter: 'NG', count: 1 });
  });
  it('reports nulls when nobody is graded', () => {
    const [s] = subjectStats([{ result: { subjects: [subj(1, 'PENDING', '—', null)] } }]);
    expect(s).toMatchObject({ graded: 0, passPercent: null, averageGp: null, highestGp: null, grades: [] });
  });
});
