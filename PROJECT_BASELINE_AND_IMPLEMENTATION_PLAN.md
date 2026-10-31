# Taxi Booking: baseline and phased implementation plan

## Existing project baseline (before migration)

### Stack and layout

- The application is a server-rendered PHP site with plain JavaScript and SCSS. There is no React, TypeScript, Express, or Node application in the checked-in source tree.
- `package.json` has no application build or start scripts and no runtime dependencies. The only declared development dependency is Babel CLI 6.26.0; `npm test` is a placeholder that exits with an error.
- The PHP pages (`index.php`, `booking.php`, `confirm.php`, `login.php`, `register.php`, and `logout.php`) implement the current page flow. Browser code lives in `scripts/`; styles live in `stylesheets/` with generated CSS and source maps.
- `vendor/` contains Composer autoload files and PHPMailer. `dist/` contains a separate older generated frontend build and should not be treated as the source of truth until its relationship to the current PHP pages is established.

### Existing user flows and integrations

- The home page collects pickup and destination addresses, requests a route estimate through the Google Maps JavaScript APIs, and exposes vehicle choices.
- The booking page collects passenger, contact, journey, vehicle, and payment details. `booking.php` writes customer, booking, vehicle, and payment rows and has code to persist PayPal payment metadata.
- Account registration and login use PHP sessions and `password_hash`/`password_verify`. Guests are also represented in the customer table by the booking code.
- PHPMailer is configured for Gmail SMTP in `booking.php`. Its current configuration includes a hard-coded credential and should be considered compromised; rotate it and move mail configuration to environment variables before any deployment.
- Google Maps and PayPal SDKs are loaded in browser pages. Their end-to-end availability, server-side payment verification, and production credentials have not been verified. A browser-provided PayPal amount or payment ID is not proof of a captured payment.

### Database and data model

- `taxi_db.sql` is a MySQL/MariaDB phpMyAdmin dump (InnoDB, `AUTO_INCREMENT`, MySQL types and syntax), not a PostgreSQL schema. It defines `customer_tbl`, `booking_tbl`, `vehicle_tbl`, `payment_tbl`, and `paypal_payment_tbl` with foreign keys.
- The model stores customers, journey addresses/date/time/notes, vehicle/passenger/luggage details, payment method/amount, and PayPal identifiers. It does not define an explicit booking status, lifecycle timestamps beyond `booked_date`, or a dedicated booking-history API/page in the inspected source.
- PostgreSQL is not currently part of the project. A database engine migration would require a deliberate schema/data migration plan; it must not be assumed safe to switch by changing connection configuration.

### Baseline risks and verification gaps

- `config/connect.php` currently contains unresolved Git conflict markers and two competing connection implementations, including a plaintext database password in one side. The file cannot be considered runnable or safe as checked in.
- The working tree already contains many modified, deleted, and untracked files, including dependencies, generated assets, PHP pages, styles, and configuration. Those edits predate this plan and must be reviewed and preserved rather than reset as part of the refactor.
- The booking implementation has apparent correctness gaps (including invalid PHP syntax around the fare assignment and comparisons that use `isset(...) === value`), so current booking/payment persistence cannot be certified from source inspection alone.
- No automated application tests, type checks, or production build are configured. Runtime verification requires the intended PHP/MySQL environment and valid external API credentials, none of which are established by this repository snapshot.
- Existing schema/data, active credentials, provider configuration, and the exact intended contents of conflicted files need to be treated as unknown until reviewed. Do not copy secrets into the new application or commit them.

## Phased implementation plan

The migration is incremental. Preserve documented behavior and any real database data while moving the app to the requested Node/PostgreSQL stack. Add a phase to this document as complete only after its acceptance checks pass.

### Phase 0 — Establish a safe, reproducible baseline

1. Review the current diff and identify which changes are intentional; record a recoverable snapshot before editing shared files.
2. Remove the conflicted PHP connection file and credentials from active source, rotate exposed secrets, and document required environment variables without values.
3. Confirm the canonical application entry point, PHP/MySQL versions, schema/data ownership, and whether the current `dist/` build is still used.
4. Run syntax/build checks and inspect source-controlled files for secrets. Record failing checks as baseline issues rather than hiding them.

**Exit checks:** no conflict markers in active source, no committed secrets, a documented local startup path, and a reproducible baseline report.

### Phase 1 — Capture behavior and protect data

1. Document existing routes, session behavior, form fields, fare calculation, vehicle options, payment states, email behavior, and SQL relationships.
2. Establish representative test data and backup/restore procedures for the current MySQL/MariaDB database.
3. Add characterization tests around supported booking, guest, registration, login, quote, and confirmation behavior where these flows can be run safely.
4. Verify what the Google Maps and PayPal integrations actually do. Keep them marked unavailable until their credentials and provider-side behavior are checked.

**Exit checks:** agreed feature inventory, schema backup/restore verified, and critical current behavior documented with test coverage or explicit known gaps.

### Phase 2 — Define target architecture and migration boundary

