import { z } from 'zod';
import { COMPONENT_TYPES, SUBJECT_CATEGORIES } from '../constants.js';
import { adDateSchema, decimal, gradeLevelSchema, idSchema, optionalText, requiredText } from './common.js';

export const settingsSchema = z.object({
  name: requiredText(150),
  address: optionalText(255),
  phone: optionalText(50),
  email: optionalText(120),
  website: optionalText(120),
  nebSchoolCode: optionalText(30),
  preparedByName: optionalText(120),
  checkedByName: optionalText(120),
  principalName: optionalText(120),
  principalTitle: requiredText(80).default('Principal'),
  gradesheetNote: optionalText(2000),
});
export type SettingsInput = z.input<typeof settingsSchema>;

/** A plain B.S. year such as "2084" – the year the session starts in. */
export const academicYearNameSchema = z.string().trim().regex(/^\d{4}$/, 'Use the 4-digit B.S. year, e.g. 2084');

export const academicYearSchema = z
  .object({
    name: academicYearNameSchema,
    startDateAd: adDateSchema.nullish().or(z.literal('').transform(() => null)),
    endDateAd: adDateSchema.nullish().or(z.literal('').transform(() => null)),
    /** Required to rename a year whose published grade sheets would then print the new year. */
    confirmRename: z.boolean().optional(),
  })
  .refine((y) => !y.startDateAd || !y.endDateAd || y.endDateAd > y.startDateAd, {
    message: 'End date must be after the start date',
    path: ['endDateAd'],
  });
export type AcademicYearInput = z.input<typeof academicYearSchema>;

/** The B.S. year of an academic year's name: "2083" -> 2083. */
export const academicYearNumber = (name: string): number => Number(name.match(/\d{4}/)?.[0] ?? NaN);

/** True when `later` is a later academic year than `earlier` (compared by B.S. year). */
export function isLaterAcademicYear(later: { name: string }, earlier: { name: string }): boolean {
  return academicYearNumber(later.name) > academicYearNumber(earlier.name);
}

export const streamSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, '2–20 letters/numbers'),
  name: requiredText(80),
  isActive: z.boolean().default(true),
});
export type StreamInput = z.input<typeof streamSchema>;

export const subjectComponentSchema = z.object({
  id: idSchema.optional(),
  type: z.enum(COMPONENT_TYPES),
  nebCode: z.string().trim().regex(/^\d{3,6}$/, 'NEB code is 3–6 digits'),
  creditHour: decimal(0.25, 10),
  fullMark: decimal(1, 200),
  passPercent: decimal(0, 100).default(35),
});

export const subjectSchema = z
  .object({
    grade: gradeLevelSchema,
    name: requiredText(120),
    shortName: optionalText(30),
    category: z.enum(SUBJECT_CATEGORIES),
    familyCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_]{2,20}$/, '2–20 letters/numbers; same code links Grade 11 and 12'),
    isActive: z.boolean().default(true),
    components: z.array(subjectComponentSchema).min(1).max(2),
  })
  .refine((s) => new Set(s.components.map((c) => c.type)).size === s.components.length, {
    message: 'Each component type can appear once',
    path: ['components'],
  });
export type SubjectFormInput = z.input<typeof subjectSchema>;

export const curriculumGroupSchema = z
  .object({
    name: requiredText(80),
    minSelect: z.coerce.number().int().min(0).max(10),
    maxSelect: z.coerce.number().int().min(1).max(10),
    subjectIds: z.array(idSchema).min(1),
  })
  .refine((g) => g.minSelect <= g.maxSelect, {
    message: 'Minimum cannot exceed maximum',
    path: ['minSelect'],
  })
  .refine((g) => g.maxSelect <= g.subjectIds.length, {
    message: 'Maximum cannot exceed the number of subjects in the group',
    path: ['maxSelect'],
  });

export const curriculumQuery = z.object({ streamId: idSchema, grade: gradeLevelSchema });

export const curriculumSchema = z.object({
  streamId: idSchema,
  grade: gradeLevelSchema,
  groups: z.array(curriculumGroupSchema).min(1),
});
export type CurriculumInput = z.input<typeof curriculumSchema>;

export const gradeScaleSchema = z.object({
  name: requiredText(80),
  withholdGpaOnNg: z.boolean(),
  gradeBands: z
    .array(z.object({ minPercent: decimal(0, 100), letter: requiredText(4), gradePoint: decimal(0, 4) }))
    .min(1),
  finalGradeBands: z
    .array(z.object({ minGp: decimal(0, 4), inclusive: z.boolean(), letter: requiredText(4) }))
    .min(1),
});
export type GradeScaleInput = z.input<typeof gradeScaleSchema>;

/** Body of POST /subjects/copy-grade. `items` = manual mode; omitted = auto (official NEB catalog). */
export const copyGradeSchema = z
  .object({
    from: gradeLevelSchema,
    to: gradeLevelSchema,
    items: z
      .array(
        z.object({
          familyCode: z.string().trim().toUpperCase().min(2).max(20),
          name: requiredText(120),
          components: z.array(subjectComponentSchema.omit({ id: true })).min(1).max(2),
        }),
      )
      .optional(),
  })
  .refine((v) => v.from !== v.to, { message: 'Choose two different grades', path: ['to'] });
export type CopyGradeInput = z.input<typeof copyGradeSchema>;
