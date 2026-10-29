import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { env } from '../config/env.js';
import { pool } from '../config/database.js';
import type { JourneyQuote } from '../types/booking.js';
import { renewQuoteToken } from './quoteService.js';
import { sendAbandonedBookingEmail } from './emailService.js';
import { logServerError } from '../middleware/errors.js';

const progressSchema = z.object({
  pickup: z.string().max(500),
  dropoff: z.string().max(500),
  date: z.string().max(10),
  time: z.string().max(5),
  stage: z.number().int().min(1).max(4),
  quote: z.object({ quoteToken: z.string().min(20) }).passthrough().nullable(),
  quoteSavedAt: z.number().nullable(),
  vehicle: z.object({ id: z.string() }).passthrough().nullable(),
  passengers: z.number().int().min(1).max(32),
  luggage: z.number().int().min(0).max(40),
  passengerName: z.string().max(120),
  email: z.string().max(254),
  countryCode: z.string().max(8),
  phone: z.string().max(32),
  note: z.string().max(1000),
  recoveryConsent: z.boolean().default(false),
});

type ProgressPayload = z.infer<typeof progressSchema> & { recoveryToken?: string };

interface StoredProgress {
  session_key: string;
  payload_ciphertext: string;
  payload_iv: string;
  payload_auth_tag: string;
  recovery_token_hash: string;
  recovery_consent: boolean;
  last_activity_at: Date;
  expires_at: Date;
  completed_at: Date | null;
}

const encryptionKey = createHash('sha256').update(env.SESSION_SECRET).digest();

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sessionKey(sessionId: string) {
  return hash(`booking-progress:${sessionId}`);
}

