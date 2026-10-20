import { describe, expect, it } from 'vitest';
import type { EffectiveExamComponent } from '@svi/shared';
import { countProgress } from './progress.logic.js';

const comp = (id: number, subjectId: number, included = true): EffectiveExamComponent => ({
  subjectComponentId: id,
  subjectId,
  subjectName: `Subject ${subjectId}`,
  type: id % 2 ? 'TH' : 'IN',
  nebCode: `C${id}`,
  creditHour: 3,
  fullMark: 75,
  passPercent: 35,
  included,
  overridden: false,
});

describe('countProgress', () => {
  it('counts expected students per subject and entered marks per component', () => {
    const p = countProgress(
      [comp(1, 10), comp(2, 10)],
      [
        { enrollmentId: 1, subjectId: 10 },
        { enrollmentId: 2, subjectId: 10 },
      ],
      [
        { enrollmentId: 1, subjectComponentId: 1 },
        { enrollmentId: 2, subjectComponentId: 1 },
        { enrollmentId: 1, subjectComponentId: 2 },
      ],
    );
    expect(p.map((x) => [x.subjectComponentId, x.entered, x.expected])).toEqual([
      [1, 2, 2],
      [2, 1, 2],
    ]);
  });

  it('ignores marks of students no longer in the class or no longer taking the subject', () => {
    const p = countProgress(
      [comp(1, 10)],
      [
        { enrollmentId: 1, subjectId: 10 },
        { enrollmentId: 2, subjectId: 10 },
        { enrollmentId: 3, subjectId: 20 }, // dropped subject 10, now takes 20
      ],
      [
        { enrollmentId: 1, subjectComponentId: 1 },
        { enrollmentId: 3, subjectComponentId: 1 }, // left over from before the subject change
        { enrollmentId: 9, subjectComponentId: 1 }, // deleted student, not in `taking`
      ],
    );
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ entered: 1, expected: 2 });
  });

  it('leaves out excluded components and subjects nobody takes', () => {
    const p = countProgress([comp(1, 10, false), comp(3, 30)], [{ enrollmentId: 1, subjectId: 10 }], []);
    expect(p).toEqual([]);
  });
});
