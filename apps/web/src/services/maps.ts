import { apiUrl } from './apiUrl';

export interface AddressSuggestion {
  id: string;
  label: string;
}

async function locationRequest<T>(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1/locations/${path}?${params.toString()}`), { signal });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(result.error?.message ?? 'Address service is temporarily unavailable.');
  }
  return (await response.json()) as T;
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  const result = await locationRequest<{ suggestions: AddressSuggestion[] }>('suggest', params, signal);
  return result.suggestions;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const result = await locationRequest<{ address: string }>('reverse', params);
  return result.address;
}

