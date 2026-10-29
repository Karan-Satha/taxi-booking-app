# Heathrow Drive — taxi booking demo

A portfolio taxi-booking application with a responsive booking flow, route estimates, vehicle fares, customer accounts,
booking history, administrator booking management, and booking lookup. It is a demonstration project, not a service for
real-world dispatch or payments.

## Stack and structure

- React 19, TypeScript, Vite, React Router, and SCSS in `apps/web`.
- Node.js 22+, Express 5, TypeScript, sessions, validation, and rate limiting in `apps/api`.
- PostgreSQL with versioned SQL migrations in `database/migrations`.
- Customer accounts are stored in `users`; administrator accounts are stored separately in `admins`.
- Browser sessions use PostgreSQL-backed `user_sessions` and `admin_sessions` tables.

There is no Stripe integration, checkout flow, or user image upload in the current project. Bookings are recorded with
pay-later/pending payment status. The five sample vehicle images are versioned static assets in `apps/web/public/images`;
there are no uploaded files that need external object storage. Migrations also seed the five vehicle categories.

## Recommended free portfolio hosting

The included [Render Blueprint](render.yaml) deploys the Vite site, API, and PostgreSQL database in the Render account:

- **Frontend:** Render Static Site. Static sites are free, served from a CDN, and do not sleep. Render provides free TLS.
  The static site and API use sibling `onrender.com` domains, so the existing secure session cookies remain same-site.
- **API:** Render free Node web service. It supports Express and managed TLS, but sleeps after 15 minutes without
  requests and can take about a minute to wake. Free web services have 750 instance hours per workspace each month and
  no persistent local filesystem. Render's free plan is intended for demos, not production. Render's setup guide says
  a payment method is not required; if no payment method is attached, exceeding included usage suspends service/builds
  rather than adding charges.
- **Database:** Render Free PostgreSQL. This avoids a second account and is created by the Blueprint. It has 1 GB
  storage, no backups, and **expires after 30 days**. For a portfolio that must keep its data longer, use Neon Free
  instead (currently 1 GB storage and 100 compute hours/month per project, scaling to zero after five inactive minutes)
  and replace the API's `DATABASE_URL` with Neon’s pooled connection string.
- **Images:** No external image host is needed for the existing static vehicle assets. Do not add runtime uploads to
  the Render API filesystem: that filesystem is ephemeral. If uploads are added later, select an object storage service
  and store object URLs in PostgreSQL.
- **Email:** The hosted Blueprint sets `DEMO_MODE=true`, so no email is sent, and it does not require an email key.
  Notification events are recorded without logging customer details. To test real transactional email later, use
  Resend Free (currently 3,000 emails/month and a 100/day limit), verify a sender domain, and deliberately switch demo
  mode off.

Target hosting cost: **£0/month**, assuming usage stays within provider limits and you do not add paid services or a
custom domain. The Blueprint's Render database will be deleted after its 30-day free period unless you upgrade or
migrate first. Current limits can change. Render free services have cold starts. Don't use this deployment for real
customer data.

