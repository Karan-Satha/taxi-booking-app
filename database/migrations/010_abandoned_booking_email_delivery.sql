ALTER TABLE booking_progress
  ADD COLUMN IF NOT EXISTS recovery_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_email_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS booking_progress_recovery_claim_idx
  ON booking_progress (last_activity_at, recovery_email_claimed_at)
  WHERE recovery_consent = true
    AND recovery_email_sent_at IS NULL
    AND completed_at IS NULL;
