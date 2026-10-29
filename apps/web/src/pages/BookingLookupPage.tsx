import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi, type BookingLookupResponse } from '../services/bookings';

function BookingIcon({ name }: { name: 'route' | 'time' | 'vehicle' | 'passenger' | 'fare' }) {
  const paths = {
    route: <><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.3" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    vehicle: <><path d="m5 11 1.5-4h11L19 11" /><path d="M4 11h16v7H4zM7 18v2m10-2v2M7 14h.01M17 14h.01" /></>,
    passenger: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 5.5a3 3 0 0 1 0 5.8m1 3a5 5 0 0 1 3.5 4.8V20h-4" />
      </>
    ),
    fare: (
      <>
        <path d="M12 2v20m5-15.5C16.2 5.5 14.5 5 12 5c-2.8 0-4.5 1-4.5 3s1.7 3 4.5 3 4.5 1 4.5 3-1.7 3-4.5 3c-2.4 0-4.1-.6-5-1.5" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" className="booking-details__icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string, timezone: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: timezone }).format(date);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return 'Not available';
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours} hr ${remainingMinutes} min` : `${minutes} min`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function BookingDetailsView({ result }: { result: BookingLookupResponse }) {
  const { booking, support } = result;
  const statusClass = booking.status.replaceAll('_', '-');
  const vehicleImage = booking.vehicle.imageUrl;

  return (
    <section className="booking-details" aria-labelledby="booking-details-title" aria-live="polite">
      <div className="booking-details__topline">
        <div>
          <p className="eyebrow">BOOKING FOUND</p>
          <h2 id="booking-details-title">Your journey details</h2>
        </div>
        <span className={`booking-details__status booking-details__status--${statusClass}`}>
          {formatStatus(booking.status)}
        </span>
      </div>

      <div className="booking-details__reference">
        <span>Booking reference</span>
        <strong>{booking.bookingReference}</strong>
        <span className="booking-details__created">
          Booked {formatDateTime(booking.createdAt, booking.pickupTimezone, { dateStyle: 'medium' })}
        </span>
      </div>

      <section className="booking-details__section" aria-labelledby="journey-title">
        <h3 id="journey-title"><BookingIcon name="route" /> Journey</h3>
        <div className="booking-details__route">
          <div><span>Pickup</span><strong>{booking.pickup.address}</strong></div>
          <div><span>Destination</span><strong>{booking.dropoff.address}</strong></div>
        </div>
        <div className="booking-details__grid">
          <div><span>Pickup date and time</span><strong>
            {formatDateTime(booking.pickupAt, booking.pickupTimezone, { dateStyle: 'medium', timeStyle: 'short' })}
          </strong><small>{booking.pickupTimezone}</small></div>
          <div><span>Distance</span><strong>
            {booking.distanceMiles === null ? 'Not available' : `${booking.distanceMiles.toFixed(1)} miles`}
          </strong></div>
          <div><span>Estimated duration</span><strong>{formatDuration(booking.durationSeconds)}</strong></div>
        </div>
      </section>

      <section className="booking-details__section" aria-labelledby="vehicle-title">
        <h3 id="vehicle-title"><BookingIcon name="vehicle" /> Vehicle</h3>
        <div className="booking-details__vehicle">
          {vehicleImage && <img src={vehicleImage} alt={booking.vehicle.name ?? 'Selected vehicle'} />}
          <div>
            <strong>{booking.vehicle.name ?? 'Vehicle'}</strong>
            <span>{booking.vehicle.category ?? 'Category unavailable'}</span>
          </div>
          <div className="booking-details__capacity">
            <span>
              <BookingIcon name="passenger" /> {booking.passengers} of{' '}
              {booking.vehicle.passengerCapacity ?? '—'} passengers
            </span>
            <span>{booking.luggage} of {booking.vehicle.luggageCapacity ?? '—'} luggage items</span>
          </div>
        </div>
      </section>

      <section className="booking-details__section" aria-labelledby="fare-title">
        <h3 id="fare-title"><BookingIcon name="fare" /> Fare and payment</h3>
        <div className="booking-details__fare">
          {booking.fareBreakdown?.length ? (
            booking.fareBreakdown.map((line, index) => (
              <div className="booking-details__fare-line" key={`${line.label}-${index}`}>
                <span>{line.label}</span><span>{formatMoney(line.amount, booking.fare.currency)}</span>
              </div>
            ))
          ) : (
            <p className="booking-details__not-available">
              An itemised fare breakdown is not available for this booking.
            </p>
          )}
          <div className="booking-details__fare-total">
            <strong>Estimated total</strong><strong>{formatMoney(booking.fare.amount, booking.fare.currency)}</strong>
          </div>
          <div className="booking-details__payment">
            Payment status <strong>{formatStatus(booking.paymentStatus)}</strong>
          </div>
        </div>
      </section>

      <section className="booking-details__section" aria-labelledby="passenger-title">
        <h3 id="passenger-title"><BookingIcon name="passenger" /> Passenger details</h3>
        <div className="booking-details__grid booking-details__grid--passenger">
          <div><span>Name</span><strong>{booking.customer.name}</strong></div>
          <div><span>Email</span><strong>{booking.customer.email}</strong></div>
          <div><span>Phone</span><strong>{booking.customer.phone}</strong></div>
        </div>
      </section>

      <section className="booking-details__section booking-details__section--last" aria-labelledby="additional-title">
        <h3 id="additional-title">Additional information</h3>
        <p className="booking-details__instructions">
          {booking.instructions || 'No special instructions were added to this booking.'}
        </p>
        {(support.email || support.phone || support.cancellationPolicyUrl) && (
          <div className="booking-details__support">
            <strong>Need to make a change?</strong>
            <span>Contact support for help with this booking.</span>
            {support.email && <a href={`mailto:${support.email}`}>{support.email}</a>}
            {support.phone && <a href={`tel:${support.phone.replace(/[^+\d]/g, '')}`}>{support.phone}</a>}
            {support.cancellationPolicyUrl && <a href={support.cancellationPolicyUrl}>Cancellation policy</a>}
          </div>
        )}
      </section>
    </section>
  );
}

export function BookingLookupPage() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<BookingLookupResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!reference.trim()) {
      setError('Please enter your booking reference.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter the email address used for your booking.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      setResult(await bookingApi.lookup({ bookingReference: reference.trim(), email: email.trim() }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We couldn’t retrieve that booking. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="booking-lookup-page">
      <div className="booking-lookup-page__inner">
        <Link className="booking-lookup-page__back" to="/">← Back to Heathrow Drive</Link>
        <section className="booking-lookup" aria-labelledby="booking-lookup-title">
          <div className="booking-lookup__intro">
            <p className="eyebrow">YOUR JOURNEY</p>
            <h1 id="booking-lookup-title">View your booking</h1>
            <p>Enter the reference from your confirmation email and the email address used to book.</p>
          </div>
          <form className="booking-lookup__form" onSubmit={submit} noValidate>
            <label className="booking-lookup__field">
              <span>Booking reference</span>
              <input
                name="bookingReference"
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                minLength={4}
                maxLength={24}
                pattern="[A-Za-z0-9-]+"
                placeholder="For example, HD-ABC123DEF456"
                required
              />
            </label>
            <label className="booking-lookup__field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                placeholder="Email address used for the booking"
                required
              />
            </label>
            <p className="booking-lookup__privacy">
              Your details are checked securely and are not added to the page address.
            </p>
            {error && <p className="booking-lookup__error form-validation-message" role="alert">{error}</p>}
            <button className="button button--primary booking-lookup__submit" disabled={busy}>
              {busy ? 'Looking up booking…' : 'View Booking Details'} <span aria-hidden="true">→</span>
            </button>
          </form>
          {result && <BookingDetailsView result={result} />}
        </section>
        <p className="booking-lookup-page__help">
          Can’t find your reference? Check the confirmation email or return to the{' '}
          <Link to="/">homepage</Link>.
        </p>
      </div>
    </main>
  );
}