Provider references checked on 29 October 2026: [Render free services](https://render.com/docs/free),
[Render static sites](https://render.com/docs/static-sites), [Render first deployment](https://render.com/docs/your-first-deploy),
[Neon free plan](https://neon.com/pricing), [Neon free-tier update](https://neon.com/blog/neon-free-plan-1-gb-per-project),
[Resend pricing](https://resend.com/pricing).

## Local development

Prerequisites: Node.js 22+, npm, and a local PostgreSQL installation.

```sh
createdb taxi_booking
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm ci --prefix apps/api
npm ci --prefix apps/web
npm run db:migrate
```

Set `DATABASE_URL` in `apps/api/.env` to your local database and use `PG_SSL=false`. Set a random local-only
`SESSION_SECRET` of at least 32 characters. `VITE_API_URL` stays empty for local development; Vite proxies `/api` to
`http://localhost:4000`.

Run the API and frontend in separate terminals:

```sh
npm run dev:api
npm run dev:web
```

Open the Vite URL printed in the web terminal, usually `http://localhost:5173`. See
[database setup and API details](database/README.md).

## Environment variables

Use `apps/api/.env.example` and `apps/web/.env.example` as templates. Real `.env` files are ignored by Git. Never paste
secrets into frontend variables: values prefixed with `VITE_` are embedded in public browser assets.

### API

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Hosting: yes | Set to `production` online. |
| `PORT` | Usually supplied | HTTP port; the server uses the platform's value. |
| `WEB_ORIGIN` | Hosting: yes | Exact public frontend origin, including `https://`, for CORS and trusted-origin checks. |
| `DATABASE_URL` | Hosting: yes | PostgreSQL connection string. Use Neon’s pooled URL for the hosted API. |
| `PG_SSL` | Hosted database: yes | Set to `true` for Neon TLS; local PostgreSQL usually uses `false`. |
| `SESSION_SECRET` | Production: yes | At least 32 random characters. Render Blueprint generates one. |
| `DEMO_MODE` | Hosting: yes | `true` records notification events but disables outbound email. |
| `RESEND_API_KEY` | Optional | Backend-only key, used only when demo mode is off. |
| `EMAIL_FROM` | Optional | Verified sender address, used only when demo mode is off. |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE` | Optional | Contact details displayed in email templates. |
| `TERMS_URL`, `CANCELLATION_POLICY_URL` | Optional | Public policy links included in email templates. |
| `GEOCODER_BASE_URL`, `ROUTER_BASE_URL` | Optional | Photon and OSRM provider endpoints. |
| `MAPS_USER_AGENT`, `FARE_CATALOG_URL` | Optional | Provider identification and fallback fare source. |

### Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin, e.g. `https://heathrow-drive-api-demo.onrender.com`. Empty locally to use Vite's proxy. This is public configuration, not a secret. |

## Database, migrations, and demo data

The ordered migrations create the app's actual taxi-booking schema: customers, separate admins, drivers, vehicles,
bookings, payments, session stores, booking-progress recovery, admin email-delivery state, and indexes/constraints.
Migrations seed five fictional vehicle catalog entries. This project has no products, carts, or e-commerce orders, so
those tables are not applicable. A fresh database can be initialized without manual SQL:

```sh
npm run db:migrate
```

The Render Blueprint starts the API with the migration command before starting Express. Migrations are tracked and
safe to rerun. For a longer-lived deployment, create a free Neon project and set the API's `DATABASE_URL` to Neon's
**pooled** connection string and `PG_SSL=true`. Keep credentials only in Render's private service environment or an
ignored local `apps/api/.env`; never commit them.

```sh
DATABASE_URL='paste-your-neon-pooled-url-here' PG_SSL=true npm run db:migrate
```

The migration runner is ordered, tracked, and safe to rerun. It does not delete existing customer accounts or bookings.
`database/schema.sql` is a `psql` entry point for creating a fresh schema; use it **instead of**, not alongside, the
migration command.

### Demo administrator

There is no public admin registration. Create a fictional admin using the secure bcrypt-backed script, pointing it at
the hosted database and setting `WEB_ORIGIN` to the deployed frontend:

```sh
TEMP_ADMIN_EMAIL=portfolio-admin@example.com \
WEB_ORIGIN=https://heathrow-drive-web-demo.onrender.com \
DATABASE_URL='paste-the-external-database-url-here' PG_SSL=true \
npm run admin:provision
```

For the Blueprint database, copy its **External Database URL** from Render for this one-time local command. The API
service itself uses the private connection URL referenced in the Blueprint.

The script generates a random password and writes it to the ignored file `apps/api/.temporary-admin-credentials` with
owner-only permissions. Read it locally, store it in a password manager, and delete that file after storing it. Do not
publish demo credentials on the portfolio site. Admin login is at
`https://heathrow-drive-web-demo.onrender.com/admin/login`.

To reset a forgotten generated password, remove the old ignored credentials file, then run the same command with
`TEMP_ADMIN_ACTION=rotate`; it generates a new password. To disable the demo admin, run with
`TEMP_ADMIN_ACTION=disable` and the same `TEMP_ADMIN_EMAIL`. To update a known password, set
`TEMP_ADMIN_PASSWORD` in a private terminal environment (never put it in source control) and use
`TEMP_ADMIN_ACTION=rotate`. Password hashes stay in `admins`; customer credentials stay in `users`.

## Deploy with Render Blueprint

### Accounts to create

1. A GitHub account/repository containing this project.
2. A Render account connected to that repository.
3. Optional: a Neon account if you want to replace Render's database before its free 30-day expiry.
4. Optional: a Resend account and a sender domain you control, only if enabling real email later.

The providers offer free tiers for this demo. Render's free setup tutorial says no payment method is required. Check
the provider's current signup and plan screens before proceeding; don't select a paid plan or add a card if you want to
keep the monthly cost at zero.

### First deployment

1. Push the prepared `codex/free-hosting-setup` branch to GitHub. In Render, select **New → Blueprint** and choose
   `Karan-Satha/taxi-booking-app`, branch `codex/free-hosting-setup`. The public repository can be used without linking
   a Git provider; connecting the provider enables auto-deploys.
2. Apply `render.yaml`. It creates a free Node API, static site, and Render PostgreSQL database. If Render reports
   service-name conflicts, rename them in the Blueprint and update the corresponding URLs before applying it.
3. Keep the generated `SESSION_SECRET` and `DEMO_MODE=true`. The Blueprint references the database's private URL and
   runs migrations before starting the API.
4. Confirm the API and site URLs in Render. Set API `WEB_ORIGIN` to the exact site origin and frontend `VITE_API_URL`
   to the exact API origin if the generated service names differ; rebuild the frontend after changing `VITE_API_URL`.
5. Provision the fictional admin once using the database's external URL as described above. No admin password is
   committed or exposed in the frontend.
6. Open the frontend, create a demo booking, then sign in at `/admin/login` to review and accept it. In demo mode,
   acceptance notification state is recorded as “demo”; no customer email is sent.

`render.yaml` provides the build/start commands, health check, API/website settings, TLS hosting, and SPA fallback. It
uses fixed service URLs so the static frontend can bake in its API origin; if Render assigns different names, update
both origins as described above. The database is migrated on API startup. Admin provisioning remains a separate,
manual one-time step.

### Email delivery later

By default `DEMO_MODE=true`; outbound email functions are suppressed and record generic notification types without
including customer data in logs. To test real email, first verify a sender domain with Resend and set `RESEND_API_KEY`
and `EMAIL_FROM` only in the API service's private environment. Then set `DEMO_MODE=false` and redeploy. Resend Free is
currently limited to 3,000 emails/month and 100/day; do not use the sample project to send unsolicited messages.

### Payments and files

Stripe is not integrated, so there are no Stripe keys, checkout URLs, webhooks, or test-payment setup steps. No user
uploads are implemented. Vehicle images are static files deployed with the frontend and survive API restarts/redeploys.

## Post-deployment checklist

- [ ] `https://<api-host>/api/v1/health` returns `200` and `{"status":"ok","database":"connected"}`.
- [ ] The deployed homepage loads and vehicle images resolve.
- [ ] Refresh nested routes such as `/admin/login` and `/booking-details`; the static rewrite should serve `index.html`.
- [ ] Search for a pickup and destination; route distance/time and database-backed vehicle fares appear.
- [ ] Submit a demo booking; it is saved in PostgreSQL and confirmation appears without requiring email delivery.
- [ ] Register/sign in as a customer and confirm only that customer's bookings are shown.
- [ ] Sign in through `/admin/login`; confirm admin booking management works.
- [ ] Try customer credentials at admin login and verify they are rejected; try a customer session against admin APIs and verify it is unauthorized.
- [ ] Accept a booking; it is updated in PostgreSQL and the dashboard shows a demo notification recorded, not an email sent.
- [ ] Confirm the first API request after inactivity may take about a minute due to Render's free cold start.
- [ ] Check Neon storage/compute and Render bandwidth/build usage periodically. Export or reset demo data as needed; free plans do not promise backups.

## Known free-hosting limitations

- The free Render API sleeps after 15 minutes idle and may restart; the first request can be slow. The Blueprint's
  Render Postgres expires after 30 days and has no backups. Migrate to Neon before then if you want a longer-lived demo.
- Neon free storage, compute, and egress are limited and can change; the database may scale to zero.
- Public Photon/OSRM demonstration endpoints can throttle, change, or be unavailable. The UI should show provider errors
  rather than inventing a route.
- Email is deliberately disabled by default. The background abandoned-booking worker runs only while the free API
  process is awake, so timed reminders are not guaranteed on a sleeping demo service.
- The database is for fictional portfolio data only. Do not put real customer or payment information into the demo.

## Reset demo data

The project has no command that drops tables. For a clean demo, create a fresh Neon database/project, update
`DATABASE_URL`, run `npm run db:migrate`, provision a demo admin, and update Render's environment to the new database.
This is safer than deleting tables manually. Sample vehicles are restored by the migrations.
