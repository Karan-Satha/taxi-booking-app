import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

process.env.DATABASE_URL = '';
process.env.PG_SSL = 'false';
process.env.GEOCODER_BASE_URL = 'http://127.0.0.1:1';
process.env.ROUTER_BASE_URL = 'http://127.0.0.1:1';
process.env.FARE_CATALOG_URL = 'http://127.0.0.1:1/fare.json';

let server;
let baseUrl;

before(async () => {
  const { app } = await import('../dist/app.js');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server)
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('health endpoint reports API readiness without claiming a database connection', async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok', database: 'not_configured' });
});

test('unknown API routes return the standard not found response', async () => {
  const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(body, {
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
});

test('vehicle catalog reports database setup is required when no database is configured', async () => {
  const response = await fetch(`${baseUrl}/api/v1/vehicles`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'DATABASE_NOT_CONFIGURED');
});

test('booking history requires an authenticated account', async () => {
  const response = await fetch(`${baseUrl}/api/v1/bookings`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'AUTH_REQUIRED');
});

test('booking detail lookup requires an authenticated account before checking ownership', async () => {
  const response = await fetch(`${baseUrl}/api/v1/bookings/00000000-0000-4000-8000-000000000001`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'AUTH_REQUIRED');
});

test('booking progress starts safely when no saved progress exists', async () => {
  const response = await fetch(`${baseUrl}/api/v1/bookings/progress`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { progress: null });
  assert.match(response.headers.get('set-cookie') ?? '', /taxi\.sid=/);
});

test('booking progress updates reject untrusted origins', async () => {
  const response = await fetch(`${baseUrl}/api/v1/bookings/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 403);
});

test('admin management routes require an authenticated administrator', async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin/vehicles`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'AUTH_REQUIRED');
});

test('administrator session endpoint is isolated and requires administrator sign-in', async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin-auth/me`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'ADMIN_AUTH_REQUIRED');
});

test('administrator authentication has no public registration endpoint', async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin-auth/register`, { method: 'POST' });
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

test('administrator login validates credentials before database access', async () => {
  const response = await fetch(`${baseUrl}/api/v1/admin-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ email: 'invalid', password: '' }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('admin booking acceptance and email retry endpoints require an authenticated administrator', async () => {
  const actions = [
    ['POST', '/api/v1/admin/bookings/00000000-0000-4000-8000-000000000001/accept'],
    ['POST', '/api/v1/admin/bookings/00000000-0000-4000-8000-000000000001/reject'],
    ['POST', '/api/v1/admin/bookings/00000000-0000-4000-8000-000000000001/acceptance-email/retry'],
  ];
  for (const [method, path] of actions) {
    const response = await fetch(`${baseUrl}${path}`, { method });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_REQUIRED');
  }
});

test('server fare calculation applies mile, minute, and base rates', async () => {
  const { calculateFare } = await import('../dist/services/fareCalculator.js');
  const fare = calculateFare(
    { baseFare: '5.00', pricePerMile: '2.00', pricePerMinute: '0.50', minimumFare: '8.00' },
    10,
    60 * 20,
  );

  assert.equal(fare, 35);
});

test('server fare calculation respects the minimum fare', async () => {
  const { calculateFare } = await import('../dist/services/fareCalculator.js');
  const fare = calculateFare(
    { baseFare: '2.00', pricePerMile: '0.10', pricePerMinute: '0.05', minimumFare: '10.00' },
    1,
    60,
  );

  assert.equal(fare, 10);
});

test('registration validates fields before trying to access the database', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ name: '', email: 'invalid', password: 'x' }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.fields.email);
});

test('registration reports an unconfigured database clearly', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({
      name: 'Jamie Rider',
      email: 'jamie@example.com',
      countryCode: '+44',
      phone: '7700900123',
      password: 'safePassword1',
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'DATABASE_NOT_CONFIGURED');
});

test('account-changing requests reject untrusted origins', async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
    body: JSON.stringify({ email: 'jamie@example.com', password: 'safePassword1' }),
  });
  assert.equal(response.status, 403);
});

test('journey estimates report unavailable providers instead of inventing a route', async () => {
  const response = await fetch(`${baseUrl}/api/v1/bookings/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({
      pickup: 'Heathrow Airport',
      dropoff: 'Central London',
      date: '2099-01-01',
      time: '12:00',
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.ok(['GEOCODER_UNAVAILABLE', 'FARE_CATALOG_UNAVAILABLE'].includes(body.error.code));
});

test('location search validates short queries before calling the geocoder', async () => {
  const response = await fetch(`${baseUrl}/api/v1/locations/suggest?q=ab`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('location search reports when the configured Photon service cannot be reached', async () => {
  const response = await fetch(`${baseUrl}/api/v1/locations/suggest?q=Heathrow`);
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.error.code, 'GEOCODER_UNAVAILABLE');
});

test('address suggestions reject fuzzy results that do not match the requested house number and street', async () => {
  const { rankAddressSuggestions } = await import('../dist/services/locationService.js');
  const suggestions = rankAddressSuggestions('141 Walton Avenue', [
    {
      properties: {
        osm_id: 1,
        name: 'Cook',
        housenumber: '139-141',
        street: 'Connaught Avenue',
        district: 'Frinton and Walton',
        city: 'Tendring',
        county: 'Essex',
        postcode: 'CO13 9PS',
      },
    },
    {
      properties: {
        osm_id: 2,
        housenumber: '141',
        street: 'Walton Avenue',
        city: 'Harwich',
        postcode: 'CO12 3AB',
      },
    },
  ]);

  assert.deepEqual(suggestions, [{ id: '2', label: '141 Walton Avenue, Harwich, CO12 3AB' }]);
});

test('address suggestions keep postcode-only searches usable', async () => {
  const { rankAddressSuggestions } = await import('../dist/services/locationService.js');
  const suggestions = rankAddressSuggestions('SW1A 1AA', [
    { properties: { osm_id: 3, name: 'Buckingham Palace', city: 'London', postcode: 'SW1A 1AA' } },
  ]);

  assert.equal(suggestions.length, 1);
  assert.match(suggestions[0].label, /SW1A 1AA/);
});

test('booking requests validate passenger details before database access', async () => {
  const response = await fetch(`${baseUrl}/api/v1/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ quoteToken: 'not-a-valid-token', vehicleId: '', passengers: 99, luggage: -1 }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});
