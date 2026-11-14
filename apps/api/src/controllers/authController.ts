import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middleware/errors.js';
import { authenticateAccount, createPasswordReset, registerAccount, resetCustomerPassword } from '../services/authService.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { logServerError } from '../middleware/errors.js';
import type { Account } from '../types/auth.js';
import { loginSchema, passwordResetRequestSchema, passwordResetSchema, registerSchema } from '../validation/auth.js';
import { friendlyValidationFields } from '../validation/messages.js';
import { env } from '../config/env.js';

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
        fields: friendlyValidationFields(parsed.error.issues),
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
        fields: friendlyValidationFields(parsed.error.issues),
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

export async function requestPasswordReset(request: Request, response: Response, next: NextFunction) {
  const parsed = passwordResetRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid email address.',
        fields: friendlyValidationFields(parsed.error.issues),
      },
    });
    return;
  }
  try {
    const demoMode = env.DEMO_MODE === 'true' || !env.RESEND_API_KEY || !env.EMAIL_FROM;
    if (!demoMode) {
      const reset = await createPasswordReset(parsed.data.email);
      if (reset) {
        try {
          await sendPasswordResetEmail(reset);
        } catch (error) {
          logServerError('Password reset email could not be sent', error);
        }
      }
    }
    response.status(202).json({
      message: 'If an active account matches that email, a reset link has been sent.',
      demoMode,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(request: Request, response: Response, next: NextFunction) {
  const parsed = passwordResetSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check your new password and try again.',
        fields: friendlyValidationFields(parsed.error.issues),
      },
    });
    return;
  }
  try {
    await resetCustomerPassword(parsed.data.token, parsed.data.password);
    response.json({ message: 'Your password has been updated. You can now sign in.' });
  } catch (error) {
    next(error);
  }
}
