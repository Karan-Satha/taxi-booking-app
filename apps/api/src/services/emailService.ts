import { env } from '../config/env.js';
import type { JourneyQuote } from '../types/booking.js';

interface FareLine {
  label: string;
  amount: number;
}

interface BookingConfirmationEmail {
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quote: JourneyQuote;
  vehicleName: string;
  vehicleCategory: string;
  vehicleImageUrl: string;
  passengerCapacity: number;
  luggageCapacity: number;
  passengers: number;
  luggage: number;
  fare: number;
  fareLines: FareLine[];
  bookingStatus: string;
  paymentStatus: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function formatStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function webAssetUrl(path: string) {
  if (!path) return '';
  try {
    const url = new URL(path, env.WEB_ORIGIN);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.toString()) : '';
  } catch {
    return '';
  }
}

function fareRows(lines: FareLine[], currency: string) {
  return lines
    .filter((line) => Math.abs(line.amount) >= 0.005)
    .map(
      ({ label, amount }) => `<tr>
        <td style="padding:7px 0;color:#475569;font-size:14px">${escapeHtml(label)}</td>
        <td align="right" style="padding:7px 0;color:#1e1b4b;font-size:14px;white-space:nowrap">
          ${escapeHtml(formatMoney(amount, currency))}
        </td>
      </tr>`,
    )
    .join('');
}

function supportFooter() {
  const details = [
    env.SUPPORT_EMAIL
      ? `<a href="mailto:${escapeHtml(env.SUPPORT_EMAIL)}" style="color:#3b82f6;text-decoration:underline">
          Email support
        </a>`
      : '',
    env.SUPPORT_PHONE
      ? `<span style="color:#64748b">${escapeHtml(env.SUPPORT_PHONE)}</span>`
      : '',
  ].filter(Boolean);
  const policies = [
    env.TERMS_URL
      ? `<a href="${escapeHtml(env.TERMS_URL)}" style="color:#475569;text-decoration:underline">Terms</a>`
      : '',
    env.CANCELLATION_POLICY_URL
      ? `<a href="${escapeHtml(env.CANCELLATION_POLICY_URL)}" style="color:#475569;text-decoration:underline">
          Cancellation policy
        </a>`
      : '',
  ].filter(Boolean);

  return `${details.length ? `<p style="margin:0 0 8px">${details.join(' &nbsp;·&nbsp; ')}</p>` : ''}
    ${policies.length ? `<p style="margin:0 0 8px">${policies.join(' &nbsp;·&nbsp; ')}</p>` : ''}
    <p style="margin:0">Heathrow Drive · A more comfortable way to travel.</p>`;
}

