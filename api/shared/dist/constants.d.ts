export declare const GRADE_LEVELS: readonly [11, 12];
export type GradeLevel = (typeof GRADE_LEVELS)[number];
export declare const ROMAN_GRADE: Record<GradeLevel, string>;
export declare const ROLES: readonly ["SUPER_ADMIN", "ADMIN"];
export type Role = (typeof ROLES)[number];
export declare const GENDERS: readonly ["MALE", "FEMALE", "OTHER"];
export type Gender = (typeof GENDERS)[number];
export declare const STUDENT_STATUSES: readonly ["ACTIVE", "PASSED_OUT", "LEFT"];
export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export declare const SUBJECT_CATEGORIES: readonly ["COMPULSORY", "OPTIONAL"];
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];
export declare const COMPONENT_TYPES: readonly ["TH", "IN"];
export type ComponentType = (typeof COMPONENT_TYPES)[number];
export declare const COMPONENT_LABEL: Record<ComponentType, string>;
export declare const EXAM_TYPES: readonly ["TERMINAL", "SENDUP", "FINAL"];
export type ExamType = (typeof EXAM_TYPES)[number];
/** Exam types whose results always include internal (practical) marks as well as theory. */
export declare const INTERNAL_REQUIRED_EXAM_TYPES: readonly ExamType[];
/**
 * How result sheets print: the official A4 grade sheet, or (terminal exams only) an A5 sheet with
 * grades only or marks only, two per A4 landscape page.
 */
export declare const RESULT_SHEET_LAYOUTS: readonly ["OFFICIAL", "A5_GRADES", "A5_MARKS"];
export type ResultSheetLayout = (typeof RESULT_SHEET_LAYOUTS)[number];
export declare const RESULT_SHEET_LAYOUT_LABEL: Record<ResultSheetLayout, string>;
export declare const EXAM_STATUSES: readonly ["DRAFT", "MARK_ENTRY", "PUBLISHED", "LOCKED"];
export type ExamStatus = (typeof EXAM_STATUSES)[number];
/**
 * Status changes allowed through the generic status endpoint.
 * Publishing (MARK_ENTRY -> PUBLISHED) and unpublishing go through dedicated endpoints
 * because they create / discard result snapshots and require a reason.
 */
export declare const EXAM_STATUS_TRANSITIONS: Record<ExamStatus, ExamStatus[]>;
export declare const MARK_STATUSES: readonly ["PRESENT", "ABSENT", "WITHHELD"];
export type MarkStatus = (typeof MARK_STATUSES)[number];
export declare const PAGE_SIZE_DEFAULT = 25;
export declare const PAGE_SIZE_MAX = 200;
