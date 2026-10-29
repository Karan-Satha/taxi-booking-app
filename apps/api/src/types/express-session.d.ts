import 'express-session';
import type { Account, AdminAccount } from './auth.js';

declare module 'express-session' {
  interface SessionData {
    user?: Account;
    admin?: AdminAccount;
    bookingProgressInitialized?: boolean;
  }
}
