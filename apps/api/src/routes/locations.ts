import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
import { PostgresRateLimitStore } from '../middleware/postgresRateLimitStore.js';
import {
  reverseLocation,
  suggestLocations,
  validateLocationOrigin,
} from '../controllers/locationController.js';

export const locationsRouter = Router();

const locationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 45,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('location-search'),
});

locationsRouter.use(locationLimiter, validateLocationOrigin);
locationsRouter.get('/suggest', suggestLocations);
locationsRouter.get('/reverse', reverseLocation);
