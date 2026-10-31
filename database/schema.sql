-- Canonical PostgreSQL schema: apply with `npm run db:migrate` from the project root.
-- This psql entry point is provided for fresh databases and records the migration version.
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(255) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

\ir migrations/001_modern_booking_schema.sql
\ir migrations/002_import_legacy_bookings.sql
\ir migrations/003_booking_fare_breakdown.sql
\ir migrations/004_booking_progress_recovery.sql
\ir migrations/005_admin_booking_acceptance.sql
\ir migrations/006_separate_admin_auth.sql
\ir migrations/007_demo_email_status.sql

INSERT INTO schema_migrations (version)
VALUES
  ('001_modern_booking_schema.sql'),
  ('002_import_legacy_bookings.sql'),
  ('003_booking_fare_breakdown.sql'),
  ('004_booking_progress_recovery.sql'),
  ('005_admin_booking_acceptance.sql'),
  ('006_separate_admin_auth.sql'),
  ('007_demo_email_status.sql')
ON CONFLICT (version) DO NOTHING;

COMMIT;
