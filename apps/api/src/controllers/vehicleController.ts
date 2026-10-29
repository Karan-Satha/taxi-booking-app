import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../middleware/errors.js';
import { createVehicle, disableVehicle, getVehicle, listVehicles, updateVehicle } from '../services/vehicleService.js';
import { uuidParamSchema, vehiclePatchSchema, vehicleSchema } from '../validation/vehicles.js';

function invalid(response: Response, fields: unknown) {
  response.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Check the vehicle fields and try again.', fields },
  });
}

export async function listAvailableVehicles(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ vehicles: await listVehicles(false) });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableVehicle(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid vehicle ID.'] });
  try {
    response.json({ vehicle: await getVehicle(id.data) });
  } catch (error) {
    next(error);
  }
}

export async function listManagedVehicles(_request: Request, response: Response, next: NextFunction) {
  try {
    response.json({ vehicles: await listVehicles(true) });
  } catch (error) {
    next(error);
  }
}

export async function getManagedVehicle(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid vehicle ID.'] });
  try {
    response.json({ vehicle: await getVehicle(id.data, true) });
  } catch (error) {
    next(error);
  }
}

export async function createManagedVehicle(request: Request, response: Response, next: NextFunction) {
  const parsed = vehicleSchema.safeParse(request.body);
  if (!parsed.success) return invalid(response, parsed.error.flatten().fieldErrors);
  try {
    response.status(201).json({ vehicle: await createVehicle(parsed.data) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      next(new HttpError(409, 'VEHICLE_EXISTS', 'A vehicle with that slug already exists.'));
      return;
    }
    next(error);
  }
}

export async function updateManagedVehicle(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  const parsed = vehiclePatchSchema.safeParse(request.body);
  if (!id.success || !parsed.success) {
    const fields = parsed.success ? { id: ['Enter a valid vehicle ID.'] } : parsed.error.flatten().fieldErrors;
    invalid(response, fields);
    return;
  }
  try {
    response.json({ vehicle: await updateVehicle(id.data, parsed.data) });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      next(new HttpError(409, 'VEHICLE_EXISTS', 'A vehicle with that slug already exists.'));
      return;
    }
    next(error);
  }
}

export async function disableManagedVehicle(request: Request, response: Response, next: NextFunction) {
  const id = uuidParamSchema.safeParse(request.params.id);
  if (!id.success) return invalid(response, { id: ['Enter a valid vehicle ID.'] });
  try {
    response.json({ vehicle: await disableVehicle(id.data) });
  } catch (error) {
    next(error);
  }
}
