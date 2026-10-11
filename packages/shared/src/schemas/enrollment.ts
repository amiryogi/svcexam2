import { z } from 'zod';
import { gradeLevelSchema, idSchema, optionalText } from './common.js';

export const enrollmentSchema = z.object({
  studentId: idSchema,
  academicYearId: idSchema,
  grade: gradeLevelSchema,
  streamId: idSchema,
  section: z.string().trim().toUpperCase().min(1).max(10).default('A'),
  rollNo: z.coerce.number().int().min(1).max(999).nullish(),
  symbolNo: optionalText(20),
  subjectIds: z.array(idSchema).min(1, 'Choose the subjects'),
});
export type EnrollmentInput = z.input<typeof enrollmentSchema>;

export const enrollmentUpdateSchema = z.object({
  streamId: idSchema.optional(),
  section: z.string().trim().toUpperCase().min(1).max(10).optional(),
  rollNo: z.coerce.number().int().min(1).max(999).nullish(),
  symbolNo: optionalText(20),
});
export type EnrollmentUpdateInput = z.input<typeof enrollmentUpdateSchema>;

export const enrollmentSubjectsSchema = z.object({ subjectIds: z.array(idSchema).min(1) });

export const enrollmentListQuery = z.object({
  academicYearId: idSchema,
  grade: gradeLevelSchema.optional(),
  streamId: idSchema.optional(),
  section: z.string().trim().max(10).optional(),
});

export const promoteSchema = z.object({
  fromAcademicYearId: idSchema,
  toAcademicYearId: idSchema,
  streamId: idSchema.optional(),
  section: z.string().trim().max(10).optional(),
  enrollmentIds: z.array(idSchema).optional(),
});
export type PromoteInput = z.input<typeof promoteSchema>;

/** Marks the Grade XII students of a year who passed its Final exam as passed out. */
export const passOutSchema = z.object({
  academicYearId: idSchema,
  streamId: idSchema.optional(),
  section: z.string().trim().max(10).optional(),
  enrollmentIds: z.array(idSchema).optional(),
});
export type PassOutInput = z.input<typeof passOutSchema>;

export const bulkSymbolSchema = z.object({
  items: z
    .array(z.object({ enrollmentId: idSchema, symbolNo: optionalText(20) }))
    .min(1)
    .max(500),
});
export type BulkSymbolInput = z.input<typeof bulkSymbolSchema>;
