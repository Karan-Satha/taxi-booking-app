import { rateLimit } from 'express-rate-limit';
import { Router } from 'express';
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
});

locationsRouter.use(locationLimiter, validateLocationOrigin);
locationsRouter.get('/suggest', suggestLocations);
locationsRouter.get('/reverse', reverseLocation);
