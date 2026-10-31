import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AuthRequestError } from '../types/auth';
import { bookingApi, type AccountBooking } from '../services/bookings';

function AuthFrame({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-card__copy">{copy}</p>
        {children}
      </section>
    </main>
  );
}

export function LoginPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const { account, loading: checking, login, adminAccount, adminLoading, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if ((adminOnly && adminLoading) || (!adminOnly && checking))
    return (
      <main className="auth-page">
        <p role="status">Checking your account…</p>
      </main>
    );
  if (adminOnly && adminAccount) return <Navigate to="/admin" replace />;
  if (!adminOnly && account) return <Navigate to="/account" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    if (!email) {
      setError('Please enter your email address.');
      setBusy(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      setBusy(false);
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      setBusy(false);
      return;
    }
    try {
      if (adminOnly) {
        await adminLogin(email, password);
        navigate('/admin');
      } else {
        await login(email, password);
        navigate('/account');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      eyebrow={adminOnly ? 'ADMINISTRATOR ACCESS' : 'WELCOME BACK'}
      title={adminOnly ? 'Admin sign in' : 'Sign in to your account'}
      copy={adminOnly ? 'Sign in with an authorised administrator account to manage customer bookings.' : 'Your saved details make planning your next journey easier.'}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-form__field">
          <span>Email address</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label className="auth-form__field">
          <span>Password</span>
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p className="auth-form__error form-validation-message" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary auth-form__submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span>
        </button>
      </form>
      {!adminOnly && <p className="auth-card__switch">New here? <Link to="/register">Create an account</Link></p>}
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { account, loading: checking, register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  if (checking)
    return (
      <main className="auth-page">
        <p role="status">Checking your account…</p>
      </main>
    );
  if (account) return <Navigate to="/account" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const email = String(data.get('email')).trim();
    const countryCode = String(data.get('countryCode')).trim();
    const phone = String(data.get('phone')).trim();
    const password = String(data.get('password'));
    const passwordConfirmation = String(data.get('passwordConfirmation'));
    if (name.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(email ? 'Please enter a valid email address.' : 'Please enter your email address.');
      return;
    }
    if (!/^\+\d{1,4}$/.test(countryCode)) {
      setError('Please enter a valid country code.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 6) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 8 characters, including a letter and a number.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Please make sure both passwords match.');
      return;
    }
    setBusy(true);
    try {
      await register({
        name,
        email,
        countryCode,
        phone,
        password,
      });
      navigate('/account');
    } catch (reason) {
      if (reason instanceof AuthRequestError) setFieldErrors(reason.fields ?? {});
      setError(reason instanceof Error ? reason.message : 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      eyebrow="GET STARTED"
      title="Create your account"
      copy="A few details now, for a smoother journey later."
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-form__field">
          <span>Full name</span>
          <input name="name" autoComplete="name" minLength={2} maxLength={100} required />
        </label>
        <label className="auth-form__field">
          <span>Email address</span>
          <input type="email" name="email" autoComplete="email" required />
          {fieldErrors.email?.[0] && <small>{fieldErrors.email[0]}</small>}
        </label>
        <div className="auth-form__phone">
          <label className="auth-form__field">
            <span>Country code</span>
            <input name="countryCode" defaultValue="+44" autoComplete="tel-country-code" required />
          </label>
          <label className="auth-form__field">
            <span>Phone number</span>
            <input type="tel" name="phone" autoComplete="tel-national" required />
          </label>
        </div>
        <label className="auth-form__field">
          <span>Password</span>
          <input type="password" name="password" autoComplete="new-password" minLength={8} required />
          <small>At least 8 characters, including a letter and a number.</small>
        </label>
        <label className="auth-form__field">
          <span>Confirm password</span>
          <input type="password" name="passwordConfirmation" autoComplete="new-password" required />
        </label>
        {error && (
          <p className="auth-form__error form-validation-message" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary auth-form__submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'} <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="auth-card__switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthFrame>
  );
}

export function AccountPage() {
  const { account, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (loading)
    return (
      <main className="auth-page">
        <p role="status">Loading your account…</p>
      </main>
    );
  if (!account) return <Navigate to="/login" replace />;
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/');
    } catch {
      setError('We could not sign you out. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      eyebrow="YOUR ACCOUNT"
      title={`Hello, ${account.name.split(' ')[0]}`}
      copy="Your account details are ready for your next journey."
    >
      <dl className="account-details">
        <div>
          <dt>Name</dt>
          <dd>{account.name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{account.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{account.phone}</dd>
        </div>
      </dl>
      <Link className="button button--primary auth-form__submit account-details__bookings-link" to="/account/bookings">
        View my bookings <span aria-hidden="true">→</span>
      </Link>
      {error && (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--primary auth-form__submit" onClick={signOut} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'} <span aria-hidden="true">→</span>
      </button>
    </AuthFrame>
  );
}

function accountStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function accountDate(value: string, timezone: string, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
    timeZone: timezone,
  }).format(date);
}

function accountFare(booking: AccountBooking) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: booking.fare.currency,
  }).format(booking.fare.amount);
}

function MyBookingCard({ booking }: { booking: AccountBooking }) {
  const statusClass = booking.status.toLowerCase().replaceAll('_', '-');
  return (
    <details className="my-booking">
      <summary className="my-booking__summary">
        <div className="my-booking__main">
          <span className="my-booking__reference">{booking.bookingReference}</span>
          <strong>{booking.vehicle.name ?? booking.vehicleName ?? 'Vehicle booking'}</strong>
          <span>{accountDate(booking.pickupAt, booking.pickupTimezone)}</span>
        </div>
        <span className={`my-booking__status my-booking__status--${statusClass}`}>{accountStatus(booking.status)}</span>
        <strong className="my-booking__price">{accountFare(booking)}</strong>
        <span className="my-booking__expand" aria-hidden="true">⌄</span>
      </summary>
      <div className="my-booking__details">
        {booking.status === 'pending' && <p className="my-booking__notice">Your booking is waiting for administrator approval. We’ll email you when its status changes.</p>}
        {booking.status === 'accepted' && <p className="my-booking__notice my-booking__notice--accepted">Your booking has been accepted. Check your email for the confirmation details.</p>}
        {booking.status === 'rejected' && <p className="my-booking__notice my-booking__notice--rejected">This booking request was not accepted. Please contact support if you need help.</p>}
        <div className="my-booking__route">
          <div><span>Pickup</span><strong>{booking.pickup.address}</strong></div>
          <span className="my-booking__route-arrow" aria-hidden="true">→</span>
          <div><span>Destination</span><strong>{booking.dropoff.address}</strong></div>
        </div>
        <div className="my-booking__facts">
          <div><span>Pickup date and time</span><strong>{accountDate(booking.pickupAt, booking.pickupTimezone)}</strong></div>
          <div><span>Booked on</span><strong>{accountDate(booking.createdAt, booking.pickupTimezone, false)}</strong></div>
          <div><span>Distance</span><strong>{booking.distanceMiles === null ? 'Not available' : `${booking.distanceMiles.toFixed(1)} miles`}</strong></div>
          <div><span>Estimated duration</span><strong>{booking.durationSeconds === null ? 'Not available' : `${Math.floor(booking.durationSeconds / 3600)} hr ${Math.round((booking.durationSeconds % 3600) / 60)} min`}</strong></div>
          <div><span>Passengers</span><strong>{booking.passengers} of {booking.vehicle.passengerCapacity ?? '—'}</strong></div>
          <div><span>Luggage</span><strong>{booking.luggage} of {booking.vehicle.luggageCapacity ?? '—'} bags</strong></div>
          <div><span>Payment</span><strong>{accountStatus(booking.paymentStatus)}</strong></div>
          <div><span>Fare</span><strong>{accountFare(booking)}</strong></div>
        </div>
        <div className="my-booking__vehicle">
          {booking.vehicle.imageUrl && <img src={booking.vehicle.imageUrl} alt={booking.vehicle.name ?? 'Selected vehicle'} />}
          <div><strong>{booking.vehicle.name ?? booking.vehicleName ?? 'Selected vehicle'}</strong><span>{booking.vehicle.category ?? 'Vehicle category'}</span></div>
        </div>
        {booking.instructions && <p className="my-booking__instructions"><strong>Journey note:</strong> {booking.instructions}</p>}
        <Link className="my-booking__lookup" to="/booking-details">Open booking lookup <span aria-hidden="true">→</span></Link>
      </div>
    </details>
  );
}

export function MyBookingsPage() {
  const { account, loading: accountLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<AccountBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 10;

  const loadBookings = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await bookingApi.myBookings(page, pageSize);
      setBookings(result.bookings);
      setTotal(result.total);
    } catch (reason) {
      const status = (reason as Error & { status?: number }).status;
      if (status === 401) {
        await logout().catch(() => undefined);
        setError('Your sign-in has expired. Please sign in again to view your bookings.');
      } else {
        setError(reason instanceof Error ? reason.message : 'We could not load your bookings. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout, page]);

  useEffect(() => {
    if (!accountLoading && account) void loadBookings();
  }, [accountLoading, account, loadBookings]);

  useEffect(() => {
    if (!account || accountLoading) return;
    const interval = window.setInterval(() => void loadBookings(true), 30_000);
    return () => window.clearInterval(interval);
  }, [account, accountLoading, loadBookings]);

  if (accountLoading) return <main className="account-page"><p role="status">Loading your account…</p></main>;
  if (!account) return <Navigate to="/login" replace />;

  async function signOut() {
    try { await logout(); navigate('/'); }
    catch { setError('We could not sign you out. Please try again.'); }
  }

  return (
    <main className="account-page">
      <section className="account-dashboard" aria-labelledby="my-bookings-title">
        <header className="account-dashboard__header">
          <div><p className="eyebrow">YOUR HEATHROW DRIVE ACCOUNT</p><h1 id="my-bookings-title">My bookings</h1>
            <p>View your journeys and keep track of the latest booking updates.</p></div>
          <div className="account-dashboard__actions"><Link className="account-dashboard__link" to="/account">Account details</Link>
            <button className="account-dashboard__link" type="button" onClick={() => void signOut()}>Sign out</button></div>
        </header>
        {error && <p className="admin-alert" role="alert">{error} {error.includes('expired') && <Link to="/login">Sign in</Link>}</p>}
        <div className="account-dashboard__section-heading"><div><h2>Your journeys</h2><p>{total} booking{total === 1 ? '' : 's'} on this account</p></div>
          <button className="account-dashboard__link" type="button" onClick={() => void loadBookings(true)} disabled={refreshing || loading}>{refreshing ? 'Updating…' : 'Refresh status'}</button></div>
        {loading ? <div className="account-dashboard__empty" role="status">Loading your bookings…</div> : bookings.length === 0 ? (
          <div className="account-dashboard__empty"><span className="account-dashboard__empty-icon" aria-hidden="true">↗</span><h3>No bookings yet</h3>
            <p>Your confirmed and upcoming journeys will appear here after you book.</p><Link className="button button--primary" to="/">Plan a journey <span aria-hidden="true">→</span></Link></div>
        ) : <div className="my-bookings-list">{bookings.map((booking) => <MyBookingCard key={booking.id} booking={booking} />)}</div>}
        {!loading && total > pageSize && <nav className="account-dashboard__pagination" aria-label="Booking pages">
          <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
          <div><button type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>Previous</button>
            <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page * pageSize >= total}>Next</button></div>
        </nav>}
        <p className="account-dashboard__privacy">Only bookings made while signed in to this account are shown here. <Link to="/booking-details">Look up a guest booking</Link>.</p>
      </section>
    </main>
  );
}
