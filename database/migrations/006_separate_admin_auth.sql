CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(60) NOT NULL,
  last_name varchar(60) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admins_email_lower_unique_idx ON admins (lower(email));
CREATE INDEX IF NOT EXISTS admins_status_idx ON admins (status);

INSERT INTO admins (id, first_name, last_name, email, password_hash, role, status, created_at, updated_at)
SELECT id, first_name, last_name, email, password_hash, 'admin',
       CASE WHEN status = 'active' THEN 'active' ELSE 'disabled' END, created_at, updated_at
FROM users
WHERE role = 'admin'
ON CONFLICT (lower(email)) DO NOTHING;

DELETE FROM user_sessions
WHERE sess -> 'user' ->> 'userId' IN (SELECT id::text FROM admins);

-- Retain legacy user rows so booking.user_id relationships stay intact, but disable
-- those old admin identities and remove their admin password hashes from users.
UPDATE users
SET password_hash = '!migrated-to-admins!', role = 'customer', status = 'disabled', updated_at = now()
WHERE role = 'admin';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = 'customer');

CREATE TABLE IF NOT EXISTS admin_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expire_idx ON admin_sessions (expire);
