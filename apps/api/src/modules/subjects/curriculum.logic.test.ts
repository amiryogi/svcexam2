import { describe, expect, it } from 'vitest';
import { onlyFittingStream, validateSubjectSelection, type GroupRule } from './curriculum.logic.js';

// Management, Grade 11: NEP=1 ENG=2 SOC=3 MATH=4 ACC=5 ECO=6 CS=7 HM=8
const management: GroupRule[] = [
  { name: 'Compulsory', minSelect: 2, maxSelect: 2, subjectIds: [1, 2] },
  { name: 'Social Studies / Mathematics', minSelect: 1, maxSelect: 1, subjectIds: [3, 4] },
  { name: 'Optional I', minSelect: 1, maxSelect: 1, subjectIds: [5] },
  { name: 'Optional II', minSelect: 1, maxSelect: 1, subjectIds: [6] },
  { name: 'Optional III', minSelect: 1, maxSelect: 1, subjectIds: [7, 8] },
];

describe('validateSubjectSelection', () => {
  it('accepts a valid combination', () => {
    expect(validateSubjectSelection(management, [1, 2, 3, 5, 6, 7])).toEqual([]);
    expect(validateSubjectSelection(management, [1, 2, 4, 5, 6, 8])).toEqual([]);
  });

  it('rejects choosing both alternatives of a single-choice group', () => {
    expect(validateSubjectSelection(management, [1, 2, 3, 4, 5, 6, 7])).toEqual([
      'Social Studies / Mathematics: choose 1 (selected 2)',
    ]);
  });

  it('rejects a missing compulsory subject', () => {
    expect(validateSubjectSelection(management, [1, 3, 5, 6, 7])[0]).toMatch(/Compulsory: choose 2/);
  });

  it('rejects subjects outside the curriculum and duplicates', () => {
    const problems = validateSubjectSelection(management, [1, 2, 3, 5, 6, 7, 99, 1]);
    expect(problems).toContain('A subject was selected more than once');
    expect(problems.some((p) => p.includes('not part'))).toBe(true);
  });

  it('explains when no curriculum is configured', () => {
    expect(validateSubjectSelection([], [1])[0]).toMatch(/No curriculum/);
  });
});

describe('onlyFittingStream', () => {
  // Science, Grade 11: NEP=1 ENG=2 MATH=4 PHY=10 CHEM=11 BIO=12 CS=7
  const science: GroupRule[] = [
    { name: 'Compulsory', minSelect: 3, maxSelect: 3, subjectIds: [1, 2, 4] },
    { name: 'Optional I', minSelect: 1, maxSelect: 1, subjectIds: [10] },
    { name: 'Optional II', minSelect: 1, maxSelect: 1, subjectIds: [11] },
    { name: 'Optional III', minSelect: 1, maxSelect: 1, subjectIds: [12, 7] },
  ];
  const streams = [
    { stream: 'Science', groups: science },
    { stream: 'Management', groups: management },
    { stream: 'Humanities', groups: [] },
  ];

  it('finds the stream that matches the subjects', () => {
    expect(onlyFittingStream(streams, [1, 2, 4, 10, 11, 12])).toBe('Science');
    expect(onlyFittingStream(streams, [1, 2, 3, 5, 6, 7])).toBe('Management');
  });

  it('returns null when no stream fits', () => {
    expect(onlyFittingStream(streams, [1, 2, 10, 5])).toBeNull();
  });
});