function encrypt(payload: ProgressPayload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

function decrypt(row: Pick<StoredProgress, 'payload_ciphertext' | 'payload_iv' | 'payload_auth_tag'>) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(row.payload_iv, 'hex'));
  decipher.setAuthTag(Buffer.from(row.payload_auth_tag, 'hex'));
  const cleartext = Buffer.concat([
    decipher.update(Buffer.from(row.payload_ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(cleartext) as ProgressPayload;
}

function sanitiseProgress(input: z.infer<typeof progressSchema>) {
  let quote: { quote: JourneyQuote; quoteToken: string } | null = null;
  if (input.quote) {
    const renewed = renewQuoteToken(input.quote.quoteToken);
    if (renewed) quote = renewed;
  }

  const vehicle = quote?.quote.vehicles.find((item) => item.id === input.vehicle?.id) ?? null;
  let stage: ProgressPayload['stage'] = quote && input.stage > 1
    ? Math.max(2, input.stage) as ProgressPayload['stage']
    : 1;
  if (stage >= 3 && !vehicle) stage = 2;
  if (stage >= 3 && (input.passengers > (vehicle?.passengers ?? 0) || input.luggage > (vehicle?.luggage ?? 0))) {
    stage = 2;
  }
  const hasPassengerDetails =
    input.passengerName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim()) &&
    input.phone.replace(/\D/g, '').length >= 6 &&
    input.passengers <= (vehicle?.passengers ?? 0) &&
    input.luggage <= (vehicle?.luggage ?? 0);
  if (stage === 4 && !hasPassengerDetails) stage = 3;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim());
  const route = quote?.quote;
  return {
    ...input,
    pickup: route?.pickup ?? input.pickup.trim(),
    dropoff: route?.dropoff ?? input.dropoff.trim(),
    date: route?.date ?? input.date,
    time: route?.time ?? input.time,
    stage,
    quote,
    vehicle: vehicle ? { ...vehicle } : null,
    quoteSavedAt: quote ? Date.now() : null,
    email: input.email.trim(),
    recoveryConsent: input.recoveryConsent && validEmail && stage >= 3,
  } satisfies ProgressPayload;
}

export async function saveBookingProgress(sessionId: string, value: unknown) {
  if (!pool) return null;
  const parsed = progressSchema.safeParse(value);
  if (!parsed.success) return null;

  const payload = sanitiseProgress(parsed.data);
  const existing = await pool.query<{ payload_ciphertext: string; payload_iv: string; payload_auth_tag: string }>(
    `SELECT payload_ciphertext, payload_iv, payload_auth_tag
     FROM booking_progress WHERE session_key = $1 AND expires_at > now() AND completed_at IS NULL`,
    [sessionKey(sessionId)],
  );
  const previous = existing.rows[0]
    ? decrypt({
        payload_ciphertext: existing.rows[0].payload_ciphertext,
        payload_iv: existing.rows[0].payload_iv,
        payload_auth_tag: existing.rows[0].payload_auth_tag,
      })
    : null;
  const recoveryToken = previous?.recoveryToken ?? randomBytes(32).toString('base64url');
  const storedPayload = { ...payload, recoveryToken };
  const encrypted = encrypt(storedPayload);
  const recoveryHash = hash(recoveryToken);
  const key = sessionKey(sessionId);

  await pool.query(
    `INSERT INTO booking_progress (
       session_key, payload_ciphertext, payload_iv, payload_auth_tag, recovery_token_hash,
       recovery_consent, last_activity_at, expires_at, recovery_email_sent_at, completed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, now(), now() + interval '30 minutes', NULL, NULL)
     ON CONFLICT (session_key) DO UPDATE SET
       payload_ciphertext = EXCLUDED.payload_ciphertext,
       payload_iv = EXCLUDED.payload_iv,
       payload_auth_tag = EXCLUDED.payload_auth_tag,
       recovery_token_hash = EXCLUDED.recovery_token_hash,
       recovery_consent = EXCLUDED.recovery_consent,
       last_activity_at = now(),
       expires_at = now() + interval '30 minutes',
       recovery_email_sent_at = CASE
         WHEN booking_progress.completed_at IS NOT NULL OR booking_progress.expires_at <= now() THEN NULL
         ELSE booking_progress.recovery_email_sent_at
       END,
       completed_at = NULL,
       updated_at = now()`,
    [key, encrypted.ciphertext, encrypted.iv, encrypted.authTag, recoveryHash, payload.recoveryConsent],
  );

  return { stage: payload.stage };
}

export async function getBookingProgress(sessionId: string, recoveryToken?: string) {
  if (!pool) return null;
  const key = sessionKey(sessionId);
  const result = recoveryToken
    ? await pool.query<StoredProgress>(
        `SELECT * FROM booking_progress WHERE recovery_token_hash = $1`,
        [hash(recoveryToken)],
      )
    : await pool.query<StoredProgress>(`SELECT * FROM booking_progress WHERE session_key = $1`, [key]);
  const row = result.rows[0];
  if (!row) return null;
  if (row.completed_at) return { progress: null, completed: true as const };
  if (row.expires_at.getTime() <= Date.now()) {
    await pool.query(`DELETE FROM booking_progress WHERE session_key = $1`, [row.session_key]);
    return { expired: true as const };
  }
  const payload = decrypt(row);
  const parsed = progressSchema.safeParse(payload);
  if (!parsed.success) {
    await pool.query(`DELETE FROM booking_progress WHERE session_key = $1`, [row.session_key]);
    return null;
  }
  const valid = sanitiseProgress(parsed.data);
  if (recoveryToken && row.session_key !== key) {
    // Move a valid recovery link into this browser's server session; no customer details are put in the URL.
    await saveBookingProgress(sessionId, { ...valid, stage: valid.stage });
    await pool.query(
      `UPDATE booking_progress SET last_activity_at = now(), expires_at = now() + interval '30 minutes', updated_at = now()
       WHERE session_key = $1`,
      [row.session_key],
    );
  } else {
    await pool.query(
      `UPDATE booking_progress SET last_activity_at = now(), expires_at = now() + interval '30 minutes', updated_at = now()
       WHERE session_key = $1`,
      [row.session_key],
    );
  }
  return {
    progress: valid,
    lastActivityAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

export async function completeBookingProgress(sessionId: string, connection?: PoolClient) {
  const database = connection ?? pool;
  if (!database) return;
  await database.query(
    `UPDATE booking_progress SET completed_at = now(), recovery_consent = false, updated_at = now()
     WHERE session_key = $1`,
    [sessionKey(sessionId)],
  );
}

interface RecoveryCandidate extends StoredProgress {}

async function claimRecoveryCandidates() {
  if (!pool) return [];
  const result = await pool.query<RecoveryCandidate>(
    `WITH candidates AS (
       SELECT session_key FROM booking_progress
       WHERE recovery_consent = true
         AND recovery_email_sent_at IS NULL
         AND completed_at IS NULL
         AND expires_at > now()
         AND last_activity_at < now() - interval '5 minutes'
       ORDER BY last_activity_at
       LIMIT 20
       FOR UPDATE SKIP LOCKED
     )
     UPDATE booking_progress AS progress
     SET recovery_email_sent_at = now(), updated_at = now()
     FROM candidates
     WHERE progress.session_key = candidates.session_key
     RETURNING progress.*`,
  );
  return result.rows;
}

export async function sendDueRecoveryEmails() {
  if (env.DEMO_MODE === 'true' || !pool || !env.RESEND_API_KEY || !env.EMAIL_FROM) return;
  const candidates = await claimRecoveryCandidates();
  for (const row of candidates) {
    try {
      const payload = decrypt(row);
      const email = payload.email.trim();
      if (!row.recovery_consent || !payload.recoveryConsent || !payload.recoveryToken || !email) continue;
      const stillAbandoned = await pool.query<{ active: boolean }>(
        `SELECT (completed_at IS NULL
           AND recovery_consent = true
           AND expires_at > now()
           AND last_activity_at < now() - interval '5 minutes') AS active
         FROM booking_progress WHERE session_key = $1`,
        [row.session_key],
      );
      if (!stillAbandoned.rows[0]?.active) continue;
      const url = new URL('/', env.WEB_ORIGIN);
      url.searchParams.set('bookingResume', payload.recoveryToken);
      const stageNames: Record<number, string> = {
        1: 'journey-details',
        2: 'vehicle-option',
        3: 'passenger-details',
        4: 'review-booking',
      };
      const stage = stageNames[payload.stage] ? payload.stage : 1;
      url.searchParams.set('bookingStep', `${stage}/${stageNames[stage]}`);
      await sendAbandonedBookingEmail({
        email,
        name: payload.passengerName.trim(),
        pickup: payload.pickup,
        dropoff: payload.dropoff,
        resumeUrl: url.toString().replace(/%2F/gi, '/'),
      });
    } catch (error) {
      // The email is claimed before dispatch so a transient failure cannot produce duplicate reminders.
      logServerError('Abandoned booking email could not be sent', error);
    }
  }
}

async function cleanupExpiredProgress() {
  if (!pool) return;
  await pool.query(`DELETE FROM booking_progress WHERE expires_at <= now()`);
}

export function startBookingRecoveryWorker() {
  if (!pool) return;
  const timer = setInterval(() => {
    void cleanupExpiredProgress()
      .then(() => sendDueRecoveryEmails())
      .catch((error) => logServerError('Booking recovery worker failed', error));
  }, 60_000);
  timer.unref();
  void cleanupExpiredProgress()
    .then(() => sendDueRecoveryEmails())
    .catch((error) => logServerError('Booking recovery worker failed', error));
}
