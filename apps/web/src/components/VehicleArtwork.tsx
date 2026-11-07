interface VehicleArtworkProps {
  name: string;
  passengers: number;
  priority?: boolean;
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

export function VehicleArtwork({ name, passengers, priority = false }: VehicleArtworkProps) {
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
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}

export function PassengerIcon() {
  return (
    <svg
      className="vehicle-option__icon--passenger"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export function LuggageIcon() {
  return (
    <svg
      className="vehicle-option__icon--luggage"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="7" width="14" height="14" rx="2" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2M9 11v6m6-6v6" />
    </svg>
  );
}
