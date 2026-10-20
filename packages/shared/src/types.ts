import type {
  ComponentType,
  ExamStatus,
  ExamType,
  MarkStatus,
  ResultSheetLayout,
  SubjectCategory,
} from './constants.js';
import type { ExamResult } from './grading/types.js';

/** API error envelope returned by every failing request. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Public school identity for the login page and app chrome (GET /public/branding). */
export interface PublicBranding {
  name: string;
  address: string | null;
  hasLogo: boolean;
  /** Changes when settings are saved; append to the logo URL to refresh cached copies. */
  version: number;
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
  /** Black & white logo printed on grade sheets and ledgers. */
  hasLogo: boolean;
  /** Colour logo shown on the website. */
  hasWebLogo: boolean;
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
  /** Effective value: true for send-up / final exams, the exam's own setting for terminal exams. */
  includeInternal: boolean;
  /** Effective value: OFFICIAL for send-up / final exams, the exam's own setting for terminal exams. */
  sheetLayout: ResultSheetLayout;
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
    /** Terminal exam printed with theory marks only (absent on older snapshots). */
    theoryOnly?: boolean;
    /** How the sheet prints; always read live from the exam (absent on older snapshots = OFFICIAL). */
    sheetLayout?: ResultSheetLayout;
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
  exams: (ExamDto & {
    progressPercent: number;
    /** Exams open for mark entry: components still waiting for marks. Optional: older APIs don't send it. */
    missing?: { subjectComponentId: number; subjectName: string; type: ComponentType; nebCode: string; missing: number }[];
  })[];
  recentActivity: { id: number; action: string; entity: string; entityId: string | null; user: string | null; createdAt: string }[];
}
