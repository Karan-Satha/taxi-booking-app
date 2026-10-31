import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middleware/errors.js';
import { authenticateAccount, registerAccount } from '../services/authService.js';
import type { Account } from '../types/auth.js';
import { loginSchema, registerSchema } from '../validation/auth.js';

function establishSession(request: Request, account: Account): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }

      request.session.user = account;
      request.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

export async function register(request: Request, response: Response, next: NextFunction) {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields and try again.',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  try {
    const account = await registerAccount(parsed.data);
    await establishSession(request, account);
    response.status(201).json({ user: account });
  } catch (error) {
    next(error);
  }
}

export async function login(request: Request, response: Response, next: NextFunction) {
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
    const account = await authenticateAccount(parsed.data);
    await establishSession(request, account);
    response.json({ user: account });
  } catch (error) {
    next(error);
  }
}

export function currentUser(request: Request, response: Response) {
  if (!request.session.user) {
    throw new HttpError(401, 'AUTH_REQUIRED', 'Sign in to view your account.');
  }
  response.json({ user: request.session.user });
}

export async function logout(request: Request, response: Response, next: NextFunction) {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    response.clearCookie('taxi.sid', {
      httpOnly: true,
      secure: request.secure,
      sameSite: 'lax',
      path: '/',
    });
    response.status(204).end();
  });
}
