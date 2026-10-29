ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS fare_breakdown jsonb;
