import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  cancelBookingAsAdmin,
  cancelBookingForUser,
  acceptBooking,
  rejectBooking,
  getBookingById,
  getBookingByReferenceAndEmail,
  getBookingForUser,
  listAdminBookings,
  listBookingsForUser,
  updateBookingStatus,
  retryAcceptanceEmail,
} from '../services/bookingManagementService.js';
import { uuidParamSchema } from '../validation/vehicles.js';

const statusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
});

const bookingLookupSchema = z.object({
  bookingReference: z.string().trim().min(4).max(24).regex(/^[a-zA-Z0-9-]+$/).transform((value) => value.toUpperCase()),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

function invalid(response: Response, fields: unknown) {
  response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the booking request.', fields } });
}

function listLimit(request: Request, response: Response): number | null {
  const limit = Number(request.query.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    invalid(response, { limit: ['Use a limit from 1 to 500.'] });
    return null;
  }
  return limit;
}

export async function listOwnBookings(request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'private, no-store');
  const limit = listLimit(request, response);
  if (limit === null) return;
  try {
    const page = Number(request.query.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) {
      return invalid(response, { page: ['Use a valid page number.'] });
    }
    const result = await listBookingsForUser(request.session.user!.userId, limit, (page - 1) * limit);
    response.json({ ...result, page, pageSize: limit });
  } catch (error) {
    next(error);
  }
}

export async function getOwnBooking(request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'private, no-store');
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    response.json({ booking: await getBookingForUser(id.data, request.session.user!.userId) });
  } catch (error) {
    next(error);
  }
}

export async function lookupBooking(request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'no-store, private');
  const parsed = bookingLookupSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid booking reference and email address.',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
  }

  try {
    const booking = await getBookingByReferenceAndEmail(parsed.data.bookingReference, parsed.data.email);
    if (!booking) {
      return response.status(404).json({
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'We couldn’t find a booking with those details. Check the reference and email, then try again.',
        },
      });
    }

    response.json({
      booking,
      support: {
        email: env.SUPPORT_EMAIL ?? null,
        phone: env.SUPPORT_PHONE ?? null,
        cancellationPolicyUrl: env.CANCELLATION_POLICY_URL ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelOwnBooking(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    response.json({ booking: await cancelBookingForUser(id.data, request.session.user!.userId) });
  } catch (error) {
    next(error);
  }
}

export async function listBookingsAdmin(request: Request, response: Response, next: NextFunction) {
  const limit = listLimit(request, response);
  if (limit === null) return;
  try {
    const status = typeof request.query.status === 'string' ? request.query.status : undefined;
    const validStatuses = ['pending', 'accepted', 'rejected', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return invalid(response, { status: ['Choose a valid booking status.'] });
    }
    const page = Number(request.query.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) {
      return invalid(response, { page: ['Use a valid page number.'] });
    }
    const result = await listAdminBookings(limit, status, (page - 1) * limit);
    response.json({ ...result, page, pageSize: limit });
  } catch (error) {
    next(error);
  }
}

export async function acceptBookingAdmin(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    const result = await acceptBooking(id.data);
    response.json(result);
  } catch (error) {
    next(error);
  }
}

export async function rejectBookingAdmin(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    response.json({ booking: await rejectBooking(id.data) });
  } catch (error) {
    next(error);
  }
}

export async function retryBookingAcceptanceEmail(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    response.json({ emailStatus: await retryAcceptanceEmail(id.data) });
  } catch (error) {
    next(error);
  }
}

export async function getBookingAdmin(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    response.json({ booking: await getBookingById(id.data) });
  } catch (error) {
    next(error);
  }
}

export async function updateBookingAdmin(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  const parsed = statusSchema.safeParse(request.body);
  if (!id.success || !parsed.success) {
    const fields = parsed.success ? { id: ['Enter a valid booking ID.'] } : parsed.error.flatten().fieldErrors;
    return invalid(response, fields);
  }
  try {
    response.json({ booking: await updateBookingStatus(id.data, parsed.data.status, parsed.data.paymentStatus) });
  } catch (error) {
    next(error);
  }
}

export async function cancelBookingAdmin(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid booking ID.'] });
  try {
    response.json({ booking: await cancelBookingAsAdmin(id.data) });
  } catch (error) {
    next(error);
  }
}
