import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { databaseConfigured, pool } from '../config/database.js';

if (!databaseConfigured || !pool) {
  throw new Error('DATABASE_URL is required to run migrations. Configure apps/api/.env first.');
}

const migrationsDirectory = fileURLToPath(new URL('../../../../database/migrations/', import.meta.url));
const migrations = (await readdir(migrationsDirectory)).filter((name) => name.endsWith('.sql')).sort();
const connection = await pool.connect();

try {
  await connection.query('SELECT pg_advisory_lock(796418205)');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    const applied = await connection.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migration]);
    if (applied.rowCount) {
      console.log(`Skipped ${migration} (already applied)`);
      continue;
    }

    const sql = await readFile(new URL(`../../../../database/migrations/${migration}`, import.meta.url), 'utf8');
    try {
      await connection.query('BEGIN');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration]);
      await connection.query('COMMIT');
      console.log(`Applied ${migration}`);
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await connection.query('SELECT pg_advisory_unlock(796418205)').catch(() => undefined);
  connection.release();
  await pool.end();
}
