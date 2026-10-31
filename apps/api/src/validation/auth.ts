import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Password is too long.')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Include at least one letter and one number.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long.');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  countryCode: z
    .string()
    .trim()
    .regex(/^\+\d{1,4}$/),
  phone: z
    .string()
    .trim()
    .regex(/^\d{7,14}$/),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});
