# PostgreSQL setup

The API uses the `pg` connection pool. The versioned migrations create normalized UUID-based `users`, `admins`,
`drivers`, `vehicles`, `bookings`, and `payments` tables, separate PostgreSQL session tables, booking progress and
email-delivery state, indexes and constraints, and five fictional sample vehicles.
They also copy registered users and compatible historical bookings from the former PostgreSQL `customer_tbl`,
`booking_tbl`, `vehicle_tbl`, and `payment_tbl` tables when those tables exist. Legacy tables are left in place.

## Create and configure a local database

Install and start PostgreSQL for your platform, then create a database. On a default local installation:

```sh
createdb taxi_booking
```

Copy the API environment example and update `apps/api/.env`:

```sh
cp apps/api/.env.example apps/api/.env
```

Set a connection string for your PostgreSQL role. For example:

```env
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/taxi_booking
PG_SSL=false
SESSION_SECRET=replace-this-with-a-random-secret-at-least-32-characters
```

If the local server uses your operating-system account and no password, the URL may look like
`postgresql://YOUR_USER@localhost:5432/taxi_booking`. URL-encode reserved characters in passwords. For hosted
PostgreSQL, use the provider's connection string and follow its current TLS instructions. For Neon, use the pooled
connection string and set `PG_SSL=true`.
Generate a private session secret (for example with `openssl rand -base64 48`) and never commit `.env`.

From the repository root, install API dependencies if needed and apply pending migrations:

```sh
npm ci --prefix apps/api
npm run db:migrate
```

The migration runner tracks applied SQL files in `schema_migrations` and uses a PostgreSQL advisory lock so concurrent
deployments do not run the same migration simultaneously. The SQL entry point `database/schema.sql` is available for
`psql` users on a fresh database; use either it or the migration command, not both independently.

Verify the connection and schema:

```sh
pg_isready
psql -d taxi_booking -c '\dt'
psql -d taxi_booking -c 'SELECT slug, name, category, passenger_capacity, luggage_capacity FROM vehicles ORDER BY name;'
```

For a hosted database, use `psql "$DATABASE_URL"` after exporting the provider connection string in your terminal.

The API health endpoint reports database connectivity at `GET /api/v1/health`. Restart the API after changing `.env`.

## API routes

Public routes:

- `GET /api/v1/vehicles` lists available vehicles and their pricing/capacity fields.
- `POST /api/v1/bookings/quote` calculates the route and returns a short-lived signed estimate. With `DATABASE_URL`
  configured, vehicle options and rates come from `vehicles`; without a database, the existing remote fare catalog is
  retained for quote previews. Booking creation requires PostgreSQL.
- `POST /api/v1/bookings` validates the signed quote and capacity, recalculates fare from current database rates,
  rejects changed rates, and writes the booking and pending pay-later payment in one transaction.
- `GET /api/v1/bookings/progress` restores the current browser session's encrypted booking progress; `PUT` saves it,
  and `POST /api/v1/bookings/progress/complete` marks the flow complete. Progress expires after 30 minutes of inactivity.
  The same record supports high-entropy, expiring recovery links without putting customer details in the URL.

Abandoned booking reminders run from the long-lived API server's database-backed worker. A reminder is sent once,
after five minutes without activity, only when the passenger explicitly opted in and supplied a valid email address.
The migration creates the encrypted-progress store and indexes used by the worker. Configure `RESEND_API_KEY` and
`EMAIL_FROM` in `apps/api/.env`; without those settings the worker does not send reminders.

Signed-in customer routes:

- `GET /api/v1/bookings` and `GET /api/v1/bookings/:id` return the current user's booking history.
- `DELETE /api/v1/bookings/:id` cancels that user's pending or confirmed booking.

Administrator routes require a signed-in user with role `admin`:

- `/api/v1/admin/vehicles`: `GET`, `GET /:id`, `POST`, `PATCH /:id`, and `DELETE /:id` (delete marks a
  vehicle unavailable).
- `/api/v1/admin/users`: `GET`, `GET /:id`, `POST`, `PATCH /:id`, and `DELETE /:id` (delete disables the account;
  password hashes are never returned).
- `/api/v1/admin/bookings`: `GET`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` (delete marks the booking
  cancelled).

New registrations receive the `customer` role and remain in `users`. Administrators are stored exclusively in `admins`.
Create or reset one using the bcrypt-backed provisioning script from the repository root:

```sh
TEMP_ADMIN_EMAIL=portfolio-admin@example.com npm run admin:provision
```

The script generates a password and writes it to the ignored owner-only `apps/api/.temporary-admin-credentials` file.
See the root [README deployment guide](../README.md#demo-administrator) for hosted setup, password rotation, and
disabling the demo account. Never promote a customer account by changing `users.role`.

## Fare, time, and payment notes

Vehicle fare rates use `NUMERIC`; journey time is stored as `timestamptz` with the original `Europe/London` timezone
recorded. The route provider supplies coordinates, distance, and estimated duration. The backend recalculates the fare
when a booking is confirmed and compares it with the signed estimate. Online card or PayPal processing is not enabled;
new bookings and payment records start as pending/pay-later.

Legacy booking rows did not contain coordinates, route distance, or estimated duration. The import keeps those fields
null rather than inventing values, and marks legacy payment states as pending because the old records do not prove
settlement. Unparseable legacy pickup times remain in the original legacy tables and are skipped by the new-history
import. Back up existing data before migration and verify the imported row counts before production cutover.
