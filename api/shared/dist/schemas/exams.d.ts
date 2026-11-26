import { z } from 'zod';
import { type ExamType, type ResultSheetLayout } from '../constants.js';
export declare const examSchema: z.ZodObject<{
    academicYearId: z.ZodCoercedNumber<unknown>;
    grade: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
    name: z.ZodString;
    type: z.ZodEnum<{
        TERMINAL: "TERMINAL";
        SENDUP: "SENDUP";
        FINAL: "FINAL";
    }>;
    examYearBs: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    examYearAd: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    resultDateBs: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    issueDateBs: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    gradeScaleId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    includeInternal: z.ZodOptional<z.ZodBoolean>;
    sheetLayout: z.ZodOptional<z.ZodEnum<{
        OFFICIAL: "OFFICIAL";
        A5_GRADES: "A5_GRADES";
        A5_MARKS: "A5_MARKS";
    }>>;
    remarks: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
}, z.core.$strip>;
export type ExamInput = z.input<typeof examSchema>;
/** Year and grade can only change while the exam has no marks (checked by the API). */
export declare const examUpdateSchema: z.ZodObject<{
    academicYearId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    grade: z.ZodOptional<z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>>;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<{
        TERMINAL: "TERMINAL";
        SENDUP: "SENDUP";
        FINAL: "FINAL";
    }>>;
    examYearBs: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>>;
    examYearAd: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>>;
    resultDateBs: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>>;
    issueDateBs: z.ZodOptional<z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>>;
    gradeScaleId: z.ZodOptional<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    includeInternal: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    sheetLayout: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        OFFICIAL: "OFFICIAL";
        A5_GRADES: "A5_GRADES";
        A5_MARKS: "A5_MARKS";
    }>>>;
    remarks: z.ZodOptional<z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>>;
}, z.core.$strip>;
export type ExamUpdateInput = z.input<typeof examUpdateSchema>;
/** Fields that only affect how grade sheets are printed; editable even after publishing. */
export declare const EXAM_PRINT_FIELDS: readonly ["examYearBs", "examYearAd", "resultDateBs", "issueDateBs", "sheetLayout", "remarks"];
/**
 * Year printed as "conducted in … B.S. (… A.D.)". Uses the exam's own year when set, otherwise
 * the first four digits of the academic year (e.g. "2083" or "2082/83" → 2083 B.S.); the A.D. year
 * is the one in which that B.S. year begins (B.S. − 57).
 */
export declare function examYears(examYearBs: string | null, examYearAd: string | null, academicYear: string): {
    bs: string;
    ad: string;
};
/** Whether internal (practical) marks count in the exam: always for send-up / final, optional for terminal exams. */
export declare function examIncludesInternal(type: ExamType, includeInternal: boolean): boolean;
/** Result sheet layout that applies: terminal exams use their own setting, other exams the official sheet. */
export declare function examSheetLayout(type: ExamType, layout: ResultSheetLayout | null | undefined): ResultSheetLayout;
export declare const examListQuery: z.ZodObject<{
    academicYearId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    grade: z.ZodOptional<z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>>;
    status: z.ZodOptional<z.ZodEnum<{
        DRAFT: "DRAFT";
        MARK_ENTRY: "MARK_ENTRY";
        PUBLISHED: "PUBLISHED";
        LOCKED: "LOCKED";
    }>>;
}, z.core.$strip>;
export declare const examComponentsSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        subjectComponentId: z.ZodCoercedNumber<unknown>;
        fullMark: z.ZodCoercedNumber<unknown>;
        passPercent: z.ZodCoercedNumber<unknown>;
        included: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ExamComponentsInput = z.input<typeof examComponentsSchema>;
export declare const examStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        DRAFT: "DRAFT";
        MARK_ENTRY: "MARK_ENTRY";
        PUBLISHED: "PUBLISHED";
        LOCKED: "LOCKED";
    }>;
}, z.core.$strip>;
export declare const publishSchema: z.ZodObject<{
    allowIncomplete: z.ZodDefault<z.ZodBoolean>;
    reason: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
}, z.core.$strip>;
export declare const unpublishSchema: z.ZodObject<{
    reason: z.ZodString;
}, z.core.$strip>;
export declare const marksQuery: z.ZodObject<{
    subjectComponentId: z.ZodCoercedNumber<unknown>;
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const marksUpsertSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        enrollmentId: z.ZodCoercedNumber<unknown>;
        subjectComponentId: z.ZodCoercedNumber<unknown>;
        marks: z.ZodNullable<z.ZodCoercedNumber<unknown>>;
        status: z.ZodEnum<{
            PRESENT: "PRESENT";
            ABSENT: "ABSENT";
            WITHHELD: "WITHHELD";
        }>;
        version: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MarksUpsertInput = z.input<typeof marksUpsertSchema>;
export declare const resultsQuery: z.ZodObject<{
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
