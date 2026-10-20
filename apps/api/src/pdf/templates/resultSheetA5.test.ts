import { describe, expect, it } from 'vitest';
import type { ExamResult } from '@svi/shared';
import { marksSummary } from './resultSheetA5.js';

const comp = (fullMark: number, marks: number | null, status: 'PRESENT' | 'ABSENT' | 'WITHHELD' = 'PRESENT') =>
  ({ componentId: 1, type: 'TH', code: '0011', creditHour: 3, fullMark, passPercent: 35, marks, status, percent: null, gradePoint: null, grade: '', outcome: 'PASS' }) as const;
const result = (comps: ReturnType<typeof comp>[], outcome: ExamResult['outcome'] = 'PASS'): ExamResult => ({
  subjects: [{ subjectId: 1, name: 'S', creditHour: 3, components: [...comps], finalGradePoint: null, finalGrade: '', outcome: 'PASS', remarks: '' }],
  totalCreditHour: 3,
  gpa: null,
  gpaWithheld: false,
  outcome,
  ngSubjects: 0,
});

describe('marksSummary', () => {
  it('adds marks and full marks and gives the percentage to 2 decimals', () => {
    expect(marksSummary(result([comp(75, 52), comp(25, 20.5)]))).toEqual({ fullTotal: 100, obtainedTotal: 72.5, percent: 72.5, result: 'PASS' });
    expect(marksSummary(result([comp(75, 40), comp(75, 40.1)])).percent).toBe(53.4);
  });
  it('counts absent and withheld as 0 and reports FAIL on NG', () => {
    expect(marksSummary(result([comp(75, null, 'ABSENT'), comp(25, 20, 'WITHHELD'), comp(100, 60)], 'NG'))).toEqual({
      fullTotal: 200,
      obtainedTotal: 60,
      percent: 30,
      result: 'FAIL',
    });
  });
  it('leaves totals blank while a mark is missing', () => {
    expect(marksSummary(result([comp(75, 52), comp(25, null)], 'INCOMPLETE'))).toEqual({
      fullTotal: 100,
      obtainedTotal: null,
      percent: null,
      result: 'INCOMPLETE',
    });
  });
});