export async function sendBookingConfirmationEmail(booking: BookingConfirmationEmail) {
  if (env.DEMO_MODE === 'true' || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info('Demo notification recorded', { type: 'booking_confirmation' });
    return false;
  }

  const name = escapeHtml(booking.customerName);
  const reference = escapeHtml(booking.bookingReference);
  const pickup = escapeHtml(booking.quote.pickup);
  const dropoff = escapeHtml(booking.quote.dropoff);
  const vehicleName = escapeHtml(booking.vehicleName);
  const vehicleCategory = escapeHtml(booking.vehicleCategory);
  const date = escapeHtml(formatDate(booking.quote.date));
  const time = escapeHtml(booking.quote.time);
  const phone = escapeHtml(booking.customerPhone);
  const email = escapeHtml(booking.customerEmail);
  const fare = formatMoney(booking.fare, booking.quote.currency);
  const distance = `${booking.quote.distanceMiles.toFixed(1)} miles`;
  const duration = escapeHtml(booking.quote.durationText);
  const status = escapeHtml(formatStatus(booking.bookingStatus));
  const paymentStatus = escapeHtml(formatStatus(booking.paymentStatus));
  const imageUrl = webAssetUrl(booking.vehicleImageUrl);
  const bookingLookupUrl = escapeHtml(new URL('/booking-details', env.WEB_ORIGIN).toString());
  const imageMarkup = imageUrl
    ? `<img src="${imageUrl}" width="180" alt="${vehicleName} vehicle" 
        style="display:block;width:180px;max-width:100%;height:auto;border:0;margin:0 auto 12px">`
    : '';
  const itemizedFare = fareRows(booking.fareLines, booking.quote.currency);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [booking.customerEmail],
      subject: `Booking request received — ${booking.bookingReference}`,
      text: [
        `Heathrow Drive — Booking request received`,
        `Hello ${booking.customerName}, we have received your journey request.`,
        `Booking reference (select and copy): ${booking.bookingReference}`,
        `Booking status: ${formatStatus(booking.bookingStatus)}`,
        `Pickup: ${booking.quote.pickup}`,
        `Destination: ${booking.quote.dropoff}`,
        `Pickup date and time: ${formatDate(booking.quote.date)} at ${booking.quote.time} (Europe/London)`,
        `Journey: ${distance}, ${booking.quote.durationText}`,
        `Vehicle: ${booking.vehicleName} (${booking.vehicleCategory})`,
        `Passengers: ${booking.passengers} of ${booking.passengerCapacity}`,
        `Luggage: ${booking.luggage} of ${booking.luggageCapacity} items`,
        `Estimated fare: ${fare} ${booking.quote.currency}`,
        `Payment status: ${formatStatus(booking.paymentStatus)}`,
        `Passenger: ${booking.customerName}, ${booking.customerEmail}, ${booking.customerPhone}`,
        `View booking details: ${bookingLookupUrl}`,
      ].join('\n'),
      html: `<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="color-scheme" content="light">
            <title>Booking request received</title>
            <style>
              @media only screen and (max-width: 620px) {
                .email-shell { padding: 16px 8px !important; }
                .email-card { padding: 24px 18px !important; }
                .email-column { display: block !important; width: 100% !important; }
              }
            </style>
          </head>
          <body style="margin:0;padding:0;background-color:#f8fafc;color:#1e1b4b;
            font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="width:100%;background-color:#f8fafc">
              <tr>
                <td class="email-shell" align="center" style="padding:32px 16px">
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                    style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0">
                    <tr>
                      <td height="6" bgcolor="#6d28d9" style="height:6px;line-height:6px;font-size:0;
                        background-color:#6d28d9;background-image:linear-gradient(90deg,#3b82f6,#6d28d9)">
                        &nbsp;
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 28px;background-color:#ffffff;border-bottom:1px solid #e2e8f0">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td width="52" valign="middle">
                              <div style="width:42px;height:42px;line-height:42px;text-align:center;
                                border-radius:10px 10px 10px 3px;background-color:#3b82f6;
                                background-image:linear-gradient(135deg,#3b82f6 0%,#6d28d9 100%);
                                color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:21px;
                                font-weight:bold">H</div>
                            </td>
                            <td valign="middle" style="color:#312e81;font-family:Arial,Helvetica,sans-serif;
                              font-size:21px;font-weight:bold;letter-spacing:-1px">
                              heathrow drive<span style="color:#6d28d9">.</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td class="email-card" style="padding:32px 36px;background-color:#ffffff">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding:0 0 24px">
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="background-color:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px">
                                <tr>
                                  <td width="58" valign="top" style="padding:18px 0 18px 18px">
                                    <div style="width:38px;height:38px;line-height:38px;text-align:center;
                                      border-radius:19px;background-color:#6d28d9;color:#ffffff;font-size:22px;
                                      font-weight:bold">&#10003;</div>
                                  </td>
                                  <td style="padding:18px 18px 18px 10px">
                                    <p style="margin:0 0 5px;color:#312e81;font-size:19px;line-height:26px;
                                      font-weight:bold">Booking request received</p>
                                    <p style="margin:0;color:#475569;font-size:14px;line-height:21px">
                                      Hello ${name}, we’ve received your journey details. Your booking is
                                      <strong>${status.toLowerCase()}</strong> while it awaits confirmation.
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:0 0 22px">
                              <p style="margin:0 0 7px;color:#64748b;font-size:12px;font-weight:bold;
                                letter-spacing:1px;text-transform:uppercase">Booking reference</p>
                              <code aria-label="Copyable booking reference" style="display:block;padding:12px 15px;
                                border:1px dashed #a78bfa;border-radius:8px;background-color:#faf8ff;
                                color:#312e81;font-family:Arial,Helvetica,sans-serif;font-size:20px;
                                font-weight:bold;letter-spacing:1px;user-select:all">${reference}</code>
                              <p style="margin:7px 0 0;color:#64748b;font-size:12px;line-height:18px">
                                Select and copy this reference when looking up your booking.
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding:0 0 26px">
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                  <td align="center" bgcolor="#3b82f6" style="border-radius:8px;
                                    background-color:#3b82f6;background-image:linear-gradient(100deg,#3b82f6,#6d28d9)">
                                    <a href="${bookingLookupUrl}" target="_blank"
                                      style="display:inline-block;padding:14px 24px;border:1px solid #3b82f6;
                                        border-radius:8px;color:#ffffff;font-size:15px;font-weight:bold;
                                        line-height:20px;text-decoration:none">
                                      View Booking Details
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin:9px 0 0;color:#64748b;font-size:12px;line-height:18px">
                                Enter your booking reference and booking email to view the details.
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:0 0 22px">
                              <h2 style="margin:0 0 3px;color:#312e81;font-size:17px;line-height:24px">
                                Your journey</h2>
                              <p style="margin:0 0 14px;color:#64748b;font-size:13px;line-height:19px">
                                Your requested pickup and route estimate.</p>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="border:1px solid #e2e8f0;border-radius:9px">
                                <tr><td style="padding:14px 16px;border-bottom:1px solid #e2e8f0">
                                  <p style="margin:0 0 4px;color:#64748b;font-size:12px">PICKUP</p>
                                  <p style="margin:0;color:#1e1b4b;font-size:15px;line-height:22px;
                                    font-weight:bold">${pickup}</p>
                                </td></tr>
                                <tr><td style="padding:14px 16px">
                                  <p style="margin:0 0 4px;color:#64748b;font-size:12px">DESTINATION</p>
                                  <p style="margin:0;color:#1e1b4b;font-size:15px;line-height:22px;
                                    font-weight:bold">${dropoff}</p>
                                </td></tr>
                              </table>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="margin-top:10px">
                                <tr>
                                  <td class="email-column" width="50%" valign="top" style="padding:8px 8px 8px 0">
                                    <p style="margin:0 0 4px;color:#64748b;font-size:12px">PICKUP DATE &amp; TIME</p>
                                    <p style="margin:0;color:#1e1b4b;font-size:14px;font-weight:bold">
                                      ${date} · ${time}</p>
                                    <p style="margin:3px 0 0;color:#64748b;font-size:12px">Europe/London</p>
                                  </td>
                                  <td class="email-column" width="50%" valign="top" style="padding:8px 0 8px 8px">
                                    <p style="margin:0 0 4px;color:#64748b;font-size:12px">ROUTE ESTIMATE</p>
                                    <p style="margin:0;color:#1e1b4b;font-size:14px;font-weight:bold">
                                      ${escapeHtml(distance)}</p>
                                    <p style="margin:3px 0 0;color:#64748b;font-size:12px">About ${duration}</p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td style="padding:0 0 22px">
                            <div style="height:1px;background-color:#e2e8f0;line-height:1px;font-size:0">&nbsp;</div>
                          </td></tr>
                          <tr>
                            <td style="padding:0 0 22px">
                              <h2 style="margin:0 0 3px;color:#312e81;font-size:17px;line-height:24px">
                                Your vehicle</h2>
                              <p style="margin:0 0 14px;color:#64748b;font-size:13px;line-height:19px">
                                Selected for your group.</p>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:9px">
                                <tr><td align="center" style="padding:16px 16px 4px">${imageMarkup}</td></tr>
                                <tr><td align="center" style="padding:0 16px 16px">
                                  <p style="margin:0 0 3px;color:#312e81;font-size:16px;font-weight:bold">
                                    ${vehicleName}</p>
                                  <p style="margin:0 0 12px;color:#64748b;font-size:13px">${vehicleCategory}</p>
                                  <p style="margin:0;color:#475569;font-size:13px;line-height:20px">
                                    ${booking.passengers} passenger${booking.passengers === 1 ? '' : 's'}
                                    &nbsp;·&nbsp; ${booking.luggage} luggage item${booking.luggage === 1 ? '' : 's'}
                                  </p>
                                  <p style="margin:3px 0 0;color:#64748b;font-size:12px;line-height:18px">
                                    Capacity: up to ${booking.passengerCapacity} passengers and
                                    ${booking.luggageCapacity} luggage items</p>
                                </td></tr>
                              </table>
                            </td>
                          </tr>
                          <tr><td style="padding:0 0 22px">
                            <div style="height:1px;background-color:#e2e8f0;line-height:1px;font-size:0">&nbsp;</div>
                          </td></tr>
                          <tr>
                            <td style="padding:0 0 22px">
                              <h2 style="margin:0 0 12px;color:#312e81;font-size:17px;line-height:24px">
                                Fare summary</h2>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                ${itemizedFare}
                                <tr>
                                  <td style="padding:12px 0 2px;border-top:1px solid #cbd5e1;
                                    color:#312e81;font-size:15px;font-weight:bold">Estimated total</td>
                                  <td align="right" style="padding:12px 0 2px;border-top:1px solid #cbd5e1;
                                    color:#312e81;font-size:20px;font-weight:bold;white-space:nowrap">${escapeHtml(fare)}</td>
                                </tr>
                              </table>
                              <p style="margin:10px 0 0;color:#64748b;font-size:12px;line-height:18px">
                                Currency: ${escapeHtml(booking.quote.currency)} · Payment status:
                                <strong>${paymentStatus}</strong>
                              </p>
                            </td>
                          </tr>
                          <tr><td style="padding:0 0 22px">
                            <div style="height:1px;background-color:#e2e8f0;line-height:1px;font-size:0">&nbsp;</div>
                          </td></tr>
                          <tr>
                            <td style="padding:0 0 4px">
                              <h2 style="margin:0 0 12px;color:#312e81;font-size:17px;line-height:24px">
                                Passenger details</h2>
                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                                style="background-color:#f8fafc;border-radius:8px">
                                <tr><td style="padding:13px 15px">
                                  <p style="margin:0 0 5px;color:#1e1b4b;font-size:14px;font-weight:bold">${name}</p>
                                  <p style="margin:0 0 4px;font-size:13px">
                                    <a href="mailto:${email}" style="color:#3b82f6;text-decoration:underline">${email}</a>
                                  </p>
                                  <p style="margin:0;color:#475569;font-size:13px">${phone}</p>
                                </td></tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:20px 24px;background-color:#f1f5f9;color:#64748b;
                        font-size:12px;line-height:19px">
                        ${supportFooter()}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned HTTP ${response.status}.`);
  }
  return true;
}

