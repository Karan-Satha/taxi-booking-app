import type { Store, IncrementResponse, Options } from 'express-rate-limit';
import { pool } from '../config/database.js';

export class PostgresRateLimitStore implements Store {
  private windowMs = 60_000;
  private readonly memory = new Map<string, { totalHits: number; resetTime: Date }>();
  private writes = 0;

  constructor(private readonly namespace: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private cacheKey(key: string) {
    return `${this.namespace}:${key}`;
  }

  async get(key: string) {
    const cacheKey = this.cacheKey(key);
    if (pool) {
      try {
        const result = await pool.query<{ hit_count: number; reset_at: Date }>(
          'SELECT hit_count, reset_at FROM api_rate_limits WHERE cache_key = $1 AND reset_at > now()',
          [cacheKey],
        );
        const row = result.rows[0];
        if (row) return { totalHits: Number(row.hit_count), resetTime: new Date(row.reset_at) };
      } catch {
        // Allow local startup before the shared rate-limit migration is applied.
      }
    }
    const current = this.memory.get(cacheKey);
    if (current && current.resetTime > new Date()) return current;
    this.memory.delete(cacheKey);
    return undefined;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const cacheKey = this.cacheKey(key);
    if (!pool) {
      const current = await this.get(key);
      const result = {
        totalHits: (current?.totalHits ?? 0) + 1,
        resetTime: current?.resetTime ?? new Date(Date.now() + this.windowMs),
      };
      this.memory.set(cacheKey, result);
      return result;
    }
    try {
      const result = await pool.query<{ hit_count: number; reset_at: Date }>(
        `INSERT INTO api_rate_limits (cache_key, hit_count, reset_at)
       VALUES ($1, 1, now() + ($2::int * interval '1 millisecond'))
       ON CONFLICT (cache_key) DO UPDATE SET
         hit_count = CASE WHEN api_rate_limits.reset_at <= now() THEN 1 ELSE api_rate_limits.hit_count + 1 END,
         reset_at = CASE WHEN api_rate_limits.reset_at <= now()
           THEN now() + ($2::int * interval '1 millisecond') ELSE api_rate_limits.reset_at END
       RETURNING hit_count, reset_at`,
        [cacheKey, this.windowMs],
      );
      this.writes += 1;
      if (this.writes % 100 === 0) {
        await pool.query('DELETE FROM api_rate_limits WHERE reset_at < now()').catch(() => undefined);
      }
      return { totalHits: Number(result.rows[0].hit_count), resetTime: new Date(result.rows[0].reset_at) };
    } catch {
      const current = await this.get(key);
      const fallback = {
        totalHits: (current?.totalHits ?? 0) + 1,
        resetTime: current?.resetTime ?? new Date(Date.now() + this.windowMs),
      };
      this.memory.set(cacheKey, fallback);
      return fallback;
    }
  }

  async decrement(key: string) {
    const cacheKey = this.cacheKey(key);
    if (!pool) {
      const current = await this.get(key);
      if (current) this.memory.set(cacheKey, { ...current, totalHits: Math.max(0, current.totalHits - 1) });
      return;
    }
    await pool.query('UPDATE api_rate_limits SET hit_count = GREATEST(0, hit_count - 1) WHERE cache_key = $1', [cacheKey]).catch(() => undefined);
  }

  async resetKey(key: string) {
    const cacheKey = this.cacheKey(key);
    this.memory.delete(cacheKey);
    if (pool) await pool.query('DELETE FROM api_rate_limits WHERE cache_key = $1', [cacheKey]).catch(() => undefined);
  }

  async resetAll() {
    this.memory.clear();
    if (pool) await pool.query('DELETE FROM api_rate_limits WHERE cache_key LIKE $1', [`${this.namespace}:%`]).catch(() => undefined);
  }
}
