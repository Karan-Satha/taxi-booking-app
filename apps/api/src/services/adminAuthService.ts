import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { HttpError } from '../middleware/errors.js';
import type { AdminAccount, LoginInput } from '../types/auth.js';

interface AdminRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  role: 'admin';
  status: 'active' | 'disabled';
}

function database() {
  if (!pool) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Administrator services are not configured.');
  return pool;
}

export async function authenticateAdmin(input: LoginInput): Promise<AdminAccount> {
  const result = await database().query<AdminRow>(
    `SELECT id, first_name, last_name, email, password_hash, role, status
     FROM admins WHERE lower(email) = $1 AND role = 'admin' AND status = 'active' LIMIT 1`,
    [input.email],
  );
  const admin = result.rows[0];
  const matches = admin ? await bcrypt.compare(input.password, admin.password_hash) : false;
  if (!admin || !matches) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return {
    adminId: admin.id,
    name: [admin.first_name, admin.last_name].filter(Boolean).join(' '),
    email: admin.email,
    role: 'admin',
  };
}
