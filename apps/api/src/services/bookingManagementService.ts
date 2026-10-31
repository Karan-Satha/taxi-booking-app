import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

interface FareBreakdownLine {
  label: string;
  amount: number;
}

interface BookingRow {
  id: string;
  booking_reference: string;
  user_id: string | null;
  vehicle_id: string;
  vehicle_name: string | null;
  vehicle_category: string | null;
  vehicle_image_url: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  pickup_address: string;
  pickup_longitude: string | null;
  pickup_latitude: string | null;
  dropoff_address: string;
  dropoff_longitude: string | null;
  dropoff_latitude: string | null;
  pickup_at: Date;
  pickup_timezone: string;
  journey_distance_miles: string | null;
  estimated_duration_seconds: number | null;
  passenger_count: number;
  luggage_count: number;
  special_instructions: string;
  total_fare: string;
  currency: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  created_at: Date;
  updated_at: Date;
}

function database() {
  if (!pool) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Booking history requires a database.');
  return pool;
}

const bookingColumns = `b.id, b.booking_reference, b.user_id, b.vehicle_id, v.name AS vehicle_name,
  v.category AS vehicle_category, v.image_url AS vehicle_image_url,
  v.passenger_capacity, v.luggage_capacity,
  b.customer_name, b.customer_email, b.customer_phone, b.pickup_address, b.pickup_longitude, b.pickup_latitude,
  b.dropoff_address, b.dropoff_longitude, b.dropoff_latitude, b.pickup_at, b.pickup_timezone,
  b.journey_distance_miles, b.estimated_duration_seconds, b.passenger_count, b.luggage_count,
  b.special_instructions, b.total_fare, b.currency, b.status, b.payment_status, b.created_at, b.updated_at`;

