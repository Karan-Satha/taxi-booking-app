import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';

function londonDateParts() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
}

function londonToday() {
  const parts = londonDateParts();
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

const dateSchema = z
  .string({ error: 'Enter a valid pickup date.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Enter a valid pickup date.' })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, { error: 'Enter a valid pickup date.' })
  .refine((value) => value >= londonToday(), { error: 'Pickup date must be today or later.' })
  .refine((value) => {
    const latest = new Date(`${londonToday()}T00:00:00Z`);
    latest.setUTCDate(latest.getUTCDate() + 365);
    return value <= latest.toISOString().slice(0, 10);
  }, { error: 'Bookings can be made up to 12 months in advance.' });

export const quoteSchema = z
  .object({
    pickup: z.string({ error: 'Enter a pickup address.' }).trim().min(3, { error: 'Enter a pickup address.' }).max(255, { error: 'Pickup address is too long.' }),
    dropoff: z.string({ error: 'Enter a destination.' }).trim().min(3, { error: 'Enter a destination.' }).max(255, { error: 'Destination is too long.' }),
    date: dateSchema,
    time: z.string({ error: 'Choose a pickup time.' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Enter a valid pickup time.' }),
  })
  .superRefine((value, context) => {
    const parts = londonDateParts();
    const today = londonToday();
    const now = `${parts.find((part) => part.type === 'hour')?.value}:${parts.find((part) => part.type === 'minute')?.value}`;
    if (value.date === today && value.time <= now) {
      context.addIssue({ code: 'custom', path: ['time'], message: 'Pickup time must be in the future.' });
    }
  });

export const bookingSchema = z.object({
  quoteToken: z.string().min(20, { error: 'Request a fresh fare estimate.' }).max(6000, { error: 'Request a fresh fare estimate.' }),
  vehicleId: z.string().min(1, { error: 'Choose a vehicle.' }).max(64, { error: 'Choose a valid vehicle.' }),
  passengers: z.number().int().min(1).max(12),
  luggage: z.number().int().min(0).max(20),
  customer: z.object({
    name: z.string().trim().min(2, { error: 'Enter your name.' }).max(50, { error: 'Name is too long.' }),
    email: z.string().trim().email({ error: 'Enter a valid email address.' }).max(100, { error: 'Email address is too long.' }).transform((value) => value.toLowerCase()),
    countryCode: z.string().trim().regex(/^\+\d{1,4}$/, { error: 'Enter a valid country calling code.' }),
    phone: z.string().trim().min(1, { error: 'Enter a phone number.' }).max(32, { error: 'Enter a valid phone number.' }),
  }),
  note: z.string().trim().max(1000, { error: 'Journey note must be under 1,000 characters.' }).default(''),
}).superRefine((value, context) => {
  const phone = parsePhoneNumberFromString(`${value.customer.countryCode}${value.customer.phone}`);
  if (!phone?.isValid()) {
    context.addIssue({ code: 'custom', path: ['customer', 'phone'], message: 'Enter a valid phone number with country code.' });
  }
});
