import type { RequestHandler } from 'express';
import { pool } from '../config/database.js';
import { HttpError } from './errors.js';

export const requireAccount: RequestHandler = async (request, _response, next) => {
  if (!request.session.user) {
    next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to access this resource.'));
    return;
  }
  if (!pool) {
    next(new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Account services are not configured yet.'));
    return;
  }
  try {
    const result = await pool.query<{ status: string; role: string }>(
      'SELECT status, role FROM users WHERE id = $1::uuid',
      [request.session.user.userId],
    );
    if (result.rows[0]?.status !== 'active' || result.rows[0]?.role !== 'customer') {
      next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to access this resource.'));
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = async (request, _response, next) => {
  _response.setHeader('Cache-Control', 'private, no-store');
  if (!request.session.admin) {
    next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to access this resource.'));
    return;
  }
  if (!pool) {
    next(new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Administrator services are not configured yet.'));
    return;
  }
  try {
    const result = await pool.query<{ role: string; status: string }>(
      'SELECT role, status FROM admins WHERE id = $1::uuid',
      [request.session.admin.adminId],
    );
    if (result.rows[0]?.status !== 'active' || result.rows[0]?.role !== 'admin') {
      next(new HttpError(403, 'ADMIN_REQUIRED', 'Administrator access is required.'));
      return;
    }
  } catch (error) {
    next(error);
    return;
  }
  if (request.session.admin.role !== 'admin') {
    next(new HttpError(403, 'ADMIN_REQUIRED', 'Administrator access is required.'));
    return;
  }
  next();
};
