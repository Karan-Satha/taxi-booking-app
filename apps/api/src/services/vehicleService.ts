import { pool } from '../config/database.js';
import { HttpError } from '../middleware/errors.js';

export interface VehicleInput {
  slug: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  passengerCapacity: number;
  luggageCapacity: number;
  baseFare: number;
  pricePerMile: number;
  pricePerMinute: number;
  minimumFare: number;
  isAvailable: boolean;
}

type VehiclePatch = Partial<VehicleInput>;

interface VehicleRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  image_url: string;
  passenger_capacity: number;
  luggage_capacity: number;
  base_fare: string;
  price_per_mile: string;
  price_per_minute: string;
  minimum_fare: string;
  is_available: boolean;
  created_at: Date;
  updated_at: Date;
}

function database() {
  if (!pool) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Vehicle management requires a database.');
  return pool;
}

function toVehicle(row: VehicleRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    imageUrl: row.image_url,
    passengerCapacity: row.passenger_capacity,
    luggageCapacity: row.luggage_capacity,
    baseFare: Number(row.base_fare),
    pricePerMile: Number(row.price_per_mile),
    pricePerMinute: Number(row.price_per_minute),
    minimumFare: Number(row.minimum_fare),
    isAvailable: row.is_available,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const vehicleColumns = `id, slug, name, category, description, image_url, passenger_capacity,
  luggage_capacity, base_fare, price_per_mile, price_per_minute, minimum_fare, is_available, created_at, updated_at`;

export async function listVehicles(includeUnavailable = false) {
  const result = await database().query<VehicleRow>(
    `SELECT ${vehicleColumns} FROM vehicles
     WHERE ($1::boolean OR is_available = true)
     ORDER BY is_available DESC, base_fare, name`,
    [includeUnavailable],
  );
  return result.rows.map(toVehicle);
}

export async function getVehicle(id: string, includeUnavailable = false) {
  const result = await database().query<VehicleRow>(
    `SELECT ${vehicleColumns} FROM vehicles WHERE id = $1::uuid AND ($2::boolean OR is_available = true)`,
    [id, includeUnavailable],
  );
  if (!result.rows[0]) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  return toVehicle(result.rows[0]);
}

export async function createVehicle(input: VehicleInput) {
  const result = await database().query<VehicleRow>(
    `INSERT INTO vehicles (
      slug, name, category, description, image_url, passenger_capacity, luggage_capacity,
      base_fare, price_per_mile, price_per_minute, minimum_fare, is_available
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING ${vehicleColumns}`,
    [
      input.slug,
      input.name,
      input.category,
      input.description,
      input.imageUrl,
      input.passengerCapacity,
      input.luggageCapacity,
      input.baseFare,
      input.pricePerMile,
      input.pricePerMinute,
      input.minimumFare,
      input.isAvailable,
    ],
  );
  return toVehicle(result.rows[0]);
}

const updateColumns: Record<keyof VehicleInput, string> = {
  slug: 'slug',
  name: 'name',
  category: 'category',
  description: 'description',
  imageUrl: 'image_url',
  passengerCapacity: 'passenger_capacity',
  luggageCapacity: 'luggage_capacity',
  baseFare: 'base_fare',
  pricePerMile: 'price_per_mile',
  pricePerMinute: 'price_per_minute',
  minimumFare: 'minimum_fare',
  isAvailable: 'is_available',
};

export async function updateVehicle(id: string, patch: VehiclePatch) {
  const entries = Object.entries(patch) as Array<[keyof VehicleInput, VehicleInput[keyof VehicleInput]]>;
  if (!entries.length) throw new HttpError(400, 'EMPTY_UPDATE', 'Provide at least one vehicle field to update.');
  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${updateColumns[key]} = $${index + 2}`);
  const result = await database().query<VehicleRow>(
    `UPDATE vehicles SET ${assignments.join(', ')}, updated_at = now()
     WHERE id = $1::uuid RETURNING ${vehicleColumns}`,
    [id, ...values],
  );
  if (!result.rows[0]) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  return toVehicle(result.rows[0]);
}

export async function disableVehicle(id: string) {
  const result = await database().query<VehicleRow>(
    `UPDATE vehicles SET is_available = false, updated_at = now()
     WHERE id = $1::uuid RETURNING ${vehicleColumns}`,
    [id],
  );
  if (!result.rows[0]) throw new HttpError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found.');
  return toVehicle(result.rows[0]);
}
