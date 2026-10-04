import type { ComponentType, MarkStatus } from '../constants.js';

/** A row of the component grade scale: percent >= minPercent earns this letter / grade point. */
export interface GradeBand {
  minPercent: number;
  letter: string;
  gradePoint: number;
}

/**
 * A row of the final-grade table applied to a subject's weighted grade point.
 * inclusive=false means "above minGp" (NEB wording), inclusive=true means ">= minGp".
 */
export interface FinalGradeBand {
  minGp: number;
  inclusive: boolean;
  letter: string;
}

export interface GradingRules {
  gradeBands: GradeBand[];
  finalGradeBands: FinalGradeBand[];
  /** When true, a student with any NG subject gets no GPA (printed as "—"). */
  withholdGpaOnNg: boolean;
}

export interface ComponentInput {
  componentId: number;
  type: ComponentType;
  code: string;
  creditHour: number;
  fullMark: number;
  passPercent: number;
  marks: number | null;
  status: MarkStatus;
}

export interface SubjectInput {
  subjectId: number;
  name: string;
  components: ComponentInput[];
}

export type ComponentOutcome = 'PASS' | 'NG' | 'ABSENT' | 'WITHHELD' | 'PENDING';
export type SubjectOutcome = 'PASS' | 'NG' | 'PENDING';
export type ResultOutcome = 'PASS' | 'NG' | 'INCOMPLETE';

export interface ComponentResult extends ComponentInput {
  percent: number | null;
  gradePoint: number | null;
  grade: string;
  outcome: ComponentOutcome;
}

export interface SubjectResult {
  subjectId: number;
  name: string;
  creditHour: number;
  components: ComponentResult[];
  finalGradePoint: number | null;
  finalGrade: string;
  outcome: SubjectOutcome;
  /** Short remark printed on the grade sheet: '', 'NG', 'ABS' or 'W'. */
  remarks: string;
}

export interface ExamResult {
  subjects: SubjectResult[];
  totalCreditHour: number;
  gpa: number | null;
  gpaWithheld: boolean;
  outcome: ResultOutcome;
  ngSubjects: number;
}
