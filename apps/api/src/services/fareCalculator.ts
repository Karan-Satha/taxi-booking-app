export interface FareRates {
  baseFare: number | string;
  pricePerMile: number | string;
  pricePerMinute: number | string;
  minimumFare: number | string;
}

export function calculateFare(rates: FareRates, distanceMiles: number, durationSeconds: number): number {
  const baseFare = Number(rates.baseFare);
  const pricePerMile = Number(rates.pricePerMile);
  const pricePerMinute = Number(rates.pricePerMinute);
  const minimumFare = Number(rates.minimumFare);
  const values = [baseFare, pricePerMile, pricePerMinute, minimumFare, distanceMiles, durationSeconds];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Fare inputs must be finite, non-negative numbers.');
  }

  const subtotal = baseFare + pricePerMile * distanceMiles + pricePerMinute * (durationSeconds / 60);
  return Math.round(Math.max(minimumFare, subtotal));
}
