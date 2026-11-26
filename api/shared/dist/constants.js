export const GRADE_LEVELS = [11, 12];
export const ROMAN_GRADE = { 11: 'XI', 12: 'XII' };
export const ROLES = ['SUPER_ADMIN', 'ADMIN'];
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
export const STUDENT_STATUSES = ['ACTIVE', 'PASSED_OUT', 'LEFT'];
export const SUBJECT_CATEGORIES = ['COMPULSORY', 'OPTIONAL'];
export const COMPONENT_TYPES = ['TH', 'IN'];
export const COMPONENT_LABEL = { TH: 'Theory', IN: 'Internal' };
export const EXAM_TYPES = ['TERMINAL', 'SENDUP', 'FINAL'];
/** Exam types whose results always include internal (practical) marks as well as theory. */
export const INTERNAL_REQUIRED_EXAM_TYPES = ['SENDUP', 'FINAL'];
/**
 * How result sheets print: the official A4 grade sheet, or (terminal exams only) an A5 sheet with
 * grades only or marks only, two per A4 landscape page.
 */
export const RESULT_SHEET_LAYOUTS = ['OFFICIAL', 'A5_GRADES', 'A5_MARKS'];
export const RESULT_SHEET_LAYOUT_LABEL = {
    OFFICIAL: 'Official grade sheet (A4)',
    A5_GRADES: 'A5, grades only (2 per A4)',
    A5_MARKS: 'A5, marks only (2 per A4)',
};
export const EXAM_STATUSES = ['DRAFT', 'MARK_ENTRY', 'PUBLISHED', 'LOCKED'];
/**
 * Status changes allowed through the generic status endpoint.
 * Publishing (MARK_ENTRY -> PUBLISHED) and unpublishing go through dedicated endpoints
 * because they create / discard result snapshots and require a reason.
 */
export const EXAM_STATUS_TRANSITIONS = {
    DRAFT: ['MARK_ENTRY'],
    MARK_ENTRY: ['DRAFT'],
    PUBLISHED: ['LOCKED'],
    LOCKED: [],
};
export const MARK_STATUSES = ['PRESENT', 'ABSENT', 'WITHHELD'];
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 200;
//# sourceMappingURL=constants.js.map