import bcrypt from 'bcryptjs';
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
  const phone = `${input.countryCode}-${input.phone}`;
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
