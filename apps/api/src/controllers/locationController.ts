import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';
import { reverseGeocode, searchAddresses } from '../services/locationService.js';
import { reverseLocationSchema, searchLocationSchema } from '../validation/location.js';

export async function suggestLocations(request: Request, response: Response, next: NextFunction) {
  const parsed = searchLocationSchema.safeParse(request.query);
  if (!parsed.success) {
    response
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Enter at least three characters.' } });
    return;
  }
  try {
    const suggestions = await searchAddresses(parsed.data.q);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.json({ suggestions });
  } catch (error) {
    next(error);
  }
}

export async function reverseLocation(request: Request, response: Response, next: NextFunction) {
  const parsed = reverseLocationSchema.safeParse(request.query);
  if (!parsed.success) {
    response
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Enter valid map coordinates.' } });
    return;
  }
  try {
    const address = await reverseGeocode(parsed.data.lat, parsed.data.lon);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.json({ address });
  } catch (error) {
    next(error);
  }
}

export function validateLocationOrigin(request: Request, _response: Response, next: NextFunction) {
  const origin = request.get('origin');
  if (origin && origin !== env.WEB_ORIGIN) {
    next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.'));
    return;
  }
  next();
}
