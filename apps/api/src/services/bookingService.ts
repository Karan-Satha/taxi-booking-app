import { randomBytes } from 'node:crypto';
import { pool } from '../config/database.js';
import { HttpError } from '../middleware/errors.js';
import type { BookingInput, VehicleOption } from '../types/booking.js';
import type { Account } from '../types/auth.js';
import { verifyQuote } from './quoteService.js';
import { calculateFare } from './fareCalculator.js';
import { sendBookingConfirmationEmail } from './emailService.js';
import { logServerError } from '../middleware/errors.js';
import { completeBookingProgress } from './bookingProgressService.js';

interface VehiclePricingRow {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url: string;
  passenger_capacity: number;
  luggage_capacity: number;
  base_fare: string;
  price_per_mile: string;
  price_per_minute: string;
  minimum_fare: string;
}

function toVehicleOption(vehicle: VehiclePricingRow, fare: number): VehicleOption {
  return {
    id: vehicle.id,
    name: vehicle.name,
    category: vehicle.category,
    description: vehicle.description,
    imageUrl: vehicle.image_url,
    passengers: vehicle.passenger_capacity,
    luggage: vehicle.luggage_capacity,
    fare,
  };
}

export async function saveBooking(input: BookingInput, account: Account | undefined, sessionId?: string) {
  if (!pool) {
    throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Bookings are unavailable until the database is configured.');
  }

  const quote = verifyQuote(input.quoteToken);
  const quotedVehicle = quote.vehicles.find((option) => option.id === input.vehicleId);
  if (!quotedVehicle) {
    throw new HttpError(400, 'VEHICLE_NOT_IN_QUOTE', 'Choose one of the vehicles in your current estimate.');
  }

  const vehicleResult = await pool.query<VehiclePricingRow>(
    `SELECT id, name, category, description, image_url, passenger_capacity, luggage_capacity,
            base_fare, price_per_mile, price_per_minute, minimum_fare
     FROM vehicles
     WHERE id = $1::uuid AND is_available = true`,
    [input.vehicleId],
  );
  const vehicleRow = vehicleResult.rows[0];
  if (!vehicleRow) {
    throw new HttpError(409, 'VEHICLE_UNAVAILABLE', 'That vehicle is no longer available. Please choose another.');
  }
  if (input.passengers > vehicleRow.passenger_capacity || input.luggage > vehicleRow.luggage_capacity) {
    throw new HttpError(
      400,
      'CAPACITY_EXCEEDED',
      'The selected vehicle does not have enough passenger or luggage capacity.',
    );
  }

  const finalFare = calculateFare(
    {
      baseFare: vehicleRow.base_fare,
      pricePerMile: vehicleRow.price_per_mile,
      pricePerMinute: vehicleRow.price_per_minute,
      minimumFare: vehicleRow.minimum_fare,
    },
    quote.distanceMiles,
    quote.durationSeconds,
  );
  if (finalFare !== quotedVehicle.fare) {
    throw new HttpError(409, 'FARE_CHANGED', 'The vehicle fare has changed. Please review a fresh estimate.');
  }
  const vehicle = toVehicleOption(vehicleRow, finalFare);
  const customerPhone = `${input.customer.countryCode}-${input.customer.phone}`;
  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
  const baseFare = roundMoney(Number(vehicleRow.base_fare));
  const distanceFare = roundMoney(Number(vehicleRow.price_per_mile) * quote.distanceMiles);
  const timeFare = roundMoney(Number(vehicleRow.price_per_minute) * (quote.durationSeconds / 60));
  const minimumFareAdjustment = Math.max(
    0,
    roundMoney(Number(vehicleRow.minimum_fare) - (baseFare + distanceFare + timeFare)),
  );
  const roundingAdjustment = roundMoney(finalFare - baseFare - distanceFare - timeFare - minimumFareAdjustment);
  const fareLines = [
    { label: 'Base fare', amount: baseFare },
    { label: 'Distance', amount: distanceFare },
    { label: 'Journey time', amount: timeFare },
    { label: 'Minimum fare adjustment', amount: minimumFareAdjustment },
    { label: 'Rounding adjustment', amount: roundingAdjustment },
  ];
  const bookingReference = `HD-${randomBytes(6).toString('hex').toUpperCase()}`;
  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');
    const inserted = await connection.query<{ id: string }>(
      `INSERT INTO bookings (
         booking_reference, user_id, vehicle_id, customer_name, customer_email, customer_phone,
         pickup_address, pickup_longitude, pickup_latitude, dropoff_address, dropoff_longitude, dropoff_latitude,
         pickup_at, pickup_timezone, journey_distance_miles, estimated_duration_seconds,
         passenger_count, luggage_count, special_instructions, total_fare, currency, fare_breakdown
       ) VALUES (
         $1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         (($13::date + $14::time) AT TIME ZONE $15), $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb
       ) RETURNING id`,
      [
        bookingReference,
        account?.userId ?? null,
        vehicle.id,
        input.customer.name,
        input.customer.email,
        customerPhone,
        quote.pickup,
        quote.pickupCoordinates?.[0] ?? null,
        quote.pickupCoordinates?.[1] ?? null,
        quote.dropoff,
        quote.dropoffCoordinates?.[0] ?? null,
        quote.dropoffCoordinates?.[1] ?? null,
        quote.date,
        quote.time,
        'Europe/London',
        quote.distanceMiles,
        quote.durationSeconds,
        input.passengers,
        input.luggage,
        input.note,
        finalFare,
        quote.currency,
        JSON.stringify(fareLines),
      ],
    );
    const bookingId = inserted.rows[0].id;
    await connection.query(
      `INSERT INTO payments (booking_id, user_id, provider, amount, currency, status)
       VALUES ($1::uuid, $2, 'pay_later', $3, $4, 'pending')`,
      [bookingId, account?.userId ?? null, finalFare, quote.currency],
    );
    if (sessionId) await completeBookingProgress(sessionId, connection);
    await connection.query('COMMIT');

    try {
      await sendBookingConfirmationEmail({
        bookingReference,
        customerName: input.customer.name,
        customerEmail: input.customer.email,
        customerPhone,
        quote,
        vehicleName: vehicle.name,
        vehicleCategory: vehicle.category,
        vehicleImageUrl: vehicle.imageUrl,
        passengerCapacity: vehicle.passengers,
        luggageCapacity: vehicle.luggage,
        passengers: input.passengers,
        luggage: input.luggage,
        fare: finalFare,
        fareLines,
        bookingStatus: 'pending',
        paymentStatus: 'pending',
      });
    } catch (error) {
      logServerError('Booking confirmation email could not be sent', error);
    }

    return { bookingId, bookingReference, status: 'pending', quote, vehicle };
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      // Preserve the original database error if the connection has already failed.
    }
    throw error;
  } finally {
    connection.release();
  }
}
