import { z } from 'zod';
import { ROLES } from '../constants.js';
export declare const PASSWORD_MIN_LENGTH = 10;
export declare const passwordSchema: z.ZodString;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginInput = z.input<typeof loginSchema>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmPassword: z.ZodString;
}, z.core.$strip>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export declare const userCreateSchema: z.ZodObject<{
    username: z.ZodString;
    fullName: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodNullable<z.ZodEmail>>, z.ZodPipe<z.ZodLiteral<"">, z.ZodTransform<null, "">>]>;
    role: z.ZodDefault<z.ZodEnum<{
        SUPER_ADMIN: "SUPER_ADMIN";
        ADMIN: "ADMIN";
    }>>;
    password: z.ZodString;
}, z.core.$strip>;
export type UserCreateInput = z.input<typeof userCreateSchema>;
export declare const userUpdateSchema: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    email: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | null, string | null | undefined>>;
    role: z.ZodOptional<z.ZodEnum<{
        SUPER_ADMIN: "SUPER_ADMIN";
        ADMIN: "ADMIN";
    }>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UserUpdateInput = z.input<typeof userUpdateSchema>;
export interface AuthUser {
    id: number;
    username: string;
    fullName: string;
    email: string | null;
    role: (typeof ROLES)[number];
}
export interface LoginResponse {
    user: AuthUser;
    csrfToken: string;
}