function toBooking(row: BookingRow) {
  return {
    id: row.id,
    bookingReference: row.booking_reference,
    userId: row.user_id,
    vehicleId: row.vehicle_id,
    vehicleName: row.vehicle_name,
    vehicle: {
      name: row.vehicle_name,
      category: row.vehicle_category,
      imageUrl: row.vehicle_image_url,
      passengerCapacity: row.passenger_capacity,
      luggageCapacity: row.luggage_capacity,
    },
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    pickup: {
      address: row.pickup_address,
      coordinates:
        row.pickup_longitude === null || row.pickup_latitude === null
          ? null
          : [Number(row.pickup_longitude), Number(row.pickup_latitude)],
    },
    dropoff: {
      address: row.dropoff_address,
      coordinates:
        row.dropoff_longitude === null || row.dropoff_latitude === null
          ? null
          : [Number(row.dropoff_longitude), Number(row.dropoff_latitude)],
    },
    pickupAt: row.pickup_at,
    pickupTimezone: row.pickup_timezone,
    distanceMiles: row.journey_distance_miles === null ? null : Number(row.journey_distance_miles),
    durationSeconds: row.estimated_duration_seconds,
    passengers: row.passenger_count,
    luggage: row.luggage_count,
    instructions: row.special_instructions,
    fare: { amount: Number(row.total_fare), currency: row.currency.trim() },
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBookingsForUser(userId: string, limit: number, offset = 0) {
  const db = database();
  const [result, count] = await Promise.all([
    db.query<BookingRow>(
      `SELECT ${bookingColumns} FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id
       WHERE b.user_id = $1::uuid ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    db.query<{ total: string }>('SELECT count(*)::text AS total FROM bookings WHERE user_id = $1::uuid', [userId]),
  ]);
  return { bookings: result.rows.map(toBooking), total: Number(count.rows[0]?.total ?? 0) };
}

export async function getBookingForUser(id: string, userId: string) {
  const result = await database().query<BookingRow>(
    `SELECT ${bookingColumns} FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.id = $1::uuid AND b.user_id = $2::uuid`,
    [id, userId],
  );
  if (!result.rows[0]) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  return toBooking(result.rows[0]);
}

export async function getBookingById(id: string) {
  const result = await database().query<BookingRow>(
    `SELECT ${bookingColumns} FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.id = $1::uuid`,
    [id],
  );
  if (!result.rows[0]) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  return toBooking(result.rows[0]);
}

export async function getBookingByReferenceAndEmail(reference: string, email: string) {
  const result = await database().query<{
    booking_reference: string;
    created_at: Date;
    status: BookingStatus;
    payment_status: PaymentStatus;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    pickup_address: string;
    dropoff_address: string;
    pickup_at: Date;
    pickup_timezone: string;
    journey_distance_miles: string | null;
    estimated_duration_seconds: number | null;
    passenger_count: number;
    luggage_count: number;
    special_instructions: string;
    total_fare: string;
    currency: string;
    fare_breakdown: FareBreakdownLine[] | null;
    vehicle_name: string | null;
    vehicle_category: string | null;
    vehicle_image_url: string | null;
    passenger_capacity: number | null;
    luggage_capacity: number | null;
  }>(
    `SELECT b.booking_reference, b.created_at, b.status, b.payment_status,
            b.customer_name, b.customer_email, b.customer_phone,
            b.pickup_address, b.dropoff_address, b.pickup_at, b.pickup_timezone,
            b.journey_distance_miles, b.estimated_duration_seconds,
            b.passenger_count, b.luggage_count, b.special_instructions,
            b.total_fare, b.currency, b.fare_breakdown,
            v.name AS vehicle_name, v.category AS vehicle_category, v.image_url AS vehicle_image_url,
            v.passenger_capacity, v.luggage_capacity
     FROM bookings b
     LEFT JOIN vehicles v ON v.id = b.vehicle_id
     WHERE b.booking_reference = $1 AND lower(b.customer_email) = $2
     LIMIT 1`,
    [reference, email],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    bookingReference: row.booking_reference,
    createdAt: row.created_at,
    status: row.status,
    paymentStatus: row.payment_status,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    pickup: { address: row.pickup_address },
    dropoff: { address: row.dropoff_address },
    pickupAt: row.pickup_at,
    pickupTimezone: row.pickup_timezone,
    distanceMiles: row.journey_distance_miles === null ? null : Number(row.journey_distance_miles),
    durationSeconds: row.estimated_duration_seconds,
    passengers: row.passenger_count,
    luggage: row.luggage_count,
    instructions: row.special_instructions,
    fare: { amount: Number(row.total_fare), currency: row.currency.trim() },
    fareBreakdown: row.fare_breakdown,
    vehicle: {
      name: row.vehicle_name,
      category: row.vehicle_category,
      imageUrl: row.vehicle_image_url,
      passengerCapacity: row.passenger_capacity,
      luggageCapacity: row.luggage_capacity,
    },
  };
}

export async function cancelBookingForUser(id: string, userId: string) {
  const result = await database().query<BookingRow>(
    `WITH changed AS (
       UPDATE bookings b SET status = 'cancelled', updated_at = now()
       WHERE b.id = $1::uuid AND b.user_id = $2::uuid AND b.status IN ('pending', 'confirmed')
       RETURNING b.id
     )
     SELECT ${bookingColumns} FROM changed c
     JOIN bookings b ON b.id = c.id LEFT JOIN vehicles v ON v.id = b.vehicle_id`,
    [id, userId],
  );
  if (!result.rows[0]) {
    throw new HttpError(
      404,
      'BOOKING_NOT_FOUND_OR_CANCELLABLE',
      'Booking was not found or cannot be cancelled.',
    );
  }
  return toBooking(result.rows[0]);
}

export async function listAllBookings(limit: number) {
  const result = await database().query<BookingRow>(
    `SELECT ${bookingColumns} FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id
     ORDER BY b.created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(toBooking);
}

export async function listAdminBookings(limit: number, status?: string, offset = 0) {
  const db = database();
  const [result, count] = await Promise.all([
    db.query<BookingRow & { acceptance_email_status: string | null }>(
    `SELECT ${bookingColumns}, delivery.status AS acceptance_email_status
     FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id
     LEFT JOIN admin_booking_email_deliveries delivery ON delivery.booking_id = b.id
     WHERE ($2::text IS NULL OR b.status = $2)
     ORDER BY b.created_at DESC LIMIT $1 OFFSET $3`,
    [limit, status ?? null, offset],
    ),
    db.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM bookings WHERE ($1::text IS NULL OR status = $1)',
      [status ?? null],
    ),
  ]);
  return {
    bookings: result.rows.map((row) => ({ ...toBooking(row), acceptanceEmailStatus: row.acceptance_email_status })),
    total: Number(count.rows[0]?.total ?? 0),
  };
}

interface AcceptanceEmailRow {
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_at: Date;
  pickup_timezone: string;
  journey_distance_miles: string | null;
  estimated_duration_seconds: number | null;
  vehicle_name: string;
  vehicle_category: string;
  total_fare: string;
  currency: string;
}

async function deliverAcceptanceEmail(bookingId: string) {
  const connection = await database().connect();
  try {
    const claim = await connection.query(
      `UPDATE admin_booking_email_deliveries
       SET status = 'sending', attempts = attempts + 1, last_error = NULL, updated_at = now()
       WHERE booking_id = $1::uuid AND (status IN ('queued', 'failed')
         OR (status = 'sending' AND updated_at < now() - interval '5 minutes'))
       RETURNING booking_id`,
      [bookingId],
    );
    if (!claim.rowCount) {
      const state = await connection.query<{ status: string }>(
        'SELECT status FROM admin_booking_email_deliveries WHERE booking_id = $1::uuid',
        [bookingId],
      );
      return state.rows[0]?.status ?? 'unavailable';
    }

    if (env.DEMO_MODE === 'true') {
      await connection.query(
        `UPDATE admin_booking_email_deliveries
         SET status = 'demo', last_error = 'Demo mode: email delivery is disabled.', updated_at = now()
         WHERE booking_id = $1::uuid AND status = 'sending'`,
        [bookingId],
      );
      console.info('Demo notification recorded', { type: 'booking_accepted' });
      return 'demo';
    }

    const booking = await connection.query<AcceptanceEmailRow>(
      `SELECT b.booking_reference, b.customer_name, b.customer_email, b.pickup_address,
              b.dropoff_address, b.pickup_at, b.pickup_timezone, b.journey_distance_miles,
              b.estimated_duration_seconds, v.name AS vehicle_name, v.category AS vehicle_category,
              b.total_fare, b.currency
       FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id
       WHERE b.id = $1::uuid AND b.status = 'accepted'`,
      [bookingId],
    );
    const row = booking.rows[0];
    if (!row) throw new HttpError(409, 'BOOKING_NOT_ACCEPTED', 'Only accepted bookings can receive this email.');

    const { sendBookingAcceptedEmail } = await import('./emailService.js');
    const delivered = await sendBookingAcceptedEmail({
      bookingReference: row.booking_reference,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      pickup: row.pickup_address,
      dropoff: row.dropoff_address,
      pickupAt: row.pickup_at,
      timezone: row.pickup_timezone,
      distanceMiles: row.journey_distance_miles === null ? null : Number(row.journey_distance_miles),
      durationSeconds: row.estimated_duration_seconds,
      vehicleName: row.vehicle_name,
      vehicleCategory: row.vehicle_category,
      fare: Number(row.total_fare),
      currency: row.currency.trim(),
    });
    if (!delivered) throw new Error('Email service is not configured.');
    await connection.query(
      `UPDATE admin_booking_email_deliveries
       SET status = 'sent', sent_at = now(), last_error = NULL, updated_at = now()
       WHERE booking_id = $1::uuid`,
      [bookingId],
    );
    return 'sent';
  } catch (error) {
    await connection.query(
      `UPDATE admin_booking_email_deliveries
       SET status = 'failed', last_error = $2, updated_at = now()
       WHERE booking_id = $1::uuid AND status = 'sending'`,
      [bookingId, error instanceof Error ? error.message.slice(0, 500) : 'Email delivery failed.'],
    );
    return 'failed';
  } finally {
    connection.release();
  }
}

export async function acceptBooking(id: string) {
  const connection = await database().connect();
  let booking: BookingRow | undefined;
  try {
    await connection.query('BEGIN');
    const changed = await connection.query<{ id: string }>(
      `UPDATE bookings SET status = 'accepted', updated_at = now()
       WHERE id = $1::uuid AND status = 'pending' RETURNING id`,
      [id],
    );
    if (!changed.rows[0]) {
      const existing = await connection.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1::uuid', [id]);
      if (!existing.rows[0]) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      throw new HttpError(409, 'INVALID_BOOKING_STATUS', `This booking is already ${existing.rows[0].status}.`);
    }
    await connection.query(
      `INSERT INTO admin_booking_email_deliveries (booking_id, status)
       VALUES ($1::uuid, 'queued') ON CONFLICT (booking_id) DO NOTHING`,
      [id],
    );
    const result = await connection.query<BookingRow>(
      `SELECT ${bookingColumns} FROM bookings b LEFT JOIN vehicles v ON v.id = b.vehicle_id WHERE b.id = $1::uuid`,
      [id],
    );
    booking = result.rows[0];
    await connection.query('COMMIT');
  } catch (error) {
    try { await connection.query('ROLLBACK'); } catch { /* Keep the original error. */ }
    throw error;
  } finally {
    connection.release();
  }
  return { booking: toBooking(booking!), emailStatus: await deliverAcceptanceEmail(id) };
}

export async function rejectBooking(id: string) {
  const result = await database().query<BookingRow>(
    `WITH changed AS (
       UPDATE bookings b SET status = 'rejected', updated_at = now()
       WHERE b.id = $1::uuid AND b.status = 'pending' RETURNING b.id
     )
     SELECT ${bookingColumns} FROM changed c
     JOIN bookings b ON b.id = c.id LEFT JOIN vehicles v ON v.id = b.vehicle_id`,
    [id],
  );
  if (!result.rows[0]) {
    const existing = await database().query<{ status: string }>('SELECT status FROM bookings WHERE id = $1::uuid', [id]);
    if (!existing.rows[0]) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    throw new HttpError(409, 'INVALID_BOOKING_STATUS', `This booking is already ${existing.rows[0].status}.`);
  }
  return toBooking(result.rows[0]);
}

export async function retryAcceptanceEmail(id: string) {
  const result = await database().query<{ status: string; booking_status: string }>(
    `SELECT d.status, b.status AS booking_status
     FROM admin_booking_email_deliveries d JOIN bookings b ON b.id = d.booking_id
     WHERE d.booking_id = $1::uuid`,
    [id],
  );
  const delivery = result.rows[0];
  if (!delivery) throw new HttpError(404, 'EMAIL_DELIVERY_NOT_FOUND', 'No acceptance email is recorded for this booking.');
  if (delivery.booking_status !== 'accepted') {
    throw new HttpError(409, 'BOOKING_NOT_ACCEPTED', 'Only accepted bookings can receive this email.');
  }
  if (delivery.status === 'sent') return 'sent';
  if (delivery.status === 'sending') return 'sending';
  return deliverAcceptanceEmail(id);
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus | undefined,
  paymentStatus: PaymentStatus | undefined,
) {
  if (!status && !paymentStatus) {
    throw new HttpError(400, 'EMPTY_UPDATE', 'Provide a booking or payment status to update.');
  }
  const connection = await database().connect();
  try {
    await connection.query('BEGIN');
    const result = await connection.query<BookingRow>(
      `WITH changed AS (
         UPDATE bookings b SET
           status = COALESCE($2, b.status),
           payment_status = COALESCE($3, b.payment_status),
           updated_at = now()
         WHERE b.id = $1::uuid
         RETURNING b.id
       )
       SELECT ${bookingColumns} FROM changed c
       JOIN bookings b ON b.id = c.id LEFT JOIN vehicles v ON v.id = b.vehicle_id`,
      [id, status ?? null, paymentStatus ?? null],
    );
    if (!result.rows[0]) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
    if (paymentStatus) {
      await connection.query(
        `UPDATE payments SET status = $2, updated_at = now() WHERE booking_id = $1::uuid`,
        [id, paymentStatus],
      );
    }
    await connection.query('COMMIT');
    return toBooking(result.rows[0]);
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      // Keep the original error when the connection is no longer available.
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelBookingAsAdmin(id: string) {
  const result = await database().query<BookingRow>(
    `WITH changed AS (
       UPDATE bookings b SET status = 'cancelled', updated_at = now()
       WHERE b.id = $1::uuid RETURNING b.id
     )
     SELECT ${bookingColumns} FROM changed c
     JOIN bookings b ON b.id = c.id LEFT JOIN vehicles v ON v.id = b.vehicle_id`,
    [id],
  );
  if (!result.rows[0]) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
  return toBooking(result.rows[0]);
}
