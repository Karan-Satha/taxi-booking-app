CREATE TABLE IF NOT EXISTS booking_progress (
  session_key char(64) PRIMARY KEY,
  payload_ciphertext text NOT NULL,
  payload_iv varchar(32) NOT NULL,
  payload_auth_tag varchar(32) NOT NULL,
  recovery_token_hash char(64) NOT NULL UNIQUE,
  recovery_consent boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  recovery_email_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_progress_recovery_due_idx
  ON booking_progress (last_activity_at, expires_at)
  WHERE recovery_consent = true
    AND recovery_email_sent_at IS NULL
    AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS booking_progress_expiry_idx ON booking_progress (expires_at);
