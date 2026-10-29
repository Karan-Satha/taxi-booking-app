import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { adminApi, type AdminBooking } from '../services/admin';

const filters = [
  ['all', 'All bookings'],
  ['pending', 'Pending'],
  ['accepted', 'Accepted'],
  ['rejected', 'Rejected'],
  ['confirmed', 'Confirmed'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
] as const;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function pickupDate(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(date);
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { adminAccount, adminLoading } = useAuth();
  if (adminLoading) return <main className="admin-page"><p role="status">Checking administrator access…</p></main>;
  if (!adminAccount) return <Navigate to="/admin/login" replace />;
  return children;
}

export function AdminBookingsPage() {
  const { adminLogout } = useAuth();
  const [filter, setFilter] = useState('all');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 100;
  const [selected, setSelected] = useState<AdminBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accessError, setAccessError] = useState(false);

  const refresh = useCallback(async (nextFilter = filter, nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.bookings(nextFilter === 'all' ? undefined : nextFilter, nextPage);
      setBookings(result.bookings);
      setTotal(result.total);
      setAccessError(false);
    } catch (reason) {
      const status = (reason as Error & { status?: number }).status;
      setAccessError(status === 401 || status === 403);
      setError(reason instanceof Error ? reason.message : 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function showDetails(booking: AdminBooking) {
    setSelected(booking);
    setError('');
    try {
      const result = await adminApi.booking(booking.id);
      setSelected({ ...booking, ...result.booking });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load booking details.');
    }
  }

  async function accept(booking: AdminBooking) {
    setBusyId(booking.id);
    setNotice('');
    setError('');
    try {
      const result = await adminApi.accept(booking.id);
      setNotice(result.emailStatus === 'sent'
        ? `Booking ${booking.bookingReference} accepted and confirmation email sent.`
        : result.emailStatus === 'demo'
          ? `Booking ${booking.bookingReference} accepted. A confirmation notification was recorded in demo mode; no email was sent.`
          : `Booking ${booking.bookingReference} accepted. The confirmation email could not be sent; retry is available.`);
      await refresh();
      setSelected((current) => current?.id === booking.id ? { ...current, status: 'accepted', acceptanceEmailStatus: result.emailStatus as AdminBooking['acceptanceEmailStatus'] } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to accept this booking.');
    } finally {
      setBusyId('');
    }
  }

  async function retryEmail(booking: AdminBooking) {
    setBusyId(booking.id);
    setNotice('');
    setError('');
    try {
      const result = await adminApi.retryAcceptanceEmail(booking.id);
      setNotice(result.emailStatus === 'sent' ? 'Confirmation email sent successfully.' : 'The email is still being processed.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to retry the confirmation email.');
    } finally {
      setBusyId('');
    }
  }

  async function reject(booking: AdminBooking) {
    setBusyId(booking.id);
    setNotice('');
    setError('');
    try {
      await adminApi.reject(booking.id);
      setNotice(`Booking ${booking.bookingReference} rejected.`);
      await refresh();
      setSelected((current) => current?.id === booking.id ? { ...current, status: 'rejected' } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reject this booking.');
    } finally {
      setBusyId('');
    }
  }

  if (accessError) return <Navigate to="/admin/login" replace />;

  return (
    <AdminGuard>
      <main className="admin-page">
        <section className="admin-dashboard" aria-labelledby="admin-title">
          <header className="admin-dashboard__header">
            <div><p className="eyebrow">HEATHROW DRIVE · ADMIN</p><h1 id="admin-title">Booking management</h1>
              <p>Review customer requests and keep booking status up to date.</p></div>
            <div className="admin-dashboard__actions"><button className="admin-dashboard__refresh" type="button" onClick={() => void adminLogout()}>Sign out</button>
              <Link className="admin-dashboard__home" to="/">Back to website <span aria-hidden="true">↗</span></Link></div>
          </header>

          <div className="admin-dashboard__toolbar">
            <div className="admin-dashboard__filters" role="group" aria-label="Filter bookings by status">
              {filters.map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? 'admin-filter admin-filter--active' : 'admin-filter'}
                  aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>
                  {label}
                </button>
              ))}
            </div>
            <button className="admin-dashboard__refresh" type="button" onClick={() => void refresh()} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {notice && <p className="admin-alert admin-alert--success" role="status">{notice}</p>}
          {error && <p className="admin-alert" role="alert">{error}</p>}

          <div className="admin-dashboard__layout">
            <section className="admin-bookings" aria-label="Customer bookings">
              {loading ? <div className="admin-empty" role="status">Loading bookings…</div> : bookings.length === 0 ? (
                <div className="admin-empty"><h2>No bookings found</h2><p>New customer bookings will appear here.</p></div>
              ) : bookings.map((booking) => (
                <article className={`admin-booking${selected?.id === booking.id ? ' admin-booking--selected' : ''}`} key={booking.id}>
                  <div className="admin-booking__main">
                    <div className="admin-booking__reference"><strong>{booking.bookingReference}</strong>
                      <span className={`admin-status admin-status--${booking.status.replaceAll('_', '-')}`}>{statusLabel(booking.status)}</span></div>
                    <h2>{booking.customer.name}</h2>
                    <a href={`mailto:${booking.customer.email}`}>{booking.customer.email}</a>
                    <p>{booking.vehicleName ?? 'Vehicle'} · {pickupDate(booking.pickupAt, booking.pickupTimezone)}</p>
                    <div className="admin-booking__route"><span>{booking.pickup.address}</span><span aria-hidden="true">→</span><span>{booking.dropoff.address}</span></div>
                  </div>
                  <div className="admin-booking__actions">
                    <strong className="admin-booking__fare">{money(booking.fare.amount, booking.fare.currency)}</strong>
                    <button type="button" className="admin-button admin-button--secondary" onClick={() => void showDetails(booking)}>View details</button>
                    {booking.status === 'pending' && <button type="button" className="button button--primary" disabled={busyId === booking.id} onClick={() => void accept(booking)}>
                      {busyId === booking.id ? 'Accepting…' : 'Accept booking'}
                    </button>}
                    {booking.status === 'pending' && <button type="button" className="admin-button admin-button--secondary" disabled={busyId === booking.id} onClick={() => void reject(booking)}>
                      {busyId === booking.id ? 'Updating…' : 'Reject booking'}
                    </button>}
                    {booking.status === 'accepted' && (booking.acceptanceEmailStatus === 'failed' || booking.acceptanceEmailStatus === 'queued') && <button type="button" className="admin-button admin-button--secondary" disabled={busyId === booking.id} onClick={() => void retryEmail(booking)}>
                      {busyId === booking.id ? 'Retrying…' : 'Retry confirmation email'}
                    </button>}
                    {booking.status === 'accepted' && booking.acceptanceEmailStatus === 'sent' && <span className="admin-email-sent">Confirmation email sent</span>}
                    {booking.status === 'accepted' && booking.acceptanceEmailStatus === 'demo' && <span className="admin-email-sent">Notification recorded (demo mode)</span>}
                  </div>
                </article>
              ))}
              {!loading && total > pageSize && <nav className="admin-pagination" aria-label="Booking pages">
                <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} bookings</span>
                <div><button type="button" className="admin-button admin-button--secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                  <button type="button" className="admin-button admin-button--secondary" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Next</button></div>
              </nav>}
            </section>

            {selected && <aside className="admin-detail" aria-labelledby="admin-detail-title">
              <div className="admin-detail__header"><div><p className="eyebrow">BOOKING DETAILS</p><h2 id="admin-detail-title">{selected.bookingReference}</h2></div>
                <button type="button" className="admin-detail__close" onClick={() => setSelected(null)} aria-label="Close booking details">×</button></div>
              <div className="admin-detail__section"><span>Status</span><strong>{statusLabel(selected.status)}</strong></div>
              {selected.vehicle && <div className="admin-detail__section admin-detail__vehicle"><span>Selected vehicle</span><div>{selected.vehicle.imageUrl && <img src={selected.vehicle.imageUrl} alt="" />}<strong>{selected.vehicle.name ?? 'Vehicle'} · {selected.vehicle.category ?? 'Category unavailable'}</strong></div><small>Capacity: up to {selected.vehicle.passengerCapacity ?? '—'} passengers · {selected.vehicle.luggageCapacity ?? '—'} bags</small></div>}
              <div className="admin-detail__section"><span>Customer</span><strong>{selected.customer.name}</strong><a href={`mailto:${selected.customer.email}`}>{selected.customer.email}</a><a href={`tel:${selected.customer.phone}`}>{selected.customer.phone}</a></div>
              <div className="admin-detail__section"><span>Pickup</span><strong>{selected.pickup.address}</strong></div>
              <div className="admin-detail__section"><span>Destination</span><strong>{selected.dropoff.address}</strong></div>
              <div className="admin-detail__grid"><div><span>Pickup time</span><strong>{pickupDate(selected.pickupAt, selected.pickupTimezone)}</strong></div>
                <div><span>Distance</span><strong>{selected.distanceMiles === null ? '—' : `${selected.distanceMiles.toFixed(1)} miles`}</strong></div>
                <div><span>Passengers</span><strong>{selected.passengers}</strong></div><div><span>Luggage</span><strong>{selected.luggage}</strong></div></div>
              <div className="admin-detail__fare"><span>Estimated fare</span><strong>{money(selected.fare.amount, selected.fare.currency)}</strong></div>
              <div className="admin-detail__section"><span>Payment status</span><strong>{statusLabel(selected.paymentStatus)}</strong></div>
              {selected.instructions && <div className="admin-detail__section"><span>Customer instructions</span><p>{selected.instructions}</p></div>}
            </aside>}
          </div>
        </section>
      </main>
    </AdminGuard>
  );
}
