import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { pool } from '../config/database.js';
import { HttpError } from '../middleware/errors.js';
import type { Account, LoginInput, RegisterInput } from '../types/auth.js';

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password_hash?: string;
  role: 'customer';
  status?: 'active' | 'disabled';
}

function requireDatabase() {
  if (!pool) {
    throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Account services are not configured yet.');
  }
  return pool;
}

function toAccount(user: UserRow): Account {
  return {
    userId: user.id,
    name: [user.first_name, user.last_name].filter(Boolean).join(' '),
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

export async function registerAccount(input: RegisterInput): Promise<Account> {
  const database = requireDatabase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const phone = parsePhoneNumberFromString(`${input.countryCode}${input.phone}`)?.number;
  if (!phone) throw new HttpError(400, 'PHONE_INVALID', 'Enter a valid phone number with country code.');
  const [firstName, ...lastNameParts] = input.name.trim().split(/\s+/);

  try {
    const result = await database.query<UserRow>(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'customer')
       RETURNING id, first_name, last_name, email, phone, role`,
      [firstName, lastNameParts.join(' '), input.email, phone, passwordHash],
    );
    return toAccount(result.rows[0]);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function authenticateAccount(input: LoginInput): Promise<Account> {
  const database = requireDatabase();
  const result = await database.query<UserRow>(
    `SELECT id, first_name, last_name, email, phone, password_hash, role, status
     FROM users
     WHERE LOWER(email) = $1 AND status = 'active' AND role = 'customer'
     LIMIT 1`,
    [input.email],
  );
  const user = result.rows[0];
  const passwordMatches = user?.password_hash
    ? await bcrypt.compare(input.password, user.password_hash)
    : false;

  if (!user || !passwordMatches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  return toAccount(user);
}

export async function createPasswordReset(email: string) {
  const database = requireDatabase();
  const result = await database.query<{ id: string; email: string; first_name: string; last_name: string }>(
    `SELECT id, email, first_name, last_name FROM users
     WHERE LOWER(email) = $1 AND status = 'active' AND role = 'customer' LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  if (!user) return null;

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await database.query('UPDATE customer_password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
  await database.query(
    `INSERT INTO customer_password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '20 minutes')`,
    [user.id, tokenHash],
  );
  return { token, email: user.email, name: [user.first_name, user.last_name].filter(Boolean).join(' ') };
}

export async function resetCustomerPassword(token: string, password: string) {
  const database = requireDatabase();
  const client = await database.connect();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    await client.query('BEGIN');
    const result = await client.query<{ user_id: string }>(
      `SELECT resets.user_id FROM customer_password_resets AS resets
       JOIN users ON users.id = resets.user_id
       WHERE resets.token_hash = $1 AND resets.expires_at > now() AND resets.used_at IS NULL
         AND users.status = 'active' AND users.role = 'customer'
       FOR UPDATE OF resets`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) throw new HttpError(400, 'RESET_LINK_INVALID', 'This password reset link is invalid or expired.');

    const passwordHash = await bcrypt.hash(password, 12);
    await client.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [row.user_id, passwordHash]);
    await client.query(
      'UPDATE customer_password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [row.user_id],
    );
    await client.query(`DELETE FROM user_sessions WHERE sess -> 'user' ->> 'userId' = $1`, [row.user_id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
