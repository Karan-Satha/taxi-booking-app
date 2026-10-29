import { app } from './app.js';
import { env } from './config/env.js';
import { startBookingRecoveryWorker } from './services/bookingProgressService.js';

app.listen(env.PORT, () => {
  console.log(`Taxi booking API listening on port ${env.PORT}`);
  startBookingRecoveryWorker();
});