export async function sendAbandonedBookingEmail(input: {
  email: string;
  name: string;
  pickup: string;
  dropoff: string;
  resumeUrl: string;
}) {
  if (env.DEMO_MODE === 'true' || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info('Demo notification recorded', { type: 'abandoned_booking_reminder' });
    return false;
  }
  const name = escapeHtml(input.name || 'there');
  const pickup = escapeHtml(input.pickup || 'Your selected pickup');
  const dropoff = escapeHtml(input.dropoff || 'Your selected destination');
  const resumeUrl = escapeHtml(input.resumeUrl);
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.email],
      subject: 'Continue planning your Heathrow Drive journey',
      text: [
        `Hello ${input.name || 'there'},`,
        'You asked us to send one reminder if you left your booking before completing it.',
        `Pickup: ${input.pickup || 'Not selected'}`,
        `Destination: ${input.dropoff || 'Not selected'}`,
        'Your saved booking progress is available for 30 minutes after your last activity.',
        `Resume your booking: ${input.resumeUrl}`,
        'If you have already completed your booking, you can ignore this email.',
        'Heathrow Drive',
      ].join('\n'),
      html: `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f8fafc;
        color:#1e1b4b;font-family:Arial,Helvetica,sans-serif">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0"
            border="0" style="width:100%;max-width:600px;background:#fff;border-radius:14px;overflow:hidden">
            <tr><td style="height:6px;background:#3b82f6;background-image:linear-gradient(90deg,#3b82f6,#6d28d9)"></td></tr>
            <tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" valign="middle"><div style="width:42px;height:42px;line-height:42px;
                    text-align:center;border-radius:10px 10px 10px 3px;background-color:#3b82f6;
                    background-image:linear-gradient(135deg,#3b82f6 0%,#6d28d9 100%);color:#ffffff;
                    font-size:21px;font-weight:bold">H</div></td>
                  <td valign="middle" style="color:#312e81;font-size:21px;font-weight:bold;letter-spacing:-1px">
                    heathrow drive<span style="color:#6d28d9">.</span>
                  </td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:32px">
              <p style="margin:0 0 10px;color:#6d28d9;font-size:12px;font-weight:bold;letter-spacing:1.5px">YOUR JOURNEY</p>
              <h1 style="margin:0 0 12px;color:#1e1b4b;font-size:26px;line-height:1.25">Pick up where you left off</h1>
              <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.6">Hello ${name}, your journey details are saved. Continue within 30 minutes of your last activity.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="margin-bottom:24px;background:#f1f5ff;border:1px solid #dbe4f0;border-radius:10px">
                <tr><td style="padding:14px 16px;color:#64748b;font-size:13px">Pickup</td>
                  <td style="padding:14px 16px;color:#1e1b4b;font-size:14px;font-weight:bold">${pickup}</td></tr>
                <tr><td style="padding:0 16px 14px;color:#64748b;font-size:13px">Destination</td>
                  <td style="padding:0 16px 14px;color:#1e1b4b;font-size:14px;font-weight:bold">${dropoff}</td></tr>
              </table>
              <a href="${resumeUrl}" style="display:inline-block;padding:14px 22px;border-radius:9px;
                background:#3b82f6;background-image:linear-gradient(100deg,#6d28d9,#2563eb);
                color:#fff;font-size:15px;font-weight:bold;text-decoration:none">Resume your booking</a>
              <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.6">If you have already completed your booking, you can ignore this email. The resume link expires 30 minutes after your last activity.</p>
            </td></tr>
            <tr><td style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px">Heathrow Drive · A more comfortable way to travel.</td></tr>
          </table></td></tr>
        </table></body></html>`,
    }),
  });
  if (!result.ok) throw new Error(`Email provider returned ${result.status}`);
  return true;
}

