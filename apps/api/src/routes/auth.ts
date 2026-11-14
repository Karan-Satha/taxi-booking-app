import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { env } from '../config/env.js';
import { currentUser, login, logout, register, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { PostgresRateLimitStore } from '../middleware/postgresRateLimitStore.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('customer-login-ip'),
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    if (!email) return `invalid:${ipKeyGenerator(request.ip ?? '0.0.0.0')}`;
    return createHash('sha256').update(email).digest('hex');
  },
  store: new PostgresRateLimitStore('customer-login-account'),
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('customer-register'),
});

const passwordResetIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('password-reset-ip'),
});

const passwordResetAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    return email
      ? createHash('sha256').update(email).digest('hex')
      : `invalid:${ipKeyGenerator(request.ip ?? '0.0.0.0')}`;
  },
  store: new PostgresRateLimitStore('password-reset-account'),
});

const passwordUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('password-update'),
});

const requireTrustedOrigin: RequestHandler = (request, response, next) => {
  if (request.get('origin') !== env.WEB_ORIGIN) {
    response.status(403).json({
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This request origin is not allowed.' },
    });
    return;
  }
  next();
};

authRouter.get('/me', currentUser);
authRouter.post('/register', registrationLimiter, requireTrustedOrigin, register);
authRouter.post('/login', loginLimiter, loginAccountLimiter, requireTrustedOrigin, login);
authRouter.post('/logout', requireTrustedOrigin, logout);
authRouter.post('/password/forgot', passwordResetIpLimiter, passwordResetAccountLimiter, requireTrustedOrigin, requestPasswordReset);
authRouter.post('/password/reset', passwordUpdateLimiter, requireTrustedOrigin, resetPassword);
