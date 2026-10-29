import { z } from 'zod';

const fields = {
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(500).default(''),
  imageUrl: z.string().trim().max(2048).default(''),
  passengerCapacity: z.number().int().min(1).max(32),
  luggageCapacity: z.number().int().min(0).max(40),
  baseFare: z.number().finite().min(0),
  pricePerMile: z.number().finite().min(0),
  pricePerMinute: z.number().finite().min(0).default(0),
  minimumFare: z.number().finite().min(0).default(0),
  isAvailable: z.boolean().default(true),
};

export const vehicleSchema = z.object(fields);
export const vehiclePatchSchema = vehicleSchema.partial();

export const uuidParamSchema = z.string().uuid();
