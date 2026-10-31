import { Router } from 'express';
import { getAvailableVehicle, listAvailableVehicles } from '../controllers/vehicleController.js';

export const vehiclesRouter = Router();
vehiclesRouter.get('/', listAvailableVehicles);
vehiclesRouter.get('/:id', getAvailableVehicle);
