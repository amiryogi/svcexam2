import type { SubjectCategory } from '../constants.js';
export interface CatalogComponent {
    code: string;
    creditHour: number;
    fullMark: number;
}
export interface CatalogSubject {
    grade: 11 | 12;
    familyCode: string;
    name: string;
    category: SubjectCategory;
    th: CatalogComponent;
    in: CatalogComponent;
}
/**
 * NEB subject codes (2078 curriculum) for the subjects this school offers.
 * Grade 11 codes come from the school's own grade sheets; Grade 12 theory codes from NEB's
 * Grade 12 examination routine 2083 (internal code = theory + 1). Credit hours / full marks follow
 * the NEB Grade 11–12 structure. Admins can still edit any value under Setup → Subjects.
 */
export declare const NEB_SUBJECT_CATALOG: CatalogSubject[];
export declare const catalogSubject: (grade: number, familyCode: string) => CatalogSubject | undefined;
/** One row of the "set up next grade's subjects" plan, shared by API and web. */
export interface GradeSetupRow {
    familyCode: string;
    sourceName: string;
    name: string;
    category: SubjectCategory;
    /** 'catalog' = official NEB code from NEB_SUBJECT_CATALOG; 'pattern' = suggested (code + 10). */
    source: 'catalog' | 'pattern';
    components: {
        type: 'TH' | 'IN';
        nebCode: string;
        creditHour: number;
        fullMark: number;
        passPercent: number;
    }[];
}
export interface GradeSetupPlan {
    from: number;
    to: number;
    rows: GradeSetupRow[];
    /** Streams whose curriculum (subject groups) will be copied to the target grade. */
    curriculumToCopy: string[];
    /** Streams that still have no curriculum for the target grade after this setup. */
    curriculumMissing: string[];
}
