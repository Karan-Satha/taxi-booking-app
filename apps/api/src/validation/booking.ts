import { z } from 'zod';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  })
  .refine((value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
    return value >= today;
  }, 'Pickup date must be today or later.');

export const quoteSchema = z
  .object({
    pickup: z.string().trim().min(3).max(255),
    dropoff: z.string().trim().min(3).max(255),
    date: dateSchema,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .superRefine((value, context) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
    const now = `${parts.find((part) => part.type === 'hour')?.value}:${parts.find((part) => part.type === 'minute')?.value}`;
    if (value.date === today && value.time <= now) {
      context.addIssue({ code: 'custom', path: ['time'], message: 'Pickup time must be in the future.' });
    }
  });

export const bookingSchema = z.object({
  quoteToken: z.string().min(20).max(6000),
  vehicleId: z.string().min(1).max(64),
  passengers: z.number().int().min(1).max(12),
  luggage: z.number().int().min(0).max(20),
  customer: z.object({
    name: z.string().trim().min(2).max(50),
    email: z
      .string()
      .trim()
      .email()
      .max(100)
      .transform((value) => value.toLowerCase()),
    countryCode: z
      .string()
      .trim()
      .regex(/^\+\d{1,4}$/),
    phone: z
      .string()
      .trim()
      .regex(/^\d{7,14}$/),
  }),
  note: z.string().trim().max(1000).default(''),
});
