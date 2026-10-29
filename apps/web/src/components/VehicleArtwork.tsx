interface VehicleArtworkProps {
  name: string;
  passengers: number;
}

function vehicleCategory(name: string, passengers: number) {
  const category = name.toLowerCase();
  if (/minibus|microbus|coach/.test(category)) return 'minibus';
  if (/mpv|people carrier|van|shuttle|\bxl\b|family/.test(category)) return 'mpv';
  if (/estate|wagon|touring/.test(category)) return 'estate';
  if (/executive|premium|luxury|business|first class/.test(category)) return 'executive';
  if (passengers >= 8) return 'minibus';
  if (passengers > 4) return 'mpv';
  return 'saloon';
}

export function VehicleArtwork({ name, passengers }: VehicleArtworkProps) {
  const category = vehicleCategory(name, passengers);
  const labels = {
    saloon: 'Standard saloon',
    estate: 'Estate car',
    executive: 'Executive saloon',
    mpv: 'MPV people carrier',
    minibus: 'Minibus',
  };

  return (
    <img
      className={`vehicle-option__image vehicle-option__image--${category}`}
      src={`/images/vehicles/${category}.webp`}
      alt={`${labels[category]} vehicle`}
      loading="lazy"
      decoding="async"
    />
  );
}

export function PassengerIcon() {
  return (
    <svg className="vehicle-option__icon--passenger" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="10" cy="6" r="3" />
      <path d="M4 17v-1.5a6 6 0 0 1 12 0V17z" />
    </svg>
  );
}

export function LuggageIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5.5 3.2V2.5A1.5 1.5 0 0 1 7 1h2a1.5 1.5 0 0 1 1.5 1.5v.7h1.8A1.7 1.7 0 0 1 14 4.9v7.4a1.7 1.7 0 0 1-1.7 1.7H3.7A1.7 1.7 0 0 1 2 12.3V4.9a1.7 1.7 0 0 1 1.7-1.7h1.8Zm1.5 0h2v-.7a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v.7ZM5 5v7h1V5H5Zm5 0v7h1V5h-1Z" />
    </svg>
  );
}
