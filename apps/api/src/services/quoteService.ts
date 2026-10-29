import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { pool } from '../config/database.js';
import { HttpError } from '../middleware/errors.js';
import type { JourneyQuote, QuoteInput, VehicleOption } from '../types/booking.js';
import { calculateFare } from './fareCalculator.js';

interface FarePlan {
  id: string | number;
  carType: string;
  category: string;
  carDescription: string;
  imgUrl?: string;
  person: string | number;
  luggage: string | number;
  farePerMinute: number;
  farePerMile: number;
  baseFare: number;
  minimumFare: number;
}

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  county?: string;
  state?: string;
}

interface PhotonResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: PhotonProperties;
  }>;
}

interface OsrmResponse {
  code?: string;
  routes?: Array<{ distance?: number; duration?: number }>;
}

interface SignedQuote {
  quote: JourneyQuote;
  expiresAt: number;
}

function serviceUrl(base: string, path: string) {
  return `${base.replace(/\/$/, '')}${path}`;
}

function numberFromCapacity(value: string | number): number {
  const capacity = Number.parseInt(String(value), 10);
  return Number.isFinite(capacity) ? capacity : 1;
}

async function geocode(address: string): Promise<[number, number]> {
  const url = new URL(serviceUrl(env.GEOCODER_BASE_URL, '/api'));
  url.searchParams.set('q', address);
  url.searchParams.set('limit', '1');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('countrycode', 'gb');

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': env.MAPS_USER_AGENT },
    });
  } catch {
    throw new HttpError(502, 'GEOCODER_UNAVAILABLE', 'Address lookup is temporarily unavailable.');
  }
  if (!response.ok) throw new HttpError(502, 'GEOCODER_ERROR', 'Address lookup is temporarily unavailable.');
  const data = (await response.json()) as PhotonResponse;
  const coordinates = data.features?.[0]?.geometry?.coordinates;
  if (!coordinates || !coordinates.every(Number.isFinite)) {
    throw new HttpError(
      422,
      'LOCATION_NOT_FOUND',
      'We could not locate one of those addresses. Please choose a suggestion.',
    );
  }
  return coordinates;
}

async function getRoute(input: QuoteInput) {
  const [origin, destination] = await Promise.all([geocode(input.pickup), geocode(input.dropoff)]);
  const points = [origin, destination].map(([longitude, latitude]) => `${longitude},${latitude}`).join(';');
  const url = new URL(serviceUrl(env.ROUTER_BASE_URL, `/route/v1/driving/${points}`));
  url.searchParams.set('overview', 'false');
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('steps', 'false');

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'User-Agent': env.MAPS_USER_AGENT },
    });
  } catch {
    throw new HttpError(502, 'ROUTER_UNAVAILABLE', 'We could not calculate this route. Please try again.');
  }
  if (!response.ok)
    throw new HttpError(502, 'ROUTER_ERROR', 'The route service could not calculate this journey.');
  const result = (await response.json()) as OsrmResponse;
  const route = result.routes?.[0];
  if (result.code !== 'Ok' || !route?.distance || !route.duration || route.duration <= 0) {
    throw new HttpError(422, 'ROUTE_NOT_FOUND', 'No driving route was found for those locations.');
  }
  return {
    distanceMetres: route.distance,
    // OSRM may return fractional seconds, while bookings store whole seconds in PostgreSQL.
    durationSeconds: Math.round(route.duration),
    pickupCoordinates: origin,
    dropoffCoordinates: destination,
  };
}

