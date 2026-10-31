import type { JourneyQuote, VehicleOption } from '../types/booking';
import { apiUrl } from './apiUrl';

export interface QuoteRequest {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
}

export interface QuoteResponse {
  quote: JourneyQuote;
  quoteToken: string;
}

export interface BookingRequest {
  quoteToken: string;
  vehicleId: string;
  passengers: number;
  luggage: number;
  customer: { name: string; email: string; countryCode: string; phone: string };
  note: string;
}

export interface BookingConfirmation {
  bookingId: string;
  bookingReference: string;
  status: string;
  quote: JourneyQuote;
  vehicle: VehicleOption;
}

export interface BookingDetails {
  bookingReference: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  customer: { name: string; email: string; phone: string };
  pickup: { address: string };
  dropoff: { address: string };
  pickupAt: string;
  pickupTimezone: string;
  distanceMiles: number | null;
  durationSeconds: number | null;
  passengers: number;
  luggage: number;
  instructions: string;
  fare: { amount: number; currency: string };
  fareBreakdown: Array<{ label: string; amount: number }> | null;
  vehicle: {
    name: string | null;
    category: string | null;
    imageUrl: string | null;
    passengerCapacity: number | null;
    luggageCapacity: number | null;
  };
}

export interface BookingLookupResponse {
  booking: BookingDetails;
  support: {
    email: string | null;
    phone: string | null;
    cancellationPolicyUrl: string | null;
  };
}

export interface AccountBooking {
  id: string;
  bookingReference: string;
  vehicleId: string;
  vehicleName: string | null;
  vehicle: BookingDetails['vehicle'];
  customer: BookingDetails['customer'];
  pickup: { address: string; coordinates: [number, number] | null };
  dropoff: { address: string; coordinates: [number, number] | null };
  pickupAt: string;
  pickupTimezone: string;
  distanceMiles: number | null;
  durationSeconds: number | null;
  passengers: number;
  luggage: number;
  instructions: string;
  fare: BookingDetails['fare'];
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1/bookings${path}`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(result.error?.message ?? 'We could not complete that request.');
  }
  return (await response.json()) as T;
}

async function send<T>(path: string, method: 'GET' | 'PUT' | 'POST', body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1/bookings${path}`), {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok && response.status !== 410) {
    const result = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const error = new Error(result.error?.message ?? 'We could not complete that request.') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => ({}))) as T;
}

export const bookingApi = {
  quote: (input: QuoteRequest) => post<QuoteResponse>('/quote', input),
  lookup: (input: { bookingReference: string; email: string }) =>
    post<BookingLookupResponse>('/lookup', input),
  myBookings: (page = 1, limit = 10) => send<{
    bookings: AccountBooking[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/?page=${page}&limit=${limit}`, 'GET'),
  myBooking: (id: string) => send<{ booking: AccountBooking }>(`/${encodeURIComponent(id)}`, 'GET'),
  restoreProgress: (resumeToken?: string) => {
    const query = resumeToken ? `?resumeToken=${encodeURIComponent(resumeToken)}` : '';
    return send<{ progress?: unknown; expired?: boolean; completed?: boolean }>(`/progress${query}`, 'GET');
  },
  saveProgress: (input: unknown) => send<{ stage?: number; saved?: boolean }>('/progress', 'PUT', input),
  completeProgress: () => send<void>('/progress/complete', 'POST', {}),
  create: async (input: BookingRequest) => {
    const result = await post<{ booking: BookingConfirmation }>('', input);
    return result.booking;
  },
};