export async function sendBookingAcceptedEmail(input: {
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  pickup: string;
  dropoff: string;
  pickupAt: Date;
  timezone: string;
  distanceMiles: number | null;
  durationSeconds: number | null;
  vehicleName: string;
  vehicleCategory: string;
  fare: number;
  currency: string;
}) {
  if (env.DEMO_MODE === 'true' || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info('Demo notification recorded', { type: 'booking_accepted' });
    return false;
  }
  const safe = (value: string) => escapeHtml(value);
  const pickupDate = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long', timeZone: input.timezone,
  }).format(input.pickupAt);
  const pickupTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: input.timezone,
  }).format(input.pickupAt);
  const distance = input.distanceMiles === null ? 'Not available' : `${input.distanceMiles.toFixed(1)} miles`;
  const duration = input.durationSeconds === null
    ? 'Not available'
    : `${Math.floor(input.durationSeconds / 3600)} hr ${Math.round((input.durationSeconds % 3600) / 60)} min`;
  const fare = formatMoney(input.fare, input.currency);
  const lookupUrl = escapeHtml(new URL('/booking-details', env.WEB_ORIGIN).toString());
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `booking-accepted-${input.bookingReference}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.customerEmail],
      subject: `Your booking is accepted — ${input.bookingReference}`,
      text: [
        `Hello ${input.customerName},`,
        'Your Heathrow Drive booking has been accepted.',
        `Booking reference: ${input.bookingReference}`,
        `Vehicle: ${input.vehicleName} (${input.vehicleCategory})`,
        `Pickup: ${input.pickup}`,
        `Destination: ${input.dropoff}`,
        `Pickup: ${pickupDate} at ${pickupTime} (${input.timezone})`,
        `Distance: ${distance}; estimated duration: ${duration}`,
        `Estimated fare: ${fare} ${input.currency}`,
        `View booking details: ${new URL('/booking-details', env.WEB_ORIGIN).toString()}`,
      ].join('\n'),
      html: `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f8fafc;color:#1e1b4b;font-family:Arial,Helvetica,sans-serif">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fff;border-radius:14px;overflow:hidden">
        <tr><td height="6" style="background:#6d28d9;background-image:linear-gradient(90deg,#3b82f6,#6d28d9)"></td></tr>
        <tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="52"><div style="width:42px;height:42px;line-height:42px;text-align:center;border-radius:10px 10px 10px 3px;background:#6d28d9;color:#fff;font-size:21px;font-weight:bold">H</div></td>
        <td style="color:#312e81;font-size:21px;font-weight:bold">heathrow drive<span style="color:#6d28d9">.</span></td>
        </tr></table></td></tr>
        <tr><td style="padding:32px"><p style="margin:0 0 8px;color:#6d28d9;font-size:12px;font-weight:bold;letter-spacing:1.2px">BOOKING ACCEPTED</p>
        <h1 style="margin:0 0 10px;color:#1e1b4b;font-size:26px">Your ride is confirmed</h1>
        <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.6">Hello ${safe(input.customerName)}, our team has accepted your booking request.</p>
        <div style="margin-bottom:20px;padding:15px 18px;border:1px solid #ddd6fe;border-radius:10px;background:#f5f3ff"><span style="display:block;color:#64748b;font-size:12px">Booking reference</span><strong style="color:#312e81;font-size:20px;letter-spacing:1px">${safe(input.bookingReference)}</strong></div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;background:#f8fafc;border-radius:9px">
        <tr><td style="padding:12px 15px;color:#64748b;font-size:13px">Pickup</td><td style="padding:12px 15px;color:#1e1b4b;font-size:14px;font-weight:bold">${safe(input.pickup)}</td></tr>
        <tr><td style="padding:0 15px 12px;color:#64748b;font-size:13px">Destination</td><td style="padding:0 15px 12px;color:#1e1b4b;font-size:14px;font-weight:bold">${safe(input.dropoff)}</td></tr>
        <tr><td style="padding:0 15px 12px;color:#64748b;font-size:13px">Pickup time</td><td style="padding:0 15px 12px;color:#1e1b4b;font-size:14px;font-weight:bold">${safe(pickupDate)} · ${safe(pickupTime)} (${safe(input.timezone)})</td></tr>
        <tr><td style="padding:0 15px 12px;color:#64748b;font-size:13px">Vehicle</td><td style="padding:0 15px 12px;color:#1e1b4b;font-size:14px;font-weight:bold">${safe(input.vehicleName)} · ${safe(input.vehicleCategory)}</td></tr>
        <tr><td style="padding:0 15px 12px;color:#64748b;font-size:13px">Distance · duration</td><td style="padding:0 15px 12px;color:#1e1b4b;font-size:14px;font-weight:bold">${safe(distance)} · ${safe(duration)}</td></tr>
        <tr><td style="padding:0 15px 14px;color:#64748b;font-size:13px">Estimated fare</td><td style="padding:0 15px 14px;color:#312e81;font-size:18px;font-weight:bold">${safe(fare)} ${safe(input.currency)}</td></tr>
        </table><a href="${lookupUrl}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#3b82f6;background-image:linear-gradient(100deg,#6d28d9,#2563eb);color:#fff;font-size:15px;font-weight:bold;text-decoration:none">View Booking Details</a>
        <p style="margin:22px 0 0;color:#64748b;font-size:12px">Heathrow Drive · A more comfortable way to travel.</p></td></tr></table></td></tr></table></body></html>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}.`);
  return true;
}
