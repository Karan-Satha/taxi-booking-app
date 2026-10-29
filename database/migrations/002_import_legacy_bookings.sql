-- Preserve old PostgreSQL bookings where the legacy schema exists. Legacy rows did not keep
-- route distance, duration, coordinates, or reliable payment state, so those values stay unknown.
DO $migration$
BEGIN
  IF to_regclass('public.booking_tbl') IS NOT NULL
    AND to_regclass('public.customer_tbl') IS NOT NULL
    AND to_regclass('public.vehicle_tbl') IS NOT NULL
    AND to_regclass('public.payment_tbl') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO bookings (
        booking_reference, user_id, vehicle_id, customer_name, customer_email, customer_phone,
        pickup_address, dropoff_address, pickup_at, pickup_timezone,
        journey_distance_miles, estimated_duration_seconds, passenger_count, luggage_count,
        special_instructions, total_fare, currency, status, payment_status, created_at, updated_at
      )
      SELECT
        'LEGACY-' || b.booking_id::text,
        u.id,
        v.id,
        c.name,
        lower(c.email),
        c.phone,
        b.pickup_address,
        b.dropoff_address,
        (b.journey_date + btrim(b.journey_time)::time) AT TIME ZONE 'Europe/London',
        'Europe/London',
        NULL,
        NULL,
        LEAST(
          32,
          GREATEST(
            1,
            COALESCE(NULLIF(regexp_replace(COALESCE(ov.passenger, ''), '[^0-9]', '', 'g'), ''), '1')::integer
          )
        ),
        LEAST(
          40,
          GREATEST(
            0,
            COALESCE(NULLIF(regexp_replace(COALESCE(ov.luggage, ''), '[^0-9]', '', 'g'), ''), '0')::integer
          )
        ),
        COALESCE(b.customer_note, ''),
        COALESCE(old_payment.amount, 0)::numeric(10, 2),
        'GBP',
        'pending',
        'pending',
        b.booked_date,
        b.booked_date
      FROM booking_tbl b
      JOIN customer_tbl c ON c.customer_id = b.customer_id
      LEFT JOIN users u ON u.legacy_customer_id = c.customer_id
      LEFT JOIN LATERAL (
        SELECT
          vehicle_type,
          passenger,
          luggage,
          regexp_replace(lower(COALESCE(vehicle_type, '')), '[^a-z0-9]', '', 'g') AS vehicle_type_key
        FROM vehicle_tbl old_vehicle
        WHERE old_vehicle.booking_id = b.booking_id
        ORDER BY old_vehicle.vehicle_id
        LIMIT 1
      ) ov ON true
      LEFT JOIN vehicles v ON v.slug = CASE
        WHEN ov.vehicle_type_key IN ('standard', 'standardsaloon', 'saloon', 'sedan', 'standardcar')
          THEN 'standard-saloon'
        WHEN ov.vehicle_type_key LIKE '%estate%' THEN 'estate'
        WHEN ov.vehicle_type_key LIKE '%executive%' THEN 'executive'
        WHEN ov.vehicle_type_key LIKE '%mpv%' THEN 'mpv'
        WHEN ov.vehicle_type_key LIKE '%minibus%' THEN 'minibus'
        ELSE NULL
      END
      LEFT JOIN LATERAL (
        SELECT amount FROM payment_tbl p
        WHERE p.booking_id = b.booking_id
        ORDER BY p.payment_id DESC
        LIMIT 1
      ) old_payment ON true
      WHERE btrim(b.journey_time) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND btrim(b.pickup_address) <> ''
        AND btrim(b.dropoff_address) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM bookings existing
          WHERE existing.booking_reference = 'LEGACY-' || b.booking_id::text
        )
    $sql$;

    EXECUTE $sql$
      INSERT INTO payments (booking_id, user_id, provider, amount, currency, status, created_at, updated_at)
      SELECT b.id, b.user_id, 'legacy_pay_later', b.total_fare, b.currency, b.payment_status, b.created_at, b.updated_at
      FROM bookings b
      WHERE b.booking_reference LIKE 'LEGACY-%'
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id)
    $sql$;
  END IF;
END
$migration$;
