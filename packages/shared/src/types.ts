import type {
  ComponentType,
  ExamStatus,
  ExamType,
  MarkStatus,
  SubjectCategory,
} from './constants.js';
import type { ExamResult } from './grading/types.js';

/** API error envelope returned by every failing request. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface SchoolInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  nebSchoolCode: string | null;
  preparedByName: string | null;
  checkedByName: string | null;
  principalName: string | null;
  principalTitle: string;
  gradesheetNote: string | null;
  hasLogo: boolean;
}

export interface SubjectComponentDto {
  id: number;
  type: ComponentType;
  nebCode: string;
  creditHour: number;
  fullMark: number;
  passPercent: number;
}

export interface SubjectDto {
  id: number;
  grade: number;
  name: string;
  shortName: string | null;
  category: SubjectCategory;
  familyCode: string;
  isActive: boolean;
  components: SubjectComponentDto[];
}

export interface CurriculumGroupDto {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  subjectIds: number[];
}

export interface ExamDto {
  id: number;
  academicYearId: number;
  academicYear: string;
  grade: number;
  name: string;
  type: ExamType;
  /** Stored override; null means "use the academic year". */
  examYearBs: string | null;
  examYearAd: string | null;
  /** Year actually printed on grade sheets. */
  effectiveYearBs: string;
  effectiveYearAd: string;
  resultDateBs: string | null;
  issueDateBs: string | null;
  status: ExamStatus;
  gradeScaleId: number;
  remarks: string | null;
  publishedAt: string | null;
}

export interface EffectiveExamComponent {
  subjectComponentId: number;
  subjectId: number;
  subjectName: string;
  type: ComponentType;
  nebCode: string;
  creditHour: number;
  fullMark: number;
  passPercent: number;
  included: boolean;
  overridden: boolean;
}

export interface MarksGridRow {
  enrollmentId: number;
  studentId: number;
  fullName: string;
  rollNo: number | null;
  symbolNo: string | null;
  section: string;
  stream: string;
  marks: number | null;
  status: MarkStatus;
  version: number | null;
}

export interface MarksGrid {
  exam: ExamDto;
  component: EffectiveExamComponent;
  editable: boolean;
  rows: MarksGridRow[];
}

export interface MarksSaveResult {
  saved: number;
  conflicts: { enrollmentId: number; subjectComponentId: number; currentVersion: number }[];
  rows: { enrollmentId: number; subjectComponentId: number; version: number }[];
}

export interface ExamProgressItem {
  subjectComponentId: number;
  subjectName: string;
  type: ComponentType;
  nebCode: string;
  expected: number;
  entered: number;
}

export interface StudentRef {
  studentId: number;
  enrollmentId: number;
  admissionNo: string;
  fullName: string;
  dobBs: string | null;
  dobAd: string | null;
  nebRegistrationNo: string | null;
  symbolNo: string | null;
  rollNo: number | null;
  stream: string;
  section: string;
}

export interface ResultRow extends StudentRef {
  result: ExamResult;
}

export interface GradeSheetData {
  school: SchoolInfo;
  exam: {
    id: number;
    name: string;
    type: ExamType;
    grade: number;
    gradeRoman: string;
    academicYear: string;
    examYearBs: string;
    examYearAd: string;
    resultDateBs: string | null;
    issueDateBs: string | null;
  };
  student: StudentRef;
  result: ExamResult;
  provisional: boolean;
  publishedAt: string | null;
}

export interface DashboardSummary {
  currentAcademicYear: { id: number; name: string } | null;
  totals: { students: number; enrolled: number };
  byGrade: { grade: number; stream: string; male: number; female: number; other: number }[];
  exams: (ExamDto & { progressPercent: number })[];
  recentActivity: { id: number; action: string; entity: string; entityId: string | null; user: string | null; createdAt: string }[];
}
