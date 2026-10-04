import { describe, expect, it } from 'vitest';
import { computeResult, finalGradeLetter, gradeComponent, gradeSubject, hasMissingMarks } from './engine.js';
import { NEB_FINAL_GRADE_BANDS, NEB_RULES } from './neb.js';
import type { ComponentInput, SubjectInput } from './types.js';

let nextId = 1;
const comp = (
  type: 'TH' | 'IN',
  marks: number | null,
  fullMark: number,
  creditHour: number,
  status: ComponentInput['status'] = 'PRESENT',
): ComponentInput => ({
  componentId: nextId++,
  type,
  code: `${type}${nextId}`,
  creditHour,
  fullMark,
  passPercent: 35,
  marks,
  status,
});

const subject = (name: string, th: ComponentInput, inn: ComponentInput): SubjectInput => ({
  subjectId: nextId++,
  name,
  components: [th, inn],
});

describe('gradeComponent', () => {
  it.each([
    [100, 'A+', 4.0],
    [90, 'A+', 4.0],
    [89.99, 'A', 3.6],
    [80, 'A', 3.6],
    [70, 'B+', 3.2],
    [60, 'B', 2.8],
    [50, 'C+', 2.4],
    [40, 'C', 2.0],
    [39.99, 'D', 1.6],
    [35, 'D', 1.6],
    [34.99, 'NG', 0],
    [0, 'NG', 0],
  ])('%s/100 -> %s', (marks, letter, gp) => {
    const r = gradeComponent(comp('TH', marks, 100, 3), NEB_RULES);
    expect(r.grade).toBe(letter);
    expect(r.gradePoint).toBe(gp);
  });

  it('handles full marks of 75 exactly at the band edge', () => {
    // 26.25 / 75 = 35% exactly
    expect(gradeComponent(comp('TH', 26.25, 75, 3), NEB_RULES).grade).toBe('D');
    expect(gradeComponent(comp('TH', 26, 75, 3), NEB_RULES).grade).toBe('NG');
    // 67.5 / 75 = 90% exactly
    expect(gradeComponent(comp('TH', 67.5, 75, 3), NEB_RULES).grade).toBe('A+');
  });

  it('marks absent and withheld components', () => {
    expect(gradeComponent(comp('TH', null, 75, 3, 'ABSENT'), NEB_RULES).grade).toBe('ABS');
    expect(gradeComponent(comp('TH', null, 75, 3, 'WITHHELD'), NEB_RULES).grade).toBe('W');
    expect(gradeComponent(comp('TH', null, 75, 3), NEB_RULES).outcome).toBe('PENDING');
  });

  it('rejects marks above the full mark', () => {
    expect(() => gradeComponent(comp('TH', 76, 75, 3), NEB_RULES)).toThrow(RangeError);
  });

  it('respects a custom pass percentage', () => {
    const c = { ...comp('TH', 38, 100, 3), passPercent: 40 };
    expect(gradeComponent(c, NEB_RULES).grade).toBe('NG');
  });
});

describe('finalGradeLetter', () => {
  it.each([
    [4.0, 'A+'],
    [3.61, 'A+'],
    [3.6, 'A'],
    [3.2, 'B+'],
    [2.81, 'B+'],
    [2.8, 'B'],
    [2.4, 'C+'],
    [2.0, 'C'],
    [1.61, 'C'],
    [1.6, 'D'],
    [1.59, 'NG'],
  ])('%s -> %s', (gp, letter) => {
    expect(finalGradeLetter(gp, NEB_FINAL_GRADE_BANDS)).toBe(letter);
  });
});

