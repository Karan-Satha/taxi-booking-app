import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const passwordSchema = z
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
}).superRefine((value, context) => {
  const phone = parsePhoneNumberFromString(`${value.countryCode}${value.phone}`);
  if (!phone?.isValid()) {
    context.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a valid phone number with country code.' });
  }
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

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email({ error: 'Enter a valid email address.' }).max(254, { error: 'Email address is too long.' }).transform((value) => value.toLowerCase()),
});

export const passwordResetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, { error: 'Use the reset link from your email.' }),
  password: passwordSchema,
});
