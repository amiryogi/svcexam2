import { z } from 'zod';
export declare const settingsSchema: z.ZodObject<{
    name: z.ZodString;
    address: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    phone: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    email: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    website: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    nebSchoolCode: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    preparedByName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    checkedByName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    principalName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    principalTitle: z.ZodDefault<z.ZodString>;
    gradesheetNote: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
}, z.core.$strip>;
export type SettingsInput = z.input<typeof settingsSchema>;
/** A plain B.S. year such as "2084" – the year the session starts in. */
export declare const academicYearNameSchema: z.ZodString;
export declare const academicYearSchema: z.ZodObject<{
    name: z.ZodString;
    startDateAd: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodISODate>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    endDateAd: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodISODate>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    confirmRename: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AcademicYearInput = z.input<typeof academicYearSchema>;
/** The B.S. year of an academic year's name: "2083" -> 2083. */
export declare const academicYearNumber: (name: string) => number;
/** True when `later` is a later academic year than `earlier` (compared by B.S. year). */
export declare function isLaterAcademicYear(later: {
    name: string;
}, earlier: {
    name: string;
}): boolean;
export declare const streamSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type StreamInput = z.input<typeof streamSchema>;
export declare const subjectComponentSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    type: z.ZodEnum<{
        TH: "TH";
        IN: "IN";
    }>;
    nebCode: z.ZodString;
    creditHour: z.ZodCoercedNumber<unknown>;
    fullMark: z.ZodCoercedNumber<unknown>;
    passPercent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const subjectSchema: z.ZodObject<{
    grade: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
    name: z.ZodString;
    shortName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    category: z.ZodEnum<{
        COMPULSORY: "COMPULSORY";
        OPTIONAL: "OPTIONAL";
    }>;
    familyCode: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    components: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        type: z.ZodEnum<{
            TH: "TH";
            IN: "IN";
        }>;
        nebCode: z.ZodString;
        creditHour: z.ZodCoercedNumber<unknown>;
        fullMark: z.ZodCoercedNumber<unknown>;
        passPercent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SubjectFormInput = z.input<typeof subjectSchema>;
export declare const curriculumGroupSchema: z.ZodObject<{
    name: z.ZodString;
    minSelect: z.ZodCoercedNumber<unknown>;
    maxSelect: z.ZodCoercedNumber<unknown>;
    subjectIds: z.ZodArray<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const curriculumQuery: z.ZodObject<{
    streamId: z.ZodCoercedNumber<unknown>;
    grade: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
}, z.core.$strip>;
export declare const curriculumSchema: z.ZodObject<{
    streamId: z.ZodCoercedNumber<unknown>;
    grade: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
    groups: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        minSelect: z.ZodCoercedNumber<unknown>;
        maxSelect: z.ZodCoercedNumber<unknown>;
        subjectIds: z.ZodArray<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CurriculumInput = z.input<typeof curriculumSchema>;
export declare const gradeScaleSchema: z.ZodObject<{
    name: z.ZodString;
    withholdGpaOnNg: z.ZodBoolean;
    gradeBands: z.ZodArray<z.ZodObject<{
        minPercent: z.ZodCoercedNumber<unknown>;
        letter: z.ZodString;
        gradePoint: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    finalGradeBands: z.ZodArray<z.ZodObject<{
        minGp: z.ZodCoercedNumber<unknown>;
        inclusive: z.ZodBoolean;
        letter: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GradeScaleInput = z.input<typeof gradeScaleSchema>;
/** Body of POST /subjects/copy-grade. `items` = manual mode; omitted = auto (official NEB catalog). */
export declare const copyGradeSchema: z.ZodObject<{
    from: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
    to: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        familyCode: z.ZodString;
        name: z.ZodString;
        components: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                TH: "TH";
                IN: "IN";
            }>;
            nebCode: z.ZodString;
            creditHour: z.ZodCoercedNumber<unknown>;
            fullMark: z.ZodCoercedNumber<unknown>;
            passPercent: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CopyGradeInput = z.input<typeof copyGradeSchema>;
