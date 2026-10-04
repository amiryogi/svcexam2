import { z } from 'zod';
import { GRADE_LEVELS, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../constants.js';

export const idSchema = z.coerce.number().int().positive();
export const idParams = z.object({ id: idSchema });

export const gradeLevelSchema = z.coerce
  .number()
  .int()
  .refine((g) => (GRADE_LEVELS as readonly number[]).includes(g), 'Grade must be 11 or 12')
  .transform((g) => g as 11 | 12);

/** Optional free text: trims, turns '' into null. */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const requiredText = (max = 255) => z.string().trim().min(1, 'Required').max(max);

/** Bikram Sambat date stored as YYYY-MM-DD. Range check is done by the BS converter on the server. */
export const bsDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[0-2])$/, 'Use YYYY-MM-DD (B.S.)');

export const adDateSchema = z.iso.date('Use YYYY-MM-DD (A.D.)');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const decimal = (min: number, max: number) => z.coerce.number().min(min).max(max);
