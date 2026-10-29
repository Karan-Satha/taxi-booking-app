import { rateLimit } from 'express-rate-limit';
import { Router, type RequestHandler } from 'express';
import { env } from '../config/env.js';
import { currentUser, login, logout, register } from '../controllers/authController.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
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
authRouter.post('/login', loginLimiter, requireTrustedOrigin, login);
authRouter.post('/logout', requireTrustedOrigin, logout);
