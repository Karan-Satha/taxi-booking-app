import { app } from './app.js';
import { env } from './config/env.js';
import { startBookingRecoveryWorker } from './services/bookingProgressService.js';
import { logEmailDeliveryReadiness } from './services/emailService.js';

app.listen(env.PORT, () => {
  console.log(`Taxi booking API listening on port ${env.PORT}`);
  logEmailDeliveryReadiness();
  startBookingRecoveryWorker();
});
