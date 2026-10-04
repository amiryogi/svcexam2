import type { FinalGradeBand, GradeBand, GradingRules } from './types.js';

/**
 * NEB letter grading (Grade 11–12) component scale.
 * Verify against the latest NEB directive before seeding; the API stores these as editable data.
 */
export const NEB_GRADE_BANDS: GradeBand[] = [
  { minPercent: 90, letter: 'A+', gradePoint: 4.0 },
  { minPercent: 80, letter: 'A', gradePoint: 3.6 },
  { minPercent: 70, letter: 'B+', gradePoint: 3.2 },
  { minPercent: 60, letter: 'B', gradePoint: 2.8 },
  { minPercent: 50, letter: 'C+', gradePoint: 2.4 },
  { minPercent: 40, letter: 'C', gradePoint: 2.0 },
  { minPercent: 35, letter: 'D', gradePoint: 1.6 },
];

/** Final grade from a subject's weighted grade point ("above 3.6 to 4.0 = A+", …, "1.6 = D"). */
export const NEB_FINAL_GRADE_BANDS: FinalGradeBand[] = [
  { minGp: 3.6, inclusive: false, letter: 'A+' },
  { minGp: 3.2, inclusive: false, letter: 'A' },
  { minGp: 2.8, inclusive: false, letter: 'B+' },
  { minGp: 2.4, inclusive: false, letter: 'B' },
  { minGp: 2.0, inclusive: false, letter: 'C+' },
  { minGp: 1.6, inclusive: false, letter: 'C' },
  { minGp: 1.6, inclusive: true, letter: 'D' },
];

export const NEB_RULES: GradingRules = {
  gradeBands: NEB_GRADE_BANDS,
  finalGradeBands: NEB_FINAL_GRADE_BANDS,
  withholdGpaOnNg: true,
};

export const NG = 'NG';
