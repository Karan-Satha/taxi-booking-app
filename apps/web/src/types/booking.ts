export interface VehicleOption {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  passengers: number;
  luggage: number;
  fare: number;
}

export interface JourneyQuote {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  distanceMetres: number;
  distanceMiles: number;
  durationSeconds: number;
  durationText: string;
  currency: 'GBP';
  pickupCoordinates: [number, number];
  dropoffCoordinates: [number, number];
  vehicles: VehicleOption[];
}
