import type { ComponentInput, ComponentResult, ExamResult, FinalGradeBand, GradingRules, SubjectInput, SubjectResult } from './types.js';
export declare function gradeComponent(c: ComponentInput, rules: GradingRules): ComponentResult;
export declare function finalGradeLetter(gradePoint: number, bands: FinalGradeBand[]): string;
export declare function gradeSubject(s: SubjectInput, rules: GradingRules): SubjectResult;
export declare function computeResult(subjects: SubjectInput[], rules: GradingRules): ExamResult;
/** True when any subject still waits for marks – even if another subject already makes the result NG. */
export declare const hasMissingMarks: (r: ExamResult) => boolean;
export declare const formatGp: (gp: number | null | undefined) => string;
