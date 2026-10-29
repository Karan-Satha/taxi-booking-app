import { apiUrl } from '../services/apiUrl';

export interface Account {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer';
}

export interface AdminAccount {
  adminId: string;
  name: string;
  email: string;
  role: 'admin';
}

export interface RegistrationDetails {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  password: string;
}

interface ApiErrorPayload {
  error?: { message?: string; fields?: Record<string, string[]> };
}

export class AuthRequestError extends Error {
  fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'AuthRequestError';
    this.fields = fields;
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1/auth${path}`), {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new AuthRequestError(
      payload.error?.message ?? 'We could not complete your request.',
      payload.error?.fields,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const authApi = {
  current: () => request<{ user: Account }>('/me'),
  login: (email: string, password: string) => request<{ user: Account }>('/login', { email, password }),
  register: (details: RegistrationDetails) => request<{ user: Account }>('/register', details),
  logout: () => request<void>('/logout', {}),
};

export class AdminAuthRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAuthRequestError';
  }
}

async function adminRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(apiUrl(`/api/v1/admin-auth${path}`), {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new AdminAuthRequestError(payload.error?.message ?? 'We could not complete administrator sign in.');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const adminAuthApi = {
  current: () => adminRequest<{ admin: AdminAccount }>('/me'),
  login: (email: string, password: string) => adminRequest<{ admin: AdminAccount }>('/login', { email, password }),
  logout: () => adminRequest<void>('/logout', {}),
};

