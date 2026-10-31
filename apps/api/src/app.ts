import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { adminAuthRouter } from './routes/adminAuth.js';
import { adminRouter } from './routes/admin.js';
import { bookingsRouter } from './routes/bookings.js';
import { healthRouter } from './routes/health.js';
import { locationsRouter } from './routes/locations.js';
import { vehiclesRouter } from './routes/vehicles.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '32kb' }));
const PgSessionStore = connectPgSimple(session);
const adminSessionMiddleware = session({
  name: 'taxi.admin.sid',
  secret: env.SESSION_SECRET,
  store: pool ? new PgSessionStore({ pool, schemaName: 'public', tableName: 'admin_sessions' }) : undefined,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
  },
});
app.use(
  session({
    name: 'taxi.sid',
    secret: env.SESSION_SECRET,
    store: pool ? new PgSessionStore({ pool, schemaName: 'public', tableName: 'user_sessions' }) : undefined,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/locations', locationsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin-auth', adminSessionMiddleware, adminAuthRouter);
app.use('/api/v1/vehicles', vehiclesRouter);
app.use('/api/v1/admin', adminSessionMiddleware, adminRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use(notFound);
app.use(errorHandler);
