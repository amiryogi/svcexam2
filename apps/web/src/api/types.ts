import type { Gender, Role, StudentStatus } from '@svi/shared';

export interface AcademicYear {
  id: number;
  name: string;
  startDateAd: string | null;
  endDateAd: string | null;
  isCurrent: boolean;
  /** Present in the year list (GET /academic-years). */
  enrollmentCount?: number;
  examCount?: number;
  publishedExamCount?: number;
}

export interface Stream {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface Student {
  id: number;
  admissionNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  gender: Gender;
  dobAd: string | null;
  dobBs: string | null;
  nebRegistrationNo: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface StudentDetail extends Student {
  enrollments: {
    id: number;
    academicYearId: number;
    academicYear: string;
    grade: number;
    streamId: number;
    stream: string;
    section: string;
    rollNo: number | null;
    symbolNo: string | null;
    subjects: { id: number; name: string }[];
  }[];
}

export interface Enrollment {
  id: number;
  studentId: number;
  admissionNo: string;
  fullName: string;
  gender: Gender;
  academicYearId: number;
  academicYear: string;
  grade: number;
  streamId: number;
  stream: string;
  section: string;
  rollNo: number | null;
  symbolNo: string | null;
  subjectIds: number[];
}

export interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
}

export interface GradeScale {
  id: number;
  name: string;
  isDefault: boolean;
  withholdGpaOnNg: boolean;
  gradeBands: { minPercent: number; letter: string; gradePoint: number }[];
  finalGradeBands: { minGp: number; inclusive: boolean; letter: string }[];
}

export interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  user: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}
