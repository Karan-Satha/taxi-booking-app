export interface QuoteInput {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
}

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

export interface JourneyQuote extends QuoteInput {
  pickup: string;
  dropoff: string;
  distanceMetres: number;
  distanceMiles: number;
  durationSeconds: number;
  durationText: string;
  currency: 'GBP';
  pickupCoordinates: [number, number];
  dropoffCoordinates: [number, number];
  vehicles: VehicleOption[];
}

export interface BookingInput {
  quoteToken: string;
  vehicleId: string;
  passengers: number;
  luggage: number;
  customer: {
    name: string;
    email: string;
    countryCode: string;
    phone: string;
  };
  note: string;
}
