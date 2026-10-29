import { z } from 'zod';

export const searchLocationSchema = z.object({
  q: z.string().trim().min(3).max(200),
});

export const reverseLocationSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180),
});
