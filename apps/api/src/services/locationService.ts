import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';
import { getSharedCache, setSharedCache } from './sharedCache.js';

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

export interface AddressSuggestion {
  id: string;
  label: string;
}

function serviceUrl(path: string) {
  return `${env.GEOCODER_BASE_URL.replace(/\/$/, '')}${path}`;
}

async function photon(url: URL): Promise<PhotonResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/geo+json, application/json', 'User-Agent': env.MAPS_USER_AGENT },
    });
  } catch {
    throw new HttpError(502, 'GEOCODER_UNAVAILABLE', 'Address suggestions are temporarily unavailable.');
  }
  if (!response.ok) {
    throw new HttpError(502, 'GEOCODER_ERROR', 'Address suggestions are temporarily unavailable.');
  }
  return (await response.json()) as PhotonResponse;
}

function addressLabel(properties: NonNullable<PhotonFeature['properties']>) {
  const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');
  const main = properties.name && properties.name !== street ? properties.name : street || properties.name;
  const locality = properties.city || properties.district || properties.county || properties.state;
  return [...new Set([main, locality, properties.postcode].filter(Boolean))].join(', ');
}

function words(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-GB')
    .match(/[\p{L}\p{N}]+/gu) ?? [];
}

function relevanceScore(query: string, properties: NonNullable<PhotonFeature['properties']>) {
  const queryWords = words(query);
  const compactQuery = query.replace(/\s+/g, '').toLocaleUpperCase('en-GB');
  const compactPostcode = properties.postcode?.replace(/\s+/g, '').toLocaleUpperCase('en-GB') ?? '';
  const isFullPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/i.test(compactQuery);
  if (isFullPostcode) return compactPostcode === compactQuery ? 100 : -1;

  const isPostcodeOutcode = /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(compactQuery);
  if (isPostcodeOutcode) return compactPostcode.startsWith(compactQuery) ? 100 : -1;

  const firstQueryWord = query.trim().split(/\s+/)[0] ?? '';
  const requestedHouseNumber = /^\d+[a-z]?$/i.test(firstQueryWord) ? words(firstQueryWord)[0] : null;
  const streetWords = queryWords.filter((word) => word !== requestedHouseNumber);
  const houseNumberWords = words(properties.housenumber ?? '');
  const namedHouseNumberWords = words([properties.name, properties.street].filter(Boolean).join(' '));

  // A geocoder may return a nearby/fuzzy result for a numbered address. Never
  // offer it unless the returned house number actually matches the request.
  if (
    requestedHouseNumber &&
    !houseNumberWords.includes(requestedHouseNumber) &&
    !namedHouseNumberWords.includes(requestedHouseNumber)
  ) {
    return -1;
  }

  const streetAndNameWords = words([properties.street, properties.name].filter(Boolean).join(' '));
  const matchedStreetWords = streetWords.filter((word) =>
    streetAndNameWords.some((streetWord) => streetWord === word || streetWord.startsWith(word)),
  );
  const requiredMatches = Math.min(streetWords.length, streetWords.length > 1 ? 2 : 1);
  if (matchedStreetWords.length < requiredMatches) return -1;

  const labelWords = words(addressLabel(properties));
  const queryPhrase = queryWords.join(' ');
  const labelPhrase = labelWords.join(' ');
  return matchedStreetWords.length * 10 + (labelPhrase.includes(queryPhrase) ? 5 : 0);
}

export function rankAddressSuggestions(query: string, features: PhotonFeature[]): AddressSuggestion[] {
  const ranked = features
    .flatMap((feature, index) => {
      const properties = feature.properties;
      const label = properties ? addressLabel(properties) : '';
      if (!label || !properties) return [];
      const score = relevanceScore(query, properties);
      if (score < 0) return [];
      const coordinates = feature.geometry?.coordinates?.join(',') ?? 'unknown';
      return [{ id: String(properties.osm_id ?? `${coordinates}-${index}`), label, score }];
    })
    .sort((first, second) => second.score - first.score);
  const unique = new Map<string, AddressSuggestion>();
  for (const { id, label } of ranked) {
    const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
    if (!unique.has(normalized)) unique.set(normalized, { id, label });
  }
  return [...unique.values()].slice(0, 5);
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const queryHash = createHash('sha256').update(query.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')).digest('hex');
  const key = `search:${queryHash}`;
  const fromCache = await getSharedCache<AddressSuggestion[]>(key);
  if (fromCache) return fromCache;

  const url = new URL(serviceUrl('/api'));
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '15');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('countrycode', 'gb');
  url.searchParams.set('lat', '51.5072');
  url.searchParams.set('lon', '-0.1276');
  url.searchParams.set('zoom', '8');
  const result = await photon(url);
  const suggestions = rankAddressSuggestions(query, result.features ?? []);
  await setSharedCache(key, suggestions, 3600);
  return suggestions;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const key = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const fromCache = await getSharedCache<string>(key);
  if (fromCache) return fromCache;

  const url = new URL(serviceUrl('/reverse'));
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('lang', 'en');
  const result = await photon(url);
  const properties = result.features?.[0]?.properties;
  const label = properties ? addressLabel(properties) : '';
  if (!label)
    throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'We could not find an address for your location.');
  await setSharedCache(key, label, 24 * 60 * 60);
  return label;
}
