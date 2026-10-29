import 'dotenv/config';
import { z } from 'zod';

const optionalEmail = z.preprocess((value) => (value === '' ? undefined : value), z.string().email().optional());
const optionalUrl = z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SUPPORT_EMAIL: optionalEmail,
  SUPPORT_PHONE: z.string().optional(),
  TERMS_URL: optionalUrl,
  CANCELLATION_POLICY_URL: optionalUrl,
  GEOCODER_BASE_URL: z.string().url().default('https://photon.komoot.io'),
  ROUTER_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
  MAPS_USER_AGENT: z.string().min(5).default('HeathrowDrive/2.0 (taxi booking application)'),
  FARE_CATALOG_URL: z
    .string()
    .url()
    .default('https://raw.githubusercontent.com/Karan-Satha/fare/master/taxi.json'),
  PG_SSL: z.enum(['true', 'false']).default('false'),
  SESSION_SECRET: z.string().min(32).default('local-only-session-secret-change-this-value'),
});

export const env = envSchema
  .superRefine((values, context) => {
    if (values.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
      context.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET is required in production.',
      });
    }
    if (values.NODE_ENV === 'production' && !values.DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required in production.',
      });
    }
  })
  .parse(process.env);
