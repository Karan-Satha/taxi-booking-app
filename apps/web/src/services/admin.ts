import { apiUrl } from './apiUrl';

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type AcceptanceEmailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'demo' | null;

export interface AdminBooking {
  id: string;
  bookingReference: string;
  customer: { name: string; email: string; phone: string };
  vehicleName: string | null;
  vehicle?: { name: string | null; category: string | null; imageUrl: string | null; passengerCapacity: number | null; luggageCapacity: number | null };
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
  status: BookingStatus;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  acceptanceEmailStatus?: AcceptanceEmailStatus;
}

interface ApiError {
  error?: { message?: string };
}

async function request<T>(path: string, method = 'GET'): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1/admin${path}`), {
    method,
    credentials: 'include',
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  });
  const payload = (response.status === 204 ? undefined : await response.json().catch(() => undefined)) as T & ApiError;
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? 'We could not complete this admin action.') as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export const adminApi = {
  bookings: (status?: string, page = 1) => request<{ bookings: AdminBooking[]; total: number; page: number; pageSize: number }>(
    `/bookings?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`,
  ),
  booking: (id: string) => request<{ booking: AdminBooking & { vehicleId: string } }>(`/bookings/${id}`),
  accept: (id: string) => request<{ booking: AdminBooking; emailStatus: string }>(`/bookings/${id}/accept`, 'POST'),
  reject: (id: string) => request<{ booking: AdminBooking }>(`/bookings/${id}/reject`, 'POST'),
  retryAcceptanceEmail: (id: string) =>
    request<{ emailStatus: string }>(`/bookings/${id}/acceptance-email/retry`, 'POST'),
};

