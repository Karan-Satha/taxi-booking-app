import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { Router } from 'express';
import { adminLogin, adminLogout, currentAdmin } from '../controllers/adminAuthController.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';
import { PostgresRateLimitStore } from '../middleware/postgresRateLimitStore.js';

export const adminAuthRouter = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('admin-login-ip'),
});

const adminAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    return email
      ? createHash('sha256').update(email).digest('hex')
      : `invalid:${ipKeyGenerator(request.ip ?? '0.0.0.0')}`;
  },
  store: new PostgresRateLimitStore('admin-login-account'),
});

adminAuthRouter.get('/me', currentAdmin);
adminAuthRouter.post('/login', adminLoginLimiter, adminAccountLimiter, requireTrustedOrigin, adminLogin);
adminAuthRouter.post('/logout', requireTrustedOrigin, adminLogout);
