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

const s = (
  grade: 11 | 12,
  familyCode: string,
  name: string,
  category: SubjectCategory,
  thCode: string,
  [thCh, inCh]: [number, number],
  [thFm, inFm]: [number, number],
): CatalogSubject => ({
  grade,
  familyCode,
  name,
  category,
  th: { code: thCode, creditHour: thCh, fullMark: thFm },
  // NEB internal (IN) code = theory code + 1, as printed on grade sheets (0011 / 0012).
  in: { code: String(Number(thCode) + 1).padStart(thCode.length, '0'), creditHour: inCh, fullMark: inFm },
});

const STD: [[number, number], [number, number]] = [[3.75, 1.25], [75, 25]];
const LAB: [[number, number], [number, number]] = [[2.5, 2.5], [50, 50]];

/**
 * NEB subject codes (2078 curriculum) for the subjects this school offers.
 * Grade 11 codes come from the school's own grade sheets; Grade 12 theory codes from NEB's
 * Grade 12 examination routine 2083 (internal code = theory + 1). Credit hours / full marks follow
 * the NEB Grade 11–12 structure. Admins can still edit any value under Setup → Subjects.
 */
export const NEB_SUBJECT_CATALOG: CatalogSubject[] = [
  // Grade 11
  s(11, 'NEP', 'Comp. Nepali', 'COMPULSORY', '0011', [2.25, 0.75], [75, 25]),
  s(11, 'ENG', 'Comp. English', 'COMPULSORY', '0031', [3, 1], [75, 25]),
  s(11, 'SOC', 'Comp. Soc. Std. & life Skill', 'COMPULSORY', '0051', ...STD),
  s(11, 'MATH', 'Comp. Mathematics', 'COMPULSORY', '0071', ...STD),
  s(11, 'PHY', 'Physics', 'OPTIONAL', '1011', ...STD),
  s(11, 'ACC', 'Accounting', 'OPTIONAL', '1031', ...STD),
  s(11, 'BIO', 'Biology', 'OPTIONAL', '2011', ...STD),
  s(11, 'BUS', 'Business Studies', 'OPTIONAL', '2151', ...STD),
  s(11, 'CHEM', 'Chemistry', 'OPTIONAL', '3011', ...STD),
  s(11, 'ECO', 'Economics', 'OPTIONAL', '3031', ...STD),
  s(11, 'CS', 'Computer Science', 'OPTIONAL', '4271', ...LAB),
  s(11, 'HM', 'Hotel Management', 'OPTIONAL', '4391', ...LAB),
  // Grade 12
  s(12, 'NEP', 'Comp. Nepali', 'COMPULSORY', '0021', [2.25, 0.75], [75, 25]),
  s(12, 'ENG', 'Comp. English', 'COMPULSORY', '0041', [3, 1], [75, 25]),
  s(12, 'SOC', 'Comp. Soc. Std. & life Skill', 'COMPULSORY', '0061', ...STD),
  s(12, 'MATH', 'Comp. Mathematics', 'COMPULSORY', '0081', ...STD),
  s(12, 'PHY', 'Physics', 'OPTIONAL', '1021', ...STD),
  s(12, 'ACC', 'Accounting', 'OPTIONAL', '1041', ...STD),
  s(12, 'BIO', 'Biology', 'OPTIONAL', '2021', ...STD),
  s(12, 'BUS', 'Business Studies', 'OPTIONAL', '2161', ...STD),
  s(12, 'CHEM', 'Chemistry', 'OPTIONAL', '3021', ...STD),
  s(12, 'ECO', 'Economics', 'OPTIONAL', '3041', ...STD),
  s(12, 'CS', 'Computer Science', 'OPTIONAL', '4281', ...LAB),
  s(12, 'HM', 'Hotel Management', 'OPTIONAL', '4401', ...LAB),
];

export const catalogSubject = (grade: number, familyCode: string) =>
  NEB_SUBJECT_CATALOG.find((c) => c.grade === grade && c.familyCode === familyCode);

/** One row of the "set up next grade's subjects" plan, shared by API and web. */
export interface GradeSetupRow {
  familyCode: string;
  sourceName: string;
  name: string;
  category: SubjectCategory;
  /** 'catalog' = official NEB code from NEB_SUBJECT_CATALOG; 'pattern' = suggested (code + 10). */
  source: 'catalog' | 'pattern';
  components: { type: 'TH' | 'IN'; nebCode: string; creditHour: number; fullMark: number; passPercent: number }[];
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
