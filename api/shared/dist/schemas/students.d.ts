import { z } from 'zod';
export declare const studentSchema: z.ZodObject<{
    admissionNo: z.ZodString;
    firstName: z.ZodString;
    middleName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    lastName: z.ZodString;
    gender: z.ZodEnum<{
        MALE: "MALE";
        FEMALE: "FEMALE";
        OTHER: "OTHER";
    }>;
    dobAd: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodISODate>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    dobBs: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    nebRegistrationNo: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    guardianName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    guardianPhone: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    phone: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    email: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    address: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    status: z.ZodDefault<z.ZodEnum<{
        ACTIVE: "ACTIVE";
        PASSED_OUT: "PASSED_OUT";
        LEFT: "LEFT";
    }>>;
}, z.core.$strip>;
export type StudentInput = z.input<typeof studentSchema>;
export type StudentData = z.output<typeof studentSchema>;
export declare const studentListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    academicYearId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    grade: z.ZodOptional<z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>>;
    streamId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    section: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        ACTIVE: "ACTIVE";
        PASSED_OUT: "PASSED_OUT";
        LEFT: "LEFT";
    }>>;
    deleted: z.ZodOptional<z.ZodEnum<{
        true: "true";
        false: "false";
    }>>;
    sort: z.ZodDefault<z.ZodEnum<{
        name: "name";
        admissionNo: "admissionNo";
        createdAt: "createdAt";
    }>>;
}, z.core.$strip>;
export type StudentListQuery = z.input<typeof studentListQuery>;
export interface StudentListItem {
    id: number;
    admissionNo: string;
    fullName: string;
    gender: string;
    dobBs: string | null;
    dobAd: string | null;
    nebRegistrationNo: string | null;
    status: string;
    deletedAt: string | null;
    currentEnrollment: {
        id: number;
        academicYear: string;
        grade: number;
        stream: string;
        section: string;
        rollNo: number | null;
        symbolNo: string | null;
    } | null;
}
export declare const fullName: (s: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
}) => string;
export declare const studentImportRowSchema: z.ZodObject<{
    admissionNo: z.ZodString;
    firstName: z.ZodString;
    middleName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    lastName: z.ZodString;
    gender: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodEnum<{
        MALE: "MALE";
        FEMALE: "FEMALE";
        OTHER: "OTHER";
    }>>;
    dobBs: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    dobAd: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodISODate>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    nebRegistrationNo: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    guardianName: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    guardianPhone: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    phone: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    address: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
}, z.core.$strip>;
