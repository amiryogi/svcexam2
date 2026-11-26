import { z } from 'zod';
export declare const enrollmentSchema: z.ZodObject<{
    studentId: z.ZodCoercedNumber<unknown>;
    academicYearId: z.ZodCoercedNumber<unknown>;
    grade: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
    streamId: z.ZodCoercedNumber<unknown>;
    section: z.ZodDefault<z.ZodString>;
    rollNo: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    symbolNo: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    subjectIds: z.ZodArray<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type EnrollmentInput = z.input<typeof enrollmentSchema>;
export declare const enrollmentUpdateSchema: z.ZodObject<{
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
    rollNo: z.ZodOptional<z.ZodNullable<z.ZodCoercedNumber<unknown>>>;
    symbolNo: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
}, z.core.$strip>;
export type EnrollmentUpdateInput = z.input<typeof enrollmentUpdateSchema>;
export declare const enrollmentSubjectsSchema: z.ZodObject<{
    subjectIds: z.ZodArray<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const enrollmentListQuery: z.ZodObject<{
    academicYearId: z.ZodCoercedNumber<unknown>;
    grade: z.ZodOptional<z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>>;
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const promoteSchema: z.ZodObject<{
    fromAcademicYearId: z.ZodCoercedNumber<unknown>;
    toAcademicYearId: z.ZodCoercedNumber<unknown>;
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
    enrollmentIds: z.ZodOptional<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export type PromoteInput = z.input<typeof promoteSchema>;
/** Marks the Grade XII students of a year who passed its Final exam as passed out. */
export declare const passOutSchema: z.ZodObject<{
    academicYearId: z.ZodCoercedNumber<unknown>;
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
    enrollmentIds: z.ZodOptional<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export type PassOutInput = z.input<typeof passOutSchema>;
export declare const bulkSymbolSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        enrollmentId: z.ZodCoercedNumber<unknown>;
        symbolNo: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BulkSymbolInput = z.input<typeof bulkSymbolSchema>;
