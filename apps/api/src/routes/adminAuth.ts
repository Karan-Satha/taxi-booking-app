import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { adminLogin, adminLogout, currentAdmin } from '../controllers/adminAuthController.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

export const adminAuthRouter = Router();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

adminAuthRouter.get('/me', currentAdmin);
adminAuthRouter.post('/login', adminLoginLimiter, requireTrustedOrigin, adminLogin);
adminAuthRouter.post('/logout', requireTrustedOrigin, adminLogout);
