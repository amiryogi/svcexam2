import { z } from 'zod';
import { EXAM_STATUSES, EXAM_TYPES, MARK_STATUSES } from '../constants.js';
import { bsDateSchema, decimal, gradeLevelSchema, idSchema, optionalText, requiredText } from './common.js';

export const examSchema = z.object({
  academicYearId: idSchema,
  grade: gradeLevelSchema,
  name: requiredText(80),
  type: z.enum(EXAM_TYPES),
  /** Optional: when empty, the academic year is printed (see examYears()). */
  examYearBs: z.string().trim().regex(/^\d{4}$/, 'e.g. 2083').nullish().or(z.literal('').transform(() => null)),
  examYearAd: z.string().trim().regex(/^\d{4}$/, 'e.g. 2026').nullish().or(z.literal('').transform(() => null)),
  resultDateBs: bsDateSchema.nullish().or(z.literal('').transform(() => null)),
  issueDateBs: bsDateSchema.nullish().or(z.literal('').transform(() => null)),
  gradeScaleId: idSchema.optional(),
  remarks: optionalText(500),
});
export type ExamInput = z.input<typeof examSchema>;

/** Year and grade can only change while the exam has no marks (checked by the API). */
export const examUpdateSchema = examSchema.partial();
export type ExamUpdateInput = z.input<typeof examUpdateSchema>;

/** Fields that only affect how grade sheets are printed; editable even after publishing. */
export const EXAM_PRINT_FIELDS = ['examYearBs', 'examYearAd', 'resultDateBs', 'issueDateBs', 'remarks'] as const;

/**
 * Year printed as "conducted in … B.S. (… A.D.)". Uses the exam's own year when set, otherwise
 * the first four digits of the academic year (e.g. "2083" or "2082/83" → 2083 B.S.); the A.D. year
 * is the one in which that B.S. year begins (B.S. − 57).
 */
export function examYears(examYearBs: string | null, examYearAd: string | null, academicYear: string): { bs: string; ad: string } {
  const bs = examYearBs ?? academicYear.match(/\d{4}/)?.[0] ?? academicYear;
  const ad = examYearAd ?? (/^\d{4}$/.test(bs) ? String(Number(bs) - 57) : '');
  return { bs, ad };
}

export const examListQuery = z.object({
  academicYearId: idSchema.optional(),
  grade: gradeLevelSchema.optional(),
  status: z.enum(EXAM_STATUSES).optional(),
});

export const examComponentsSchema = z.object({
  items: z
    .array(
      z.object({
        subjectComponentId: idSchema,
        fullMark: decimal(1, 200),
        passPercent: decimal(0, 100),
        included: z.boolean(),
      }),
    )
    .min(1),
});
export type ExamComponentsInput = z.input<typeof examComponentsSchema>;

export const examStatusSchema = z.object({ status: z.enum(EXAM_STATUSES) });

export const publishSchema = z.object({
  /** Publish even if some marks are missing (those students are reported as INCOMPLETE). */
  allowIncomplete: z.boolean().default(false),
  reason: optionalText(500),
});

export const unpublishSchema = z.object({ reason: requiredText(500) });

export const marksQuery = z.object({
  subjectComponentId: idSchema,
  streamId: idSchema.optional(),
  section: z.string().trim().max(10).optional(),
});

export const marksUpsertSchema = z.object({
  items: z
    .array(
      z.object({
        enrollmentId: idSchema,
        subjectComponentId: idSchema,
        marks: z.coerce.number().min(0).max(200).nullable(),
        status: z.enum(MARK_STATUSES),
        /** Version the client last saw; omitted for new rows. Used for optimistic locking. */
        version: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(1000),
});
export type MarksUpsertInput = z.input<typeof marksUpsertSchema>;

export const resultsQuery = z.object({
  streamId: idSchema.optional(),
  section: z.string().trim().max(10).optional(),
});
