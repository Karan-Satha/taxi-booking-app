import { pool } from '../config/database.js';

const memory = new Map<string, { value: unknown; expiresAt: number }>();

export async function getSharedCache<T>(key: string): Promise<T | undefined> {
  const item = memory.get(key);
  if (item && item.expiresAt > Date.now()) return item.value as T;
  memory.delete(key);
  if (!pool) return undefined;
  try {
    const result = await pool.query<{ value: T }>(
      'SELECT value FROM service_cache WHERE cache_key = $1 AND expires_at > now()',
      [key],
    );
    const value = result.rows[0]?.value;
    if (value !== undefined) memory.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    return value;
  } catch {
    return undefined;
  }
}

export async function setSharedCache(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  memory.set(key, { value, expiresAt: Date.now() + Math.min(ttlSeconds, 300) * 1000 });
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO service_cache (cache_key, value, expires_at)
       VALUES ($1, $2::jsonb, now() + ($3::int * interval '1 second'))
       ON CONFLICT (cache_key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      [key, JSON.stringify(value), ttlSeconds],
    );
    await pool.query('DELETE FROM service_cache WHERE expires_at <= now()');
  } catch {
    // Cache outages should not prevent a fresh geocoding or route lookup.
  }
}
