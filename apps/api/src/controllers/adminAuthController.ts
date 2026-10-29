import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middleware/errors.js';
import { authenticateAdmin } from '../services/adminAuthService.js';
import type { AdminAccount } from '../types/auth.js';
import { loginSchema } from '../validation/auth.js';

function establishAdminSession(request: Request, admin: AdminAccount) {
  return new Promise<void>((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) return reject(error);
      request.session.admin = admin;
      request.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

export async function adminLogin(request: Request, response: Response, next: NextFunction) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid email and password.',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }
  try {
    const admin = await authenticateAdmin(parsed.data);
    await establishAdminSession(request, admin);
    response.setHeader('Cache-Control', 'private, no-store');
    response.json({ admin });
  } catch (error) {
    next(error);
  }
}

export function currentAdmin(request: Request, response: Response) {
  if (!request.session.admin) throw new HttpError(401, 'ADMIN_AUTH_REQUIRED', 'Sign in to access the admin panel.');
  response.setHeader('Cache-Control', 'private, no-store');
  response.json({ admin: request.session.admin });
}

export function adminLogout(request: Request, response: Response, next: NextFunction) {
  request.session.destroy((error) => {
    if (error) return next(error);
    response.clearCookie('taxi.admin.sid', {
      httpOnly: true,
      secure: request.secure,
      sameSite: 'lax',
      path: '/',
    });
    response.status(204).end();
  });
}
