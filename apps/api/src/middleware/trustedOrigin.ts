import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

export const requireTrustedOrigin: RequestHandler = (request, response, next) => {
  if (request.get('origin') !== env.WEB_ORIGIN) {
    response.status(403).json({
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This request origin is not allowed.' },
    });
    return;
  }
  next();
};