async function getFareCatalog(): Promise<FarePlan[]> {
  if (pool) {
    const result = await pool.query<{
      id: string;
      name: string;
      category: string;
      description: string;
      image_url: string;
      passenger_capacity: number;
      luggage_capacity: number;
      base_fare: string;
      price_per_mile: string;
      price_per_minute: string;
      minimum_fare: string;
    }>(
      `SELECT id, name, category, description, image_url, passenger_capacity, luggage_capacity,
              base_fare, price_per_mile, price_per_minute, minimum_fare
       FROM vehicles
       WHERE is_available = true
       ORDER BY base_fare, name`,
    );
    if (!result.rows.length) {
      throw new HttpError(503, 'VEHICLES_UNAVAILABLE', 'No vehicles are currently available.');
    }
    return result.rows.map((row) => ({
      id: row.id,
      carType: row.name,
      category: row.category,
      carDescription: row.description,
      imgUrl: row.image_url,
      person: row.passenger_capacity,
      luggage: row.luggage_capacity,
      baseFare: Number(row.base_fare),
      farePerMile: Number(row.price_per_mile),
      farePerMinute: Number(row.price_per_minute),
      minimumFare: Number(row.minimum_fare),
    }));
  }

  let response: Response;
  try {
    response = await fetch(env.FARE_CATALOG_URL, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(502, 'FARE_CATALOG_UNAVAILABLE', 'Vehicle prices are temporarily unavailable.');
  }
  if (!response.ok) {
    throw new HttpError(502, 'FARE_CATALOG_UNAVAILABLE', 'Vehicle prices are temporarily unavailable.');
  }
  let catalog: unknown;
  try {
    catalog = await response.json();
  } catch {
    throw new HttpError(502, 'FARE_CATALOG_INVALID', 'Vehicle prices could not be loaded.');
  }
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new HttpError(502, 'FARE_CATALOG_INVALID', 'Vehicle prices could not be loaded.');
  }
  const valid = catalog.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const plan = item as Partial<FarePlan>;
    return (
      [plan.farePerMinute, plan.farePerMile, plan.baseFare, plan.minimumFare].every(
        (rate) => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0,
      ) &&
      typeof plan.carType === 'string' &&
      typeof plan.person !== 'undefined'
    );
  });
  if (!valid) throw new HttpError(502, 'FARE_CATALOG_INVALID', 'Vehicle prices could not be loaded.');
  return (catalog as FarePlan[]).map((plan) => ({
    ...plan,
    category: plan.category || plan.carType,
  }));
}

function durationLabel(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours} hr ${remaining} min` : `${minutes} min`;
}

function signature(payload: string) {
  return createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
}

export function signQuote(quote: JourneyQuote): string {
  const payload = Buffer.from(JSON.stringify({ quote, expiresAt: Date.now() + 30 * 60 * 1000 })).toString(
    'base64url',
  );
  return `${payload}.${signature(payload)}`;
}

export function renewQuoteToken(token: string): { quote: JourneyQuote; quoteToken: string } | null {
  const [payload, tokenSignature, extra] = token.split('.');
  if (!payload || !tokenSignature || extra) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(tokenSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedQuote;
    if (!parsed.quote || !Array.isArray(parsed.quote.vehicles)) return null;
    return { quote: parsed.quote, quoteToken: signQuote(parsed.quote) };
  } catch {
    return null;
  }
}

export function verifyQuote(token: string): JourneyQuote {
  const [payload, tokenSignature, extra] = token.split('.');
  if (!payload || !tokenSignature || extra)
    throw new HttpError(400, 'QUOTE_EXPIRED', 'Please request a fresh fare estimate.');
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(tokenSignature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new HttpError(400, 'QUOTE_INVALID', 'Please request a fresh fare estimate.');
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedQuote;
    if (parsed.expiresAt < Date.now()) throw new Error('Expired');
    return parsed.quote;
  } catch {
    throw new HttpError(400, 'QUOTE_EXPIRED', 'Please request a fresh fare estimate.');
  }
}

export async function createQuote(input: QuoteInput): Promise<JourneyQuote> {
  const [route, catalog] = await Promise.all([getRoute(input), getFareCatalog()]);
  const miles = (route.distanceMetres / 1609.344).toFixed(1);
  const distanceMiles = Number(miles);
  const vehicles: VehicleOption[] = catalog.map((plan) => ({
    id: String(plan.id),
    name: plan.carType,
    description: plan.carDescription,
    imageUrl: plan.imgUrl ?? '',
    passengers: numberFromCapacity(plan.person),
    luggage: numberFromCapacity(plan.luggage),
    category: plan.category,
    fare: calculateFare(
      {
        baseFare: plan.baseFare,
        pricePerMile: plan.farePerMile,
        pricePerMinute: plan.farePerMinute,
        minimumFare: plan.minimumFare,
      },
      distanceMiles,
      route.durationSeconds,
    ),
  }));

  return {
    ...input,
    distanceMetres: route.distanceMetres,
    distanceMiles,
    durationSeconds: route.durationSeconds,
    durationText: durationLabel(route.durationSeconds),
    currency: 'GBP',
    vehicles,
    pickupCoordinates: route.pickupCoordinates,
    dropoffCoordinates: route.dropoffCoordinates,
  };
}
