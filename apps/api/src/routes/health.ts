import { Router } from 'express';
import { databaseConfigured, pool } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  let database: 'connected' | 'not_configured' | 'unavailable' | 'schema_not_migrated' = 'not_configured';
  if (databaseConfigured && pool) {
    try {
      const result = await pool.query<{
        users: string | null;
        vehicles: string | null;
        bookings: string | null;
        payments: string | null;
        schema_migrations: string | null;
      }>(
        `SELECT to_regclass('public.users') AS users,
                to_regclass('public.vehicles') AS vehicles,
                to_regclass('public.bookings') AS bookings,
                to_regclass('public.payments') AS payments,
                to_regclass('public.schema_migrations') AS schema_migrations`,
      );
      database = Object.values(result.rows[0]).every(Boolean) ? 'connected' : 'schema_not_migrated';
    } catch {
      database = 'unavailable';
    }
  }

  const isReady = database === 'connected' || database === 'not_configured';
  response.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'degraded',
    database,
  });
});
