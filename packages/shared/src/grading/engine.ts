import { NG } from './neb.js';
import type {
  ComponentInput,
  ComponentResult,
  ExamResult,
  FinalGradeBand,
  GradingRules,
  SubjectInput,
  SubjectResult,
} from './types.js';

/*
 * All comparisons and averages are done in integer hundredths so that values such as
 * (2.4 * 2.25 + 4.0 * 0.75) / 3 = 2.8 never become 2.7999999999999996 and slip a grade.
 */
const toH = (n: number): number => Math.round(n * 100);
const fromH = (h: number): number => h / 100;
/** Integer division of non-negative integers, rounded half up. */
const divRoundHalfUp = (num: number, den: number): number => Math.floor((2 * num + den) / (2 * den));

/** marks / fullMark * 100 >= percent, evaluated exactly. */
function meetsPercent(marks: number, fullMark: number, percent: number): boolean {
  return toH(marks) * 10000 >= toH(percent) * toH(fullMark);
}

export function gradeComponent(c: ComponentInput, rules: GradingRules): ComponentResult {
  if (c.status === 'ABSENT') {
    return { ...c, percent: null, gradePoint: null, grade: 'ABS', outcome: 'ABSENT' };
  }
  if (c.status === 'WITHHELD') {
    return { ...c, percent: null, gradePoint: null, grade: 'W', outcome: 'WITHHELD' };
  }
  if (c.marks === null) {
    return { ...c, percent: null, gradePoint: null, grade: '—', outcome: 'PENDING' };
  }
  if (c.fullMark <= 0) throw new RangeError(`Component ${c.code} has no full mark`);
  if (c.marks < 0 || c.marks > c.fullMark) {
    throw new RangeError(`Marks ${c.marks} for ${c.code} must be between 0 and ${c.fullMark}`);
  }

  const percent = fromH(divRoundHalfUp(toH(c.marks) * 100, toH(c.fullMark)));
  if (!meetsPercent(c.marks, c.fullMark, c.passPercent)) {
    return { ...c, percent, gradePoint: 0, grade: NG, outcome: 'NG' };
  }
  const band = [...rules.gradeBands]
    .sort((a, b) => b.minPercent - a.minPercent)
    .find((b) => meetsPercent(c.marks as number, c.fullMark, b.minPercent));
  if (!band || band.gradePoint <= 0) {
    return { ...c, percent, gradePoint: 0, grade: NG, outcome: 'NG' };
  }
  return { ...c, percent, gradePoint: band.gradePoint, grade: band.letter, outcome: 'PASS' };
}

export function finalGradeLetter(gradePoint: number, bands: FinalGradeBand[]): string {
  const gpH = toH(gradePoint);
  const sorted = [...bands].sort(
    (a, b) => b.minGp - a.minGp || Number(a.inclusive) - Number(b.inclusive),
  );
  const band = sorted.find((b) => (b.inclusive ? gpH >= toH(b.minGp) : gpH > toH(b.minGp)));
  return band?.letter ?? NG;
}

/** Credit-hour weighted grade point of graded components, in hundredths. */
function weightedGpH(components: { creditHour: number; gradePoint: number | null }[]): number {
  let num = 0;
  let den = 0;
  for (const c of components) {
    const chH = toH(c.creditHour);
    num += toH(c.gradePoint ?? 0) * chH;
    den += chH;
  }
  return den === 0 ? 0 : divRoundHalfUp(num, den);
}

export function gradeSubject(s: SubjectInput, rules: GradingRules): SubjectResult {
  const components = s.components.map((c) => gradeComponent(c, rules));
  const creditHour = fromH(components.reduce((sum, c) => sum + toH(c.creditHour), 0));
  const base = { subjectId: s.subjectId, name: s.name, creditHour, components };

  const absent = components.some((c) => c.outcome === 'ABSENT');
  const withheld = components.some((c) => c.outcome === 'WITHHELD');
  const failed = components.some((c) => c.outcome === 'NG');
  if (absent || withheld || failed) {
    // NEB: NG in theory or internal makes the whole subject NG.
    const remarks = absent ? 'ABS' : withheld ? 'W' : NG;
    return { ...base, finalGradePoint: null, finalGrade: NG, outcome: 'NG', remarks };
  }
  if (components.length === 0 || components.some((c) => c.outcome === 'PENDING')) {
    return { ...base, finalGradePoint: null, finalGrade: '—', outcome: 'PENDING', remarks: '' };
  }

  const finalGradePoint = fromH(weightedGpH(components));
  const finalGrade = finalGradeLetter(finalGradePoint, rules.finalGradeBands);
  return {
    ...base,
    finalGradePoint,
    finalGrade,
    outcome: finalGrade === NG ? 'NG' : 'PASS',
    remarks: finalGrade === NG ? NG : '',
  };
}

export function computeResult(subjects: SubjectInput[], rules: GradingRules): ExamResult {
  const graded = subjects.map((s) => gradeSubject(s, rules));
  const totalCreditHour = fromH(graded.reduce((sum, s) => sum + toH(s.creditHour), 0));
  const ngSubjects = graded.filter((s) => s.outcome === 'NG').length;
  const pending = graded.length === 0 || graded.some((s) => s.outcome === 'PENDING');

  const base = { subjects: graded, totalCreditHour, ngSubjects };
  if (ngSubjects > 0 && rules.withholdGpaOnNg) {
    return { ...base, gpa: null, gpaWithheld: true, outcome: 'NG' };
  }
  if (pending) {
    return { ...base, gpa: null, gpaWithheld: false, outcome: 'INCOMPLETE' };
  }
  // GPA = Σ(CH × GP) / ΣCH over every component (matches the NEB grade sheet and the old Access report).
  const gpa = fromH(weightedGpH(graded.flatMap((s) => s.components)));
  return { ...base, gpa, gpaWithheld: false, outcome: ngSubjects > 0 ? 'NG' : 'PASS' };
}

/** True when any subject still waits for marks – even if another subject already makes the result NG. */
export const hasMissingMarks = (r: ExamResult): boolean =>
  r.subjects.length === 0 || r.subjects.some((s) => s.outcome === 'PENDING');

export const formatGp =(gp: number | null | undefined): string =>
  gp === null || gp === undefined ? '—' : gp.toFixed(2);
