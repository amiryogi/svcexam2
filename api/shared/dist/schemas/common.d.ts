import { z } from 'zod';
export declare const idSchema: z.ZodCoercedNumber<unknown>;
export declare const idParams: z.ZodObject<{
    id: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export declare const gradeLevelSchema: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodTransform<11 | 12, number>>;
/** Optional free text: trims, turns '' into null. */
export declare const optionalText: (max?: number) => z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
export declare const requiredText: (max?: number) => z.ZodString;
/** Bikram Sambat date stored as YYYY-MM-DD. Range check is done by the BS converter on the server. */
export declare const bsDateSchema: z.ZodString;
export declare const adDateSchema: z.ZodISODate;
export declare const paginationQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
export declare const decimal: (min: number, max: number) => z.ZodCoercedNumber<unknown>;
