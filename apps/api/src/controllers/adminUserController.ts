import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import {
  createManagedUser,
  disableManagedUser,
  getManagedUser,
  listManagedUsers,
  updateManagedUser,
} from '../services/adminUserService.js';
import { uuidParamSchema } from '../validation/vehicles.js';

const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+/, 'Include at least one letter and one number.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long.');
const userFields = {
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(''),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(24),
  role: z.literal('customer').default('customer'),
  status: z.enum(['active', 'disabled']).default('active'),
};
const createSchema = z.object({ ...userFields, password: passwordSchema });
const patchSchema = z.object({
  firstName: userFields.firstName.optional(),
  lastName: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(),
  phone: userFields.phone.optional(),
  role: z.literal('customer').optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

function invalid(response: Response, fields: unknown) {
  response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the user details.', fields } });
}

export async function listUsers(request: Request, response: Response, next: NextFunction) {
  const limit = Number(request.query.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return invalid(response, { limit: ['Use a limit from 1 to 500.'] });
  }
  try {
    response.json({ users: await listManagedUsers(limit) });
  } catch (error) {
    next(error);
  }
}

export async function createUser(request: Request, response: Response, next: NextFunction) {
  const parsed = createSchema.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error.flatten().fieldErrors);
  try {
    response.status(201).json({ user: await createManagedUser(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getUser(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid user ID.'] });
  try {
    response.json({ user: await getManagedUser(id.data) });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  const parsed = patchSchema.safeParse(request.body);
  if (!id.success || !parsed.success) {
    const fields = parsed.success ? { id: ['Enter a valid user ID.'] } : parsed.error.flatten().fieldErrors;
    return invalid(response, fields);
  }
  try {
    response.json({ user: await updateManagedUser(id.data, parsed.data) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      next(new HttpError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.'));
      return;
    }
    next(error);
  }
}

export async function disableUser(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid user ID.'] });
  try {
    response.json({ user: await disableManagedUser(id.data) });
  } catch (error) {
    next(error);
  }
}
