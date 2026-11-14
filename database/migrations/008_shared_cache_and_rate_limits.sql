CREATE TABLE IF NOT EXISTS service_cache (
  cache_key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_cache_expiry_idx ON service_cache (expires_at);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  cache_key text PRIMARY KEY,
  hit_count integer NOT NULL CHECK (hit_count >= 0),
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS api_rate_limits_expiry_idx ON api_rate_limits (reset_at);
