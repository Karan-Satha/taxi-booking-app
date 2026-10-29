import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { env } from '../config/env.js';
import {
  cancelOwnBooking,
  getOwnBooking,
  listOwnBookings,
  lookupBooking,
} from '../controllers/bookingManagementController.js';
import { createBooking, quoteJourney } from '../controllers/bookingController.js';
import {
  markBookingProgressComplete,
  restoreBookingProgress,
  updateBookingProgress,
} from '../controllers/bookingProgressController.js';
import { requireAccount } from '../middleware/authorization.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

export const bookingsRouter = Router();

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'LOOKUP_RATE_LIMITED',
      message: 'Too many lookup attempts. Please wait 15 minutes and try again.',
    },
  },
});
const progressLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

bookingsRouter.get('/', requireAccount, listOwnBookings);
bookingsRouter.get('/progress', progressLimiter, restoreBookingProgress);
bookingsRouter.put('/progress', progressLimiter, requireTrustedOrigin, updateBookingProgress);
bookingsRouter.post('/progress/complete', progressLimiter, requireTrustedOrigin, markBookingProgressComplete);
bookingsRouter.get('/:id', requireAccount, getOwnBooking);
bookingsRouter.delete('/:id', requireAccount, requireTrustedOrigin, cancelOwnBooking);

bookingsRouter.post(
  '/lookup',
  lookupLimiter,
  requireTrustedOrigin,
  lookupBooking,
);

bookingsRouter.post(
  '/quote',
  quoteLimiter,
  (request, response, next) => {
    if (request.get('origin') !== env.WEB_ORIGIN) {
      response
        .status(403)
        .json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This request origin is not allowed.' } });
      return;
    }
    next();
  },
  quoteJourney,
);

bookingsRouter.post(
  '/',
  bookingLimiter,
  (request, response, next) => {
    if (request.get('origin') !== env.WEB_ORIGIN) {
      response
        .status(403)
        .json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This request origin is not allowed.' } });
      return;
    }
    next();
  },
  createBooking,
);