describe('gradeSubject', () => {
  it('weights theory and internal by credit hour', () => {
    // Nepali: TH 39/75 = C+ (2.4 × 2.25), IN 19/25 = B+ (3.2 × 0.75) -> 2.6 -> B
    const r = gradeSubject(subject('Nepali', comp('TH', 39, 75, 2.25), comp('IN', 19, 25, 0.75)), NEB_RULES);
    expect(r.finalGradePoint).toBe(2.6);
    expect(r.finalGrade).toBe('B');
    expect(r.creditHour).toBe(3);
  });

  it('is exact on floating point boundaries (2.4×2.25 + 4.0×0.75)/3 = 2.8', () => {
    const r = gradeSubject(subject('Nepali', comp('TH', 38, 75, 2.25), comp('IN', 23, 25, 0.75)), NEB_RULES);
    expect(r.finalGradePoint).toBe(2.8);
    expect(r.finalGrade).toBe('B');
  });

  it('makes the subject NG when theory fails even if internal is A+ (old Access bug, student 3)', () => {
    const r = gradeSubject(subject('Computer Science', comp('TH', 0, 50, 2.5), comp('IN', 46, 50, 2.5)), NEB_RULES);
    expect(r.outcome).toBe('NG');
    expect(r.finalGrade).toBe('NG');
    expect(r.finalGradePoint).toBeNull();
    expect(r.remarks).toBe('NG');
  });

  it('makes the subject NG with ABS remark when a component is absent', () => {
    const r = gradeSubject(
      subject('English', comp('TH', null, 75, 3, 'ABSENT'), comp('IN', 20, 25, 1)),
      NEB_RULES,
    );
    expect(r.finalGrade).toBe('NG');
    expect(r.remarks).toBe('ABS');
  });

  it('is pending while marks are missing', () => {
    const r = gradeSubject(subject('English', comp('TH', 50, 75, 3), comp('IN', null, 25, 1)), NEB_RULES);
    expect(r.outcome).toBe('PENDING');
  });
});

describe('computeResult', () => {
  // Real record of student 1 from the old Access database (Management, Grade XI).
  const student1 = (): SubjectInput[] => [
    subject('Comp. Nepali', comp('TH', 39, 75, 2.25), comp('IN', 19, 25, 0.75)),
    subject('Comp. English', comp('TH', 59, 75, 3), comp('IN', 22, 25, 1)),
    subject('Comp. Social', comp('TH', 42, 75, 3.75), comp('IN', 20, 25, 1.25)),
    subject('Accounting', comp('TH', 44, 75, 3.75), comp('IN', 23, 25, 1.25)),
    subject('Economics', comp('TH', 35, 75, 3.75), comp('IN', 21, 25, 1.25)),
    subject('Computer Science', comp('TH', 29, 50, 2.5), comp('IN', 46, 50, 2.5)),
  ];

  it('reproduces the Access GPA for a passing student', () => {
    const r = computeResult(student1(), NEB_RULES);
    expect(r.totalCreditHour).toBe(27);
    expect(r.gpa).toBe(2.83);
    expect(r.outcome).toBe('PASS');
    expect(r.subjects.map((s) => s.finalGrade)).toEqual(['B', 'A', 'B', 'B', 'C+', 'B+']);
  });

  it('withholds the GPA when any subject is NG', () => {
    const subjects = student1();
    subjects[5] = subject('Computer Science', comp('TH', 0, 50, 2.5), comp('IN', 46, 50, 2.5));
    const r = computeResult(subjects, NEB_RULES);
    expect(r.outcome).toBe('NG');
    expect(r.gpa).toBeNull();
    expect(r.gpaWithheld).toBe(true);
    expect(r.ngSubjects).toBe(1);
  });

  it('computes a GPA with NG subjects when withholding is disabled', () => {
    const subjects = student1();
    subjects[5] = subject('Computer Science', comp('TH', 0, 50, 2.5), comp('IN', 46, 50, 2.5));
    const r = computeResult(subjects, { ...NEB_RULES, withholdGpaOnNg: false });
    expect(r.outcome).toBe('NG');
    expect(r.gpa).not.toBeNull();
  });

  it('is incomplete while marks are missing', () => {
    const subjects = student1();
    subjects[0] = subject('Comp. Nepali', comp('TH', null, 75, 2.25), comp('IN', 19, 25, 0.75));
    const r = computeResult(subjects, NEB_RULES);
    expect(r.outcome).toBe('INCOMPLETE');
    expect(r.gpa).toBeNull();
  });

  it('is incomplete with no subjects', () => {
    expect(computeResult([], NEB_RULES).outcome).toBe('INCOMPLETE');
  });
});

describe('hasMissingMarks', () => {
  it('flags results with pending subjects even when another subject is NG', () => {
    const r = computeResult(
      [
        subject('Nepali', comp('TH', null, 75, 2.25, 'ABSENT'), comp('IN', 20, 25, 0.75)),
        subject('English', comp('TH', null, 75, 3), comp('IN', null, 25, 1)),
      ],
      NEB_RULES,
    );
    expect(r.outcome).toBe('NG');
    expect(hasMissingMarks(r)).toBe(true);
  });

  it('is false when every component has marks', () => {
    const r = computeResult([subject('Nepali', comp('TH', 50, 75, 2.25), comp('IN', 20, 25, 0.75))], NEB_RULES);
    expect(hasMissingMarks(r)).toBe(false);
  });
});
