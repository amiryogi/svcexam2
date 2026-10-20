export const GRADE_LEVELS = [11, 12] as const;
export type GradeLevel = (typeof GRADE_LEVELS)[number];
export const ROMAN_GRADE: Record<GradeLevel, string> = { 11: 'XI', 12: 'XII' };

export const ROLES = ['SUPER_ADMIN', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const STUDENT_STATUSES = ['ACTIVE', 'PASSED_OUT', 'LEFT'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const SUBJECT_CATEGORIES = ['COMPULSORY', 'OPTIONAL'] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

export const COMPONENT_TYPES = ['TH', 'IN'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];
export const COMPONENT_LABEL: Record<ComponentType, string> = { TH: 'Theory', IN: 'Internal' };

export const EXAM_TYPES = ['TERMINAL', 'SENDUP', 'FINAL'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];
/** Exam types whose results always include internal (practical) marks as well as theory. */
export const INTERNAL_REQUIRED_EXAM_TYPES: readonly ExamType[] = ['SENDUP', 'FINAL'];

/**
 * How result sheets print: the official A4 grade sheet, or (terminal exams only) an A5 sheet with
 * grades only or marks only, two per A4 landscape page.
 */
export const RESULT_SHEET_LAYOUTS = ['OFFICIAL', 'A5_GRADES', 'A5_MARKS'] as const;
export type ResultSheetLayout = (typeof RESULT_SHEET_LAYOUTS)[number];
export const RESULT_SHEET_LAYOUT_LABEL: Record<ResultSheetLayout, string> = {
  OFFICIAL: 'Official grade sheet (A4)',
  A5_GRADES: 'A5, grades only (2 per A4)',
  A5_MARKS: 'A5, marks only (2 per A4)',
};

export const EXAM_STATUSES = ['DRAFT', 'MARK_ENTRY', 'PUBLISHED', 'LOCKED'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

/**
 * Status changes allowed through the generic status endpoint.
 * Publishing (MARK_ENTRY -> PUBLISHED) and unpublishing go through dedicated endpoints
 * because they create / discard result snapshots and require a reason.
 */
export const EXAM_STATUS_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  DRAFT: ['MARK_ENTRY'],
  MARK_ENTRY: ['DRAFT'],
  PUBLISHED: ['LOCKED'],
  LOCKED: [],
};

export const MARK_STATUSES = ['PRESENT', 'ABSENT', 'WITHHELD'] as const;
export type MarkStatus = (typeof MARK_STATUSES)[number];

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 200;
