import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { access, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { databaseConfigured, pool } from '../config/database.js';
import { env } from '../config/env.js';

const input = z.object({
  TEMP_ADMIN_ACTION: z.enum(['provision', 'rotate', 'disable']).default('provision'),
  TEMP_ADMIN_EMAIL: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  TEMP_ADMIN_PASSWORD: z.string().min(16).max(72).optional(),
  TEMP_ADMIN_FIRST_NAME: z.string().trim().min(1).max(60).default('Temporary'),
  TEMP_ADMIN_LAST_NAME: z.string().trim().max(60).default('Administrator'),
});

const parsed = input.safeParse(process.env);
if (!parsed.success) {
  console.error('Admin provisioning configuration is invalid. Check TEMP_ADMIN_* values; passwords must be at least 16 characters.');
  process.exitCode = 1;
} else if (!databaseConfigured || !pool) {
  console.error('DATABASE_URL is required. Configure apps/api/.env first.');
  process.exitCode = 1;
} else {
  const values = parsed.data;
  const passwordFile = fileURLToPath(new URL('../../.temporary-admin-credentials', import.meta.url));
  let createdPasswordFile = false;
  try {
    let password = values.TEMP_ADMIN_PASSWORD;
    if (values.TEMP_ADMIN_ACTION !== 'disable' && !password) {
      try {
        await access(passwordFile);
        throw new Error('Remove the previous temporary credential file before provisioning or rotating another password.');
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Remove the previous')) throw error;
      }
      password = randomBytes(24).toString('base64url');
      await writeFile(passwordFile,
        `Admin login: ${new URL('/admin/login', env.WEB_ORIGIN).toString()}\nEmail: ${values.TEMP_ADMIN_EMAIL}\nPassword: ${password}\n`,
        { flag: 'wx', mode: 0o600 },
      );
      createdPasswordFile = true;
    }

    if (values.TEMP_ADMIN_ACTION === 'provision') {
      const hash = await bcrypt.hash(password!, 12);
      await pool.query(
        `INSERT INTO admins (first_name, last_name, email, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'admin', 'active')
         ON CONFLICT (lower(email)) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, role = 'admin', status = 'active', updated_at = now()`,
        [values.TEMP_ADMIN_FIRST_NAME, values.TEMP_ADMIN_LAST_NAME, values.TEMP_ADMIN_EMAIL, hash],
      );
      console.log(`Temporary administrator account provisioned for ${values.TEMP_ADMIN_EMAIL}.`);
    } else if (values.TEMP_ADMIN_ACTION === 'rotate') {
      const hash = await bcrypt.hash(password!, 12);
      const updated = await pool.query(
        `UPDATE admins SET password_hash = $2, updated_at = now()
         WHERE lower(email) = $1 AND role = 'admin'`,
        [values.TEMP_ADMIN_EMAIL, hash],
      );
      if (!updated.rowCount) throw new Error('No administrator account matched that email.');
      console.log(`Administrator password updated for ${values.TEMP_ADMIN_EMAIL}.`);
    } else {
      const disabled = await pool.query(
        `UPDATE admins SET status = 'disabled', updated_at = now()
         WHERE lower(email) = $1 AND role = 'admin'`,
        [values.TEMP_ADMIN_EMAIL],
      );
      if (!disabled.rowCount) throw new Error('No administrator account matched that email.');
      console.log(`Administrator account disabled for ${values.TEMP_ADMIN_EMAIL}.`);
    }
  } catch (error) {
    if (createdPasswordFile) await unlink(passwordFile).catch(() => undefined);
    console.error(error instanceof Error ? error.message : 'Admin provisioning failed.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
