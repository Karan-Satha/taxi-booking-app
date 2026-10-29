CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(255) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(60) NOT NULL,
  last_name varchar(60) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL,
  phone varchar(24) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  legacy_customer_id integer UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_unique_idx ON users (lower(email));
CREATE INDEX users_status_idx ON users (status);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(60) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  category varchar(40) NOT NULL,
  description varchar(500) NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  passenger_capacity smallint NOT NULL CHECK (passenger_capacity BETWEEN 1 AND 32),
  luggage_capacity smallint NOT NULL CHECK (luggage_capacity BETWEEN 0 AND 40),
  base_fare numeric(10, 2) NOT NULL CHECK (base_fare >= 0),
  price_per_mile numeric(10, 4) NOT NULL CHECK (price_per_mile >= 0),
  price_per_minute numeric(10, 4) NOT NULL DEFAULT 0 CHECK (price_per_minute >= 0),
  minimum_fare numeric(10, 2) NOT NULL DEFAULT 0 CHECK (minimum_fare >= 0),
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicles_available_category_idx ON vehicles (is_available, category);

CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(60) NOT NULL,
  last_name varchar(60) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL,
  phone varchar(24) NOT NULL,
  license_number varchar(80) NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX drivers_email_lower_unique_idx ON drivers (lower(email));
CREATE INDEX drivers_status_idx ON drivers (status);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference varchar(24) NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_name varchar(120) NOT NULL,
  customer_email varchar(254) NOT NULL,
  customer_phone varchar(32) NOT NULL,
  pickup_address varchar(500) NOT NULL,
  pickup_longitude numeric(10, 7),
  pickup_latitude numeric(10, 7),
  dropoff_address varchar(500) NOT NULL,
  dropoff_longitude numeric(10, 7),
  dropoff_latitude numeric(10, 7),
  pickup_at timestamptz NOT NULL,
  pickup_timezone varchar(64) NOT NULL DEFAULT 'Europe/London',
  journey_distance_miles numeric(9, 2) CHECK (journey_distance_miles > 0),
  estimated_duration_seconds integer CHECK (estimated_duration_seconds > 0),
  passenger_count smallint NOT NULL CHECK (passenger_count > 0),
  luggage_count smallint NOT NULL DEFAULT 0 CHECK (luggage_count >= 0),
  special_instructions text NOT NULL DEFAULT '',
  total_fare numeric(10, 2) NOT NULL CHECK (total_fare >= 0),
  currency char(3) NOT NULL DEFAULT 'GBP',
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  payment_status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((pickup_longitude IS NULL) = (pickup_latitude IS NULL)),
  CHECK ((dropoff_longitude IS NULL) = (dropoff_latitude IS NULL))
);

CREATE INDEX bookings_user_created_idx ON bookings (user_id, created_at DESC);
CREATE INDEX bookings_status_pickup_idx ON bookings (status, pickup_at);
CREATE INDEX bookings_vehicle_pickup_idx ON bookings (vehicle_id, pickup_at);
CREATE INDEX bookings_driver_pickup_idx ON bookings (driver_id, pickup_at);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  provider varchar(40) NOT NULL DEFAULT 'pay_later',
  provider_reference varchar(255),
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'GBP',
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_booking_idx ON payments (booking_id);
CREATE INDEX payments_status_created_idx ON payments (status, created_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire);

INSERT INTO vehicles (
  id, slug, name, category, description, image_url, passenger_capacity, luggage_capacity,
  base_fare, price_per_mile, price_per_minute, minimum_fare
) VALUES
  ('00000000-0000-4000-8000-000000000001', 'standard-saloon', 'Standard Saloon', 'Standard',
   'A comfortable everyday ride for up to 4 passengers.', '/images/vehicles/saloon.webp', 4, 2, 4.00, 2.20, 0.20, 8.00),
  ('00000000-0000-4000-8000-000000000002', 'estate', 'Estate', 'Estate',
   'Extra luggage space for airport trips and longer journeys.',
   '/images/vehicles/estate.webp', 4, 4, 5.00, 2.50, 0.22, 10.00),
  ('00000000-0000-4000-8000-000000000003', 'executive', 'Executive', 'Executive',
   'A premium vehicle for business and special occasions.',
   '/images/vehicles/executive.webp', 4, 2, 8.00, 3.40, 0.28, 15.00),
  ('00000000-0000-4000-8000-000000000004', 'mpv', 'MPV', 'MPV',
   'Flexible seating and luggage capacity for families and groups.',
   '/images/vehicles/mpv.webp', 6, 4, 7.00, 3.00, 0.25, 13.00),
  ('00000000-0000-4000-8000-000000000005', 'minibus', 'Minibus', 'Minibus',
   'Room for larger groups and their luggage.', '/images/vehicles/minibus.webp', 8, 8, 12.00, 4.00, 0.35, 22.00)
ON CONFLICT (slug) DO NOTHING;

DO $migration$
BEGIN
  IF to_regclass('public.customer_tbl') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO users (first_name, last_name, email, phone, password_hash, role, status, legacy_customer_id)
      SELECT DISTINCT ON (lower(c.email))
        split_part(btrim(c.name), ' ', 1),
        btrim(substr(btrim(c.name), length(split_part(btrim(c.name), ' ', 1)) + 1)),
        lower(btrim(c.email)),
        c.phone,
        c.password,
        CASE WHEN lower(c.type) = 'admin' THEN 'admin' ELSE 'customer' END,
        'active',
        c.customer_id
      FROM customer_tbl c
      WHERE lower(c.type) IN ('user', 'admin')
        AND c.password IS NOT NULL
        AND btrim(c.email) <> ''
        AND btrim(c.name) <> ''
      ORDER BY lower(c.email), c.customer_id
      ON CONFLICT DO NOTHING
    $sql$;
  END IF;
END
$migration$;
