import { z } from 'zod';
import { GENDERS, STUDENT_STATUSES } from '../constants.js';
import {
  adDateSchema,
  bsDateSchema,
  gradeLevelSchema,
  idSchema,
  optionalText,
  paginationQuery,
  requiredText,
} from './common.js';

const nameText = (max = 60) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[\p{L}\p{M} .'-]*$/u, 'Letters only');

export const studentSchema = z
  .object({
    admissionNo: z.string().trim().min(1, 'Required').max(30),
    firstName: nameText().min(1, 'Required'),
    middleName: nameText()
      .nullish()
      .transform((v) => (v ? v : null)),
    lastName: nameText().min(1, 'Required'),
    gender: z.enum(GENDERS),
    dobAd: adDateSchema.nullish().or(z.literal('').transform(() => null)),
    dobBs: bsDateSchema.nullish().or(z.literal('').transform(() => null)),
    nebRegistrationNo: z
      .string()
      .trim()
      .regex(/^\d{6,20}$/, 'Digits only')
      .nullish()
      .or(z.literal('').transform(() => null)),
    guardianName: optionalText(120),
    guardianPhone: optionalText(30),
    phone: optionalText(30),
    email: optionalText(120),
    address: optionalText(255),
    status: z.enum(STUDENT_STATUSES).default('ACTIVE'),
  })
  .refine((s) => s.dobAd || s.dobBs, {
    message: 'Enter the date of birth in B.S. or A.D.',
    path: ['dobBs'],
  });
export type StudentInput = z.input<typeof studentSchema>;
export type StudentData = z.output<typeof studentSchema>;

export const studentListQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  academicYearId: idSchema.optional(),
  grade: gradeLevelSchema.optional(),
  streamId: idSchema.optional(),
  section: z.string().trim().max(10).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),
  deleted: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'admissionNo', 'createdAt']).default('name'),
});
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

export const fullName = (s: { firstName: string; middleName?: string | null; lastName: string }) =>
  [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');

export const studentImportRowSchema = z.object({
  admissionNo: requiredText(30),
  firstName: requiredText(60),
  middleName: optionalText(60),
  lastName: requiredText(60),
  gender: z
    .string()
    .trim()
    .toUpperCase()
    .transform((g) => (g === 'M' ? 'MALE' : g === 'F' ? 'FEMALE' : g))
    .pipe(z.enum(GENDERS)),
  dobBs: bsDateSchema.nullish().or(z.literal('').transform(() => null)),
  dobAd: adDateSchema.nullish().or(z.literal('').transform(() => null)),
  nebRegistrationNo: optionalText(20),
  guardianName: optionalText(120),
  guardianPhone: optionalText(30),
  phone: optionalText(30),
  address: optionalText(255),
});
