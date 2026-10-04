import { z } from 'zod';
import { ROLES } from '../constants.js';
import { optionalText, requiredText } from './common.js';

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), {
    message: 'Use upper and lower case letters and at least one number',
  });

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Required').max(50),
  password: z.string().min(1, 'Required').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,50}$/, '3–50 characters: letters, numbers, . _ -'),
  fullName: requiredText(120),
  email: z.email().nullish().or(z.literal('').transform(() => null)),
  role: z.enum(ROLES).default('ADMIN'),
  password: passwordSchema,
});
export type UserCreateInput = z.input<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  fullName: requiredText(120).optional(),
  email: optionalText(120),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});
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
