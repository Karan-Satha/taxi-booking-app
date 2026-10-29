import { Pool } from 'pg';
import { env } from './env.js';

export const databaseConfigured = Boolean(env.DATABASE_URL);

export const pool = databaseConfigured
  ? new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.PG_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
      max: 10,
      connectionTimeoutMillis: 5000,
    })
  : null;
