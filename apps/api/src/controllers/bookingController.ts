import type { NextFunction, Request, Response } from 'express';
import { saveBooking } from '../services/bookingService.js';
import { createQuote, signQuote } from '../services/quoteService.js';
import { bookingSchema, quoteSchema } from '../validation/booking.js';

export async function quoteJourney(request: Request, response: Response, next: NextFunction) {
  const parsed = quoteSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Enter valid pickup, destination, date and time.',
          fields: parsed.error.flatten().fieldErrors,
        },
      });
    return;
  }
  try {
    const quote = await createQuote(parsed.data);
    response.json({ quote, quoteToken: signQuote(quote) });
  } catch (error) {
    next(error);
  }
}

export async function createBooking(request: Request, response: Response, next: NextFunction) {
  const parsed = bookingSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Check your passenger details and try again.',
          fields: parsed.error.flatten().fieldErrors,
        },
      });
    return;
  }
  try {
    const booking = await saveBooking(parsed.data, request.session.user, request.sessionID);
    response.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
}