1. Add a TypeScript React client and TypeScript Express API with independent build/start scripts and environment-based configuration.
2. Use PostgreSQL as requested. Preserve the legacy table relationships and provide a data-import procedure; do not assume the old MySQL schema dump contains production records.
3. Define typed API contracts for authentication, quote inputs/results, vehicle availability, booking creation, booking details/history, and payment state. Preserve old behavior until an equivalent route is verified.
4. Add modular API boundaries for routes, controllers, services, validation, middleware, database access, and centralized errors.

**Exit checks:** client and API compile independently, API contract is documented, secrets are environment-only, and a local setup can run both services without disrupting the legacy flow.

### Phase 3 — Build the design system and responsive application shell

1. Establish SCSS tokens, typography, spacing, colors, focus states, breakpoints, reusable form controls, cards, alerts, and buttons.
2. Implement the navigation, page shell, loading/error/empty/success states, keyboard access, and responsive behavior.
3. Use BEM class naming and shared SCSS modules/partials; keep component logic and API calls separated.

**Exit checks:** shared visual language is applied to all new pages; keyboard and mobile checks pass at agreed viewport sizes.

### Phase 4 — Migrate booking and quote journeys

1. Implement the quote form and route estimate behind provider-configurable typed services, using Photon and OSRM defaults and handling unavailable/error responses clearly.
2. Recreate vehicle selection with passenger capacity and transparent fare calculations based on verified existing business rules.
3. Build validated passenger and journey details, booking submission, and confirmation from persisted API responses.
4. Keep any payment action disabled or clearly identified as unavailable until server-side provider verification is implemented and tested; do not trust client-posted amounts or payment claims.

**Exit checks:** end-to-end quote-to-booking path persists data through the real database; invalid input and provider failures are handled; confirmation reflects the saved booking.

### Phase 5 — Migrate accounts and booking management

1. Implement registration, login, logout, session/token strategy, and authorization with secure password handling and session protections.
2. Add authenticated booking history/details only after the API can reliably associate records with the authenticated customer.
3. Provide account, empty, loading, and error states without exposing another customer's records.

**Exit checks:** authentication and ownership checks pass; the user can inspect their own bookings; legacy accounts and records remain accessible or have a verified migration path.

### Phase 6 — Integrations, security, and production hardening

1. Move mail, maps, payment, and database configuration to environment variables and document secret rotation and deployment configuration.
2. Verify payment capture server-side with the provider before recording a paid state; preserve payment identifiers and audit-safe error handling.
3. Add request validation, rate limits where appropriate, secure headers, CSRF/session protections, safe logging, database transactions, and least-privilege database access.
4. Add health/readiness checks, structured operational logs, and backup/restore and migration procedures.

**Exit checks:** security review completed, integrations tested in provider sandbox/configured environment, and data/recovery procedure reviewed.

### Phase 7 — Cut over, verify, and retire legacy code

1. Run the frontend build, TypeScript checks, backend tests, critical end-to-end booking tests, accessibility checks, and responsive browser checks.
2. Reconcile old and new records and perform a staged cutover with a rollback path. The PHP cutover was explicitly requested before the new booking flows and live data migration were ready; no live database was connected in this workspace.
3. Complete the removal of unused legacy runtime assets, verify only the Node/PostgreSQL runtime is documented, and update deployment documentation.

**Exit checks:** all agreed acceptance checks pass in the target environment, no known integration is silently dropped, and rollback/data recovery has been exercised.

## Current status

- Baseline review: the old app was inspected before migration. `taxi_db.sql` contains schema only and no row data.
- Phase 0: PHP source, Composer files/vendor code, and conflicted PHP database configuration have been removed. Previously exposed credentials must still be rotated because Git history can retain them.
- Phase 2: React/Vite/TypeScript and Express/TypeScript/PostgreSQL now build independently. `database/schema.sql` defines the PostgreSQL model; no live database was available for a data import.
- Phase 3: responsive React shell and accessible address fields use Photon search-as-you-type; browser geolocation reverse-geocodes the pickup with Photon.
- Phase 4: quote API uses OSRM routes and the legacy fare catalog/formula. Vehicle selection and guest/account booking confirmation write customer, booking, vehicle, and pay-later rows in one PostgreSQL transaction. Public map endpoints are best-effort; database-backed persistence remains unverified.
- Phase 5 account slice: React login, registration, account and logout pages use Express sessions, PostgreSQL `customer_tbl`, bcrypt hashes, request validation, rate limits, and origin checks. Live database-backed authentication still needs verification; booking history/ownership remains pending.
- Verification for the current slice: frontend and API builds pass; API tests cover validation and provider failure handling. PostgreSQL and fare catalog availability are not verified here.
- Phases 1, 6, and 7 remain pending. Online payment processing, email, booking history, and provider integration verification are incomplete.
- Remaining application gaps: configure and verify PostgreSQL, verify the public Photon/OSRM endpoints and fare catalog endpoint, implement booking history, and configure payment/email integrations before production use.
