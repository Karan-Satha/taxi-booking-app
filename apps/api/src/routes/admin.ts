import { Router } from 'express';
import {
  acceptBookingAdmin,
  cancelBookingAdmin,
  getBookingAdmin,
  listBookingsAdmin,
  updateBookingAdmin,
  retryBookingAcceptanceEmail,
  rejectBookingAdmin,
} from '../controllers/bookingManagementController.js';
import {
  createManagedVehicle,
  disableManagedVehicle,
  getManagedVehicle,
  listManagedVehicles,
  updateManagedVehicle,
} from '../controllers/vehicleController.js';
import { createUser, disableUser, getUser, listUsers, updateUser } from '../controllers/adminUserController.js';
import { requireAdmin } from '../middleware/authorization.js';
import { requireTrustedOrigin } from '../middleware/trustedOrigin.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/vehicles', listManagedVehicles);
adminRouter.get('/vehicles/:id', getManagedVehicle);
adminRouter.post('/vehicles', requireTrustedOrigin, createManagedVehicle);
adminRouter.patch('/vehicles/:id', requireTrustedOrigin, updateManagedVehicle);
adminRouter.delete('/vehicles/:id', requireTrustedOrigin, disableManagedVehicle);

adminRouter.get('/users', listUsers);
adminRouter.get('/users/:id', getUser);
adminRouter.post('/users', requireTrustedOrigin, createUser);
adminRouter.patch('/users/:id', requireTrustedOrigin, updateUser);
adminRouter.delete('/users/:id', requireTrustedOrigin, disableUser);

adminRouter.get('/bookings', listBookingsAdmin);
adminRouter.get('/bookings/:id', getBookingAdmin);
adminRouter.post('/bookings/:id/accept', requireTrustedOrigin, acceptBookingAdmin);
adminRouter.post('/bookings/:id/reject', requireTrustedOrigin, rejectBookingAdmin);
adminRouter.post('/bookings/:id/acceptance-email/retry', requireTrustedOrigin, retryBookingAcceptanceEmail);
adminRouter.patch('/bookings/:id', requireTrustedOrigin, updateBookingAdmin);
adminRouter.delete('/bookings/:id', requireTrustedOrigin, cancelBookingAdmin);
