import type { NextFunction, Request, Response } from 'express';
import {
  completeBookingProgress,
  getBookingProgress,
  saveBookingProgress,
} from '../services/bookingProgressService.js';

export async function restoreBookingProgress(request: Request, response: Response, next: NextFunction) {
  try {
    request.session.bookingProgressInitialized = true;
    const rawToken = request.query.resumeToken;
    const recoveryToken = typeof rawToken === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(rawToken)
      ? rawToken
      : undefined;
    const result = await getBookingProgress(request.sessionID, recoveryToken);
    if (result && 'expired' in result) {
      response.status(410).json({ progress: null, expired: true });
      return;
    }
    response.json(result ?? { progress: null });
  } catch (error) {
    next(error);
  }
}

export async function updateBookingProgress(request: Request, response: Response, next: NextFunction) {
  try {
    request.session.bookingProgressInitialized = true;
    const result = await saveBookingProgress(request.sessionID, request.body);
    response.json(result ?? { saved: false });
  } catch (error) {
    next(error);
  }
}

export async function markBookingProgressComplete(request: Request, response: Response, next: NextFunction) {
  try {
    await completeBookingProgress(request.sessionID);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
}
