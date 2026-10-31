ALTER TABLE admin_booking_email_deliveries
  DROP CONSTRAINT IF EXISTS admin_booking_email_deliveries_status_check;

ALTER TABLE admin_booking_email_deliveries
  ADD CONSTRAINT admin_booking_email_deliveries_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'demo'));
