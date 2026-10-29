import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { HttpError } from '../middleware/errors.js';

export interface ManagedUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: 'customer';
  status: 'active' | 'disabled';
}

export type ManagedUserPatch = Partial<Omit<ManagedUserInput, 'password'>>;

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: 'customer';
  status: 'active' | 'disabled';
  created_at: Date;
  updated_at: Date;
}

function database() {
  if (!pool) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'User management requires a database.');
  return pool;
}

function toUser(row: UserRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const columns = 'id, first_name, last_name, email, phone, role, status, created_at, updated_at';

export async function listManagedUsers(limit: number) {
  const result = await database().query<UserRow>(
    `SELECT ${columns} FROM users ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(toUser);
}

export async function getManagedUser(id: string) {
  const result = await database().query<UserRow>(`SELECT ${columns} FROM users WHERE id = $1::uuid`, [id]);
  if (!result.rows[0]) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  return toUser(result.rows[0]);
}

export async function createManagedUser(input: ManagedUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const result = await database().query<UserRow>(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${columns}`,
      [input.firstName, input.lastName, input.email, input.phone, passwordHash, input.role, input.status],
    );
    return toUser(result.rows[0]);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }
}

const updateColumns: Record<keyof ManagedUserPatch, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  role: 'role',
  status: 'status',
};

export async function updateManagedUser(id: string, patch: ManagedUserPatch) {
  const entries = Object.entries(patch) as Array<[keyof ManagedUserPatch, ManagedUserPatch[keyof ManagedUserPatch]]>;
  if (!entries.length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one user field to update.');
  const assignments = entries.map(([key], index) => `${updateColumns[key]} = $${index + 2}`);
  const result = await database().query<UserRow>(
    `UPDATE users SET ${assignments.join(', ')}, updated_at = now()
     WHERE id = $1::uuid RETURNING ${columns}`,
    [id, ...entries.map(([, value]) => value)],
  );
  if (!result.rows[0]) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  return toUser(result.rows[0]);
}

export async function disableManagedUser(id: string) {
  const result = await database().query<UserRow>(
    `UPDATE users SET status = 'disabled', updated_at = now()
     WHERE id = $1::uuid RETURNING ${columns}`,
    [id],
  );
  if (!result.rows[0]) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  return toUser(result.rows[0]);
}
