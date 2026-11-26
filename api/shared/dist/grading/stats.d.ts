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
export declare function rankByGpa(rows: Ranked[]): Map<number, number>;
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
    grades: {
        letter: string;
        count: number;
    }[];
}
/** Per-subject pass rate, grade points and grade spread, in the order subjects first appear. */
export declare function subjectStats(rows: {
    result: Pick<ExamResult, 'subjects'>;
}[]): SubjectStat[];
export {};
