import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import { LocationInput } from "../components/LocationInput";
import { LuggageIcon, PassengerIcon, VehicleArtwork } from "../components/VehicleArtwork";
import { bookingApi, BookingRequestError, type BookingConfirmation, type QuoteResponse } from "../services/bookings";
import { reverseGeocode } from "../services/maps";
import type { VehicleOption } from "../types/booking";
import { AccountPage, ForgotPasswordPage, LoginPage, MyBookingsPage, RegisterPage, ResetPasswordPage } from "./AuthPages";
import { BookingLookupPage } from "./BookingLookupPage";
import { AdminBookingsPage } from "./AdminBookingsPage";

const BOOKING_STORAGE_KEY = "heathrow-drive.booking-progress.v1";
type BookingStage = 1 | 2 | 3 | 4;
type BookingFieldIconName =
  | "passengers"
  | "bags"
  | "name"
  | "email"
  | "phone"
  | "note"
  | "date"
  | "route"
  | "time"
  | "duration";

const callingCodes: Record<string, string> = {
  AU: "+61",
  BD: "+880",
  CA: "+1",
  CH: "+41",
  CN: "+86",
  DK: "+45",
  DE: "+49",
  EG: "+20",
  ES: "+34",
  FR: "+33",
  GB: "+44",
  GH: "+233",
  IE: "+353",
  IN: "+91",
  ID: "+62",
  IL: "+972",
  KE: "+254",
  IT: "+39",
  JP: "+81",
  KR: "+82",
  MX: "+52",
  NG: "+234",
  NP: "+977",
  NZ: "+64",
  NL: "+31",
  NO: "+47",
  PH: "+63",
  PK: "+92",
  PL: "+48",
  PT: "+351",
  SA: "+966",
  SG: "+65",
  SE: "+46",
  TH: "+66",
  TR: "+90",
  US: "+1",
  AE: "+971",
  ZA: "+27",
};

function getDefaultCountryCode() {
  if (typeof navigator === "undefined") return "+44";
  const localeRegion = navigator.language.match(/[-_]([A-Z]{2})(?:$|[-_])/i)?.[1]?.toUpperCase();
  if (localeRegion && callingCodes[localeRegion]) return callingCodes[localeRegion];

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone.startsWith("Europe/London")) return "+44";
  if (timeZone.startsWith("America/Toronto") || timeZone.startsWith("America/Vancouver")) return "+1";
  if (timeZone.startsWith("Australia/")) return "+61";
  if (timeZone.startsWith("Asia/Kolkata")) return "+91";
  return "+44";
}

function BookingFieldIcon({ name }: { name: BookingFieldIconName }) {
  const icons: Record<BookingFieldIconName, ReactNode> = {
    passengers: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1.5a6 6 0 0 1 12 0V20M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.5V20" /></>,
    bags: <><rect x="5" y="7" width="14" height="14" rx="2" /><path d="M9 7V5a3 3 0 0 1 6 0v2M9 11v6m6-6v6" /></>,
    name: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    phone: <><path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-5-2-2 2a14 14 0 0 1-5-5l2-2-2-5Z" /></>,
    note: <><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M7 9h10m-10 4h7" /></>,
    date: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8 18c7 0 1-12 8-12" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    duration: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5M9 2h6" /></>,
  };

  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

function IconFieldControl({ name, children }: { name: BookingFieldIconName; children: ReactNode }) {
  return (
    <span className={`field__control field__control--icon${name === "note" ? " field__control--note" : ""}`}>
      <BookingFieldIcon name={name} />
      {children}
    </span>
  );
}

interface SavedBookingProgress {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  stage: BookingStage;
  quote: QuoteResponse | null;
  quoteSavedAt: number | null;
  vehicle: VehicleOption | null;
  passengers: number;
  luggage: number;
  passengerName: string;
  email: string;
  countryCode: string;
  phone: string;
  note: string;
  recoveryConsent: boolean;
  lastActivityAt: number;
  confirmation: BookingConfirmation | null;
}

const BOOKING_STAGE_NAMES: Record<BookingStage, string> = {
  1: "journey-details",
  2: "vehicle-option",
  3: "passenger-details",
  4: "review-booking",
};

function parseBookingStage(value: string | null): BookingStage | null {
  const match = value?.match(/^(\d)\/([a-z-]+)$/);
  if (!match) return null;
  const step = Number(match[1]) as BookingStage;
  return BOOKING_STAGE_NAMES[step] === match[2] ? step : null;
}

function serialiseBookingQuery(params: URLSearchParams) {
  return params.toString().replace(/%2F/gi, "/");
}

function londonDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function maxBookingDate() {
  const date = new Date(`${londonDateString()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 365);
  return date.toISOString().slice(0, 10);
}

function isPickupDateTimeValid(date: string, time: string) {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date) return false;
  const today = londonDateString();
  if (date < today || date > maxBookingDate()) return false;
  if (date > today) return true;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const currentTime = `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`;
  return time > currentTime;
}

function countryForCallingCode(callingCode: string) {
  return getCountries().find((country) => `+${getCountryCallingCode(country)}` === callingCode) ?? "GB";
}

function formatJourneyDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(date);
  return ["weekday", "day", "month"].map((type) => parts.find((part) => part.type === type)?.value).join(" ");
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function isVehicleOption(value: unknown): value is VehicleOption {
  if (!value || typeof value !== "object") return false;
  const option = value as Partial<VehicleOption>;
  return (
    typeof option.id === "string" &&
    typeof option.name === "string" &&
    typeof option.description === "string" &&
    typeof option.imageUrl === "string" &&
    Number.isInteger(option.passengers) &&
    Number.isInteger(option.luggage) &&
    typeof option.fare === "number"
  );
}

function isQuoteResponse(value: unknown): value is QuoteResponse {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<QuoteResponse>;
  const quote = result.quote;
  return (
    typeof result.quoteToken === "string" &&
    result.quoteToken.length > 20 &&
    !!quote &&
    typeof quote.pickup === "string" &&
    typeof quote.dropoff === "string" &&
    typeof quote.date === "string" &&
    typeof quote.time === "string" &&
    typeof quote.distanceMiles === "number" &&
    typeof quote.durationText === "string" &&
    Array.isArray(quote.vehicles) &&
    quote.vehicles.every(isVehicleOption)
  );
}

function readSavedBookingProgress(): SavedBookingProgress | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedBookingProgress>;
    const lastActivityAt = typeof saved.lastActivityAt === "number"
      ? saved.lastActivityAt
      : (typeof saved.quoteSavedAt === "number" ? saved.quoteSavedAt : Date.now());
    if (Date.now() - lastActivityAt >= 30 * 60 * 1000 || Date.now() < lastActivityAt) {
      sessionStorage.removeItem(BOOKING_STORAGE_KEY);
      return null;
    }
    const routeIsComplete =
      typeof saved.pickup === "string" &&
      !!saved.pickup.trim() &&
      typeof saved.dropoff === "string" &&
      !!saved.dropoff.trim() &&
      typeof saved.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(saved.date) &&
      typeof saved.time === "string" &&
      /^\d{2}:\d{2}$/.test(saved.time) &&
      isPickupDateTimeValid(saved.date, saved.time);
    const validQuote = routeIsComplete && isQuoteResponse(saved.quote) ? saved.quote : null;
    const quoteIsFresh =
      validQuote && typeof saved.quoteSavedAt === "number" && Date.now() - saved.quoteSavedAt < 30 * 60 * 1000;
    const quote = quoteIsFresh ? validQuote : null;
    const vehicle =
      quote && isVehicleOption(saved.vehicle)
        ? (quote.quote.vehicles.find((option) => option.id === saved.vehicle?.id) ?? null)
        : null;
    const savedPhone = parsePhoneNumberFromString(`${saved.countryCode ?? ""}${saved.phone ?? ""}`);
    const passengerDetailsComplete =
      typeof saved.passengerName === "string" && saved.passengerName.trim().length >= 2 &&
      typeof saved.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(saved.email) &&
      !!savedPhone?.isValid() &&
      Number(saved.passengers) >= 1 && Number(saved.passengers) <= (vehicle?.passengers ?? 0) &&
      Number(saved.luggage) >= 0 && Number(saved.luggage) <= (vehicle?.luggage ?? 0);
    const confirmation =
      saved.confirmation &&
      typeof saved.confirmation === "object" &&
      typeof saved.confirmation.bookingId === "string" &&
      typeof saved.confirmation.bookingReference === "string" &&
      isQuoteResponse({ quote: saved.confirmation.quote, quoteToken: "confirmed-booking-token-valid" }) &&
      isVehicleOption(saved.confirmation.vehicle)
        ? (saved.confirmation as BookingConfirmation)
        : null;
    const stage: BookingStage = confirmation
      ? 1
      : quote && vehicle && saved.stage === 4 && passengerDetailsComplete
        ? 4
        : quote && vehicle && saved.stage === 3
          ? 3
        : quote && (saved.stage === 2 || saved.stage === 3 || saved.stage === 4)
          ? 2
          : 1;

    return {
      pickup: typeof saved.pickup === "string" ? saved.pickup : "",
      dropoff: typeof saved.dropoff === "string" ? saved.dropoff : "",
      date: typeof saved.date === "string" ? saved.date : "",
      time: typeof saved.time === "string" ? saved.time : "",
      stage,
      quote,
      quoteSavedAt: quote ? saved.quoteSavedAt! : null,
      vehicle,
      passengers: Number.isInteger(saved.passengers) ? Number(saved.passengers) : 1,
      luggage: Number.isInteger(saved.luggage) ? Number(saved.luggage) : 0,
      passengerName: typeof saved.passengerName === "string" ? saved.passengerName : "",
      email: typeof saved.email === "string" ? saved.email : "",
      countryCode: typeof saved.countryCode === "string" ? saved.countryCode : "+44",
      phone: typeof saved.phone === "string" ? saved.phone : "",
      note: typeof saved.note === "string" ? saved.note : "",
      recoveryConsent: saved.recoveryConsent === true,
      lastActivityAt,
      confirmation,
    };
  } catch {
    try {
      sessionStorage.removeItem(BOOKING_STORAGE_KEY);
    } catch {
      // Storage may be unavailable; continue with a fresh booking.
    }
    return null;
  }
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { account, adminAccount } = useAuth();
  const { pathname } = useLocation();
  const isBookingJourney = pathname === "/";

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Heathrow Drive home">
        <span className="brand__mark" aria-hidden="true">
          H
        </span>
        <span>
          heathrow drive<span className="brand__dot">.</span>
        </span>
      </Link>
      <button
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
        <span />
        <span />
      </button>
      <nav id="main-navigation" className={menuOpen ? "nav nav--open" : "nav"}>
        {isBookingJourney && (
          <>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <a href="#our-service" onClick={() => setMenuOpen(false)}>
              Our service
            </a>
          </>
        )}
        <Link to="/booking-details" onClick={() => setMenuOpen(false)}>
          Find a booking
        </Link>
        {account && <Link to="/account/bookings" onClick={() => setMenuOpen(false)}>My bookings</Link>}
        {adminAccount && <Link to="/admin" onClick={() => setMenuOpen(false)}>Manage bookings</Link>}
        <Link className="nav__account" to={adminAccount ? "/admin" : account ? "/account" : "/login"} onClick={() => setMenuOpen(false)}>
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="10" cy="6" r="3" />
            <path d="M4 17v-1.5a6 6 0 0 1 12 0V17z" />
          </svg>
          {adminAccount ? "Admin panel" : account ? "My account" : "Sign in"}
          <svg className="nav__chevron" aria-hidden="true" viewBox="0 0 12 12" fill="none">
            <path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </Link>
      </nav>
    </header>
  );
}

function BookingForm({ onStageChange }: { onStageChange?: (stage: BookingStage) => void }) {
  const { account } = useAuth();
  const [restored] = useState(readSavedBookingProgress);
  const accountPhone = account?.phone ? parsePhoneNumberFromString(account.phone) : undefined;
  const [pickup, setPickup] = useState(restored?.pickup ?? "");
  const [dropoff, setDropoff] = useState(restored?.dropoff ?? "");
  const [date, setDate] = useState(restored?.date ?? "");
  const [time, setTime] = useState(restored?.time ?? "");
  const [mapMessage, setMapMessage] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(restored?.quote ?? null);
  const [quoteSavedAt, setQuoteSavedAt] = useState<number | null>(restored?.quoteSavedAt ?? null);
  const [vehicle, setVehicle] = useState<VehicleOption | null>(restored?.vehicle ?? null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(restored?.confirmation ?? null);
  const [message, setMessage] = useState("");
  const [referenceCopied, setReferenceCopied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<BookingStage>(restored?.stage ?? 1);
  const [passengers, setPassengers] = useState(restored?.passengers ?? 1);
  const [luggage, setLuggage] = useState(restored?.luggage ?? 0);
  const [recoveryConsent, setRecoveryConsent] = useState(restored?.recoveryConsent ?? false);
  const [passengerName, setPassengerName] = useState(restored?.passengerName ?? account?.name ?? "");
  const [email, setEmail] = useState(restored?.email ?? account?.email ?? "");
  const [countryCode, setCountryCode] = useState(
    restored?.countryCode ?? (accountPhone ? `+${accountPhone.countryCallingCode}` : getDefaultCountryCode()),
  );
  const [phone, setPhone] = useState(restored?.phone ?? accountPhone?.nationalNumber ?? "");
  const [phoneInput, setPhoneInput] = useState(() => [countryCode, phone].filter(Boolean).join(" "));
  const [note, setNote] = useState(restored?.note ?? "");
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const initialLocation = useRef(true);
  const skipInitialProgressSave = useRef(true);
  const [progressReady, setProgressReady] = useState(false);

  useEffect(() => {
    onStageChange?.(stage);
  }, [onStageChange, stage]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll<HTMLElement>(".booking-card, .booking-flow").forEach((element) => {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    });
  }, [stage]);

  function moveToStage(nextStage: BookingStage, replace = false) {
    setStage(nextStage);
    const params = new URLSearchParams(location.search);
    params.set("bookingStep", `${nextStage}/${BOOKING_STAGE_NAMES[nextStage]}`);
    params.delete("bookingResume");
    const query = serialiseBookingQuery(params);
    navigate({ search: query ? `?${query}` : "" }, { replace });
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);
    const resumeToken = params.get("bookingResume") ?? undefined;

    function applyProgress(progress: SavedBookingProgress) {
      setPickup(progress.pickup);
      setDropoff(progress.dropoff);
      setDate(progress.date);
      setTime(progress.time);
      setQuote(progress.quote);
      setQuoteSavedAt(progress.quoteSavedAt);
      setVehicle(progress.vehicle);
      setPassengers(progress.passengers);
      setLuggage(progress.luggage);
      const restoredName = progress.passengerName || account?.name || "";
      const restoredEmail = progress.email || account?.email || "";
      const accountCallingCode = accountPhone ? `+${accountPhone.countryCallingCode}` : getDefaultCountryCode();
      const restoredCountryCode = progress.countryCode || accountCallingCode;
      const restoredPhone = progress.phone || accountPhone?.nationalNumber || "";
      setPassengerName(restoredName);
      setEmail(restoredEmail);
      setCountryCode(restoredCountryCode);
      setPhone(restoredPhone);
      setPhoneInput([restoredCountryCode, restoredPhone].filter(Boolean).join(" "));
      setNote(progress.note);
      setRecoveryConsent(progress.recoveryConsent);
      setConfirmation(progress.confirmation);
      return progress;
    }

    function syncInitialStage(progress: SavedBookingProgress | null) {
      if (cancelled) return;
      const target = progress?.stage ?? 1;
      setStage(target);
      initialLocation.current = false;
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete("bookingResume");
      nextParams.set("bookingStep", `${target}/${BOOKING_STAGE_NAMES[target]}`);
      navigate({ search: `?${serialiseBookingQuery(nextParams)}` }, { replace: true });
      setProgressReady(true);
    }

    let restoreTimeout = 0;
    const timeoutResult = new Promise<Awaited<ReturnType<typeof bookingApi.restoreProgress>>>((_, reject) => {
      restoreTimeout = window.setTimeout(() => reject(new Error('Booking restore timed out.')), 45000);
    });

    Promise.race([bookingApi.restoreProgress(resumeToken), timeoutResult]).then((result) => {
      if (cancelled) return;
      let progress = restored;
      if (result.progress && typeof result.progress === "object") {
        const serverProgress = result.progress as Partial<SavedBookingProgress>;
        const serverStage = Number(serverProgress.stage ?? 0);
        const localVehicleDiffers = !!restored?.vehicle &&
          restored.stage >= serverStage &&
          restored.vehicle.id !== serverProgress.vehicle?.id;
        const localProgressIsNewer = !!restored && (
          restored.stage > serverStage ||
          localVehicleDiffers ||
          (typeof serverProgress.lastActivityAt === "number" &&
            restored.lastActivityAt >= serverProgress.lastActivityAt)
        );
        if (localProgressIsNewer) {
          progress = restored;
        } else {
          try {
            const serverActivity = typeof serverProgress.lastActivityAt === "number"
              ? serverProgress.lastActivityAt
              : typeof serverProgress.lastActivityAt === "string"
                ? Date.parse(serverProgress.lastActivityAt)
                : Date.now();
            sessionStorage.setItem(
              BOOKING_STORAGE_KEY,
              JSON.stringify({ ...serverProgress, lastActivityAt: serverActivity }),
            );
            progress = readSavedBookingProgress();
          } catch {
            progress = restored;
          }
        }
      } else if (result.completed) {
        progress = restored?.confirmation ? restored : null;
        if (!progress) sessionStorage.removeItem(BOOKING_STORAGE_KEY);
      } else if (result.expired || (resumeToken && !result.progress)) {
        sessionStorage.removeItem(BOOKING_STORAGE_KEY);
        progress = null;
      }
      if (progress) progress = applyProgress(progress);
      syncInitialStage(progress);
    }).catch(() => {
      if (cancelled) return;
      if (restored) applyProgress(restored);
      setMessage(restored
        ? 'We could not sync your saved journey. Your details from this browser are still available.'
        : '');
      syncInitialStage(restored);
    }).finally(() => {
      window.clearTimeout(restoreTimeout);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimeout);
    };
  }, []);

  useEffect(() => {
    if (initialLocation.current || !progressReady) return;
    if (navigationType !== "POP") return;
    const requestedStage = parseBookingStage(new URLSearchParams(location.search).get("bookingStep"));
    if (!requestedStage || requestedStage === 1) moveToStage(1, true);
    else if (requestedStage === 2 && quote) setStage(2);
    else if (requestedStage === 3 && quote && vehicle) setStage(3);
    else if (requestedStage === 4 && quote && vehicle && stage >= 4) setStage(4);
    else moveToStage(quote ? (vehicle ? 3 : 2) : 1, true);
  }, [location.search, navigationType, progressReady, quote, vehicle, stage]);

  useEffect(() => {
    if (!progressReady) return;
    if (skipInitialProgressSave.current) {
      skipInitialProgressSave.current = false;
      return;
    }
    const progress: SavedBookingProgress = {
      pickup,
      dropoff,
      date,
      time,
      stage,
      quote,
      quoteSavedAt,
      vehicle,
      passengers,
      luggage,
      passengerName,
      email,
      countryCode,
      phone,
      note,
      recoveryConsent,
      lastActivityAt: Date.now(),
      confirmation,
    };
    try {
      sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Keep the live booking usable when browser storage is unavailable.
    }
    if (confirmation) {
      void bookingApi.completeProgress().catch(() => undefined);
      return;
    }
    const apiProgress = recoveryConsent
      ? progress
      : { ...progress, passengerName: '', email: '', countryCode: '', phone: '', note: '' };
    const timeout = window.setTimeout(() => {
      void bookingApi.saveProgress(apiProgress).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [
    pickup,
    dropoff,
    date,
    time,
    stage,
    quote,
    quoteSavedAt,
    vehicle,
    passengers,
    luggage,
    passengerName,
    email,
    countryCode,
    phone,
    note,
    recoveryConsent,
    confirmation,
    progressReady,
  ]);

  useEffect(() => {
    if (!account || (restored && (restored.passengerName || restored.email || restored.phone))) return;
    setPassengerName(account.name);
    setEmail(account.email);
    const parsedAccountPhone = parsePhoneNumberFromString(account.phone);
    const accountPhone = parsedAccountPhone?.nationalNumber ?? "";
    const accountCountryCode = parsedAccountPhone
      ? `+${parsedAccountPhone.countryCallingCode}`
      : getDefaultCountryCode();
    setCountryCode(accountCountryCode);
    setPhone(accountPhone);
    setPhoneInput([accountCountryCode, accountPhone].filter(Boolean).join(" "));
  }, [account]);

  async function useCurrentLocation() {
    setMapMessage("Finding your current location…");
    if (!navigator.geolocation) {
      setMapMessage("Location access is not available in this browser. Enter a pickup address instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const address = await reverseGeocode(coords.latitude, coords.longitude);
          setPickup(address);
          clearFieldError("pickup");
          setMapMessage("Pickup set to your current location.");
        } catch (error) {
          setMapMessage(error instanceof Error ? error.message : "Could not find your address.");
        }
      },
      () => setMapMessage("Location permission was not granted. Enter your pickup address instead."),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!pickup.trim()) errors.pickup = "Please enter a pickup location.";
    if (!dropoff.trim()) errors.dropoff = "Please enter a destination.";
    if (pickup.trim() && dropoff.trim() && pickup.trim().toLowerCase() === dropoff.trim().toLowerCase()) {
      errors.dropoff = "Choose a destination different from your pickup location.";
    }
    const todayString = londonDateString();
    if (!date) errors.date = "Please choose your pickup date.";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Enter a valid pickup date.";
    else if (date < todayString) errors.date = "Choose a date that is today or later.";
    else if (date > maxBookingDate()) errors.date = "Bookings can be made up to 12 months in advance.";
    if (!time || !/^\d{2}:\d{2}$/.test(time)) errors.time = "Please choose a valid pickup time.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setMessage("");
    setLoading(true);
    try {
      const result = await bookingApi.quote({ pickup, dropoff, date, time });
      setQuote(result);
      setQuoteSavedAt(Date.now());
      setVehicle(result.quote.vehicles[0] ?? null);
      setPassengers(0);
      setLuggage(-1);
      setConfirmation(null);
      moveToStage(2);
    } catch (error) {
      if (error instanceof BookingRequestError && error.fields) {
        const apiFields = Object.fromEntries(
          Object.entries(error.fields).map(([name, messages]) => [name, messages[0] ?? "Please check this field."]),
        );
        setFieldErrors((current) => ({ ...current, ...apiFields }));
        setMessage("");
      } else {
        setMessage(error instanceof Error ? error.message : "We could not estimate this journey. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredPhone = phoneInput.trim();
    const parsedPhone = parsePhoneNumberFromString(
      enteredPhone,
      enteredPhone.startsWith("+") ? undefined : countryForCallingCode(countryCode),
    );
    const nextCountryCode = parsedPhone ? `+${parsedPhone.countryCallingCode}` : countryCode;
    const nextPhone = parsedPhone?.nationalNumber ?? phone;
    const errors: Record<string, string> = {};
    const trimmedName = passengerName.trim();
    if (!trimmedName) errors.name = "Please enter the passenger’s full name.";
    else if (trimmedName.length < 2) errors.name = "Enter a name with at least 2 characters.";
    else if (!/^[\p{L}][\p{L}\p{M}\s'.-]*$/u.test(trimmedName)) errors.name = "Use letters and common name punctuation only.";
    if (!email.trim()) errors.email = "Please enter an email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errors.email = "Enter a valid email address, such as name@example.com.";
    if (!enteredPhone) errors.phone = "Please enter a phone number with its country code.";
    else if (!parsedPhone?.isValid()) errors.phone = "Enter a valid phone number with its country code.";
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > (vehicle?.passengers ?? 0)) {
      errors.passengers = "Choose a passenger count within this vehicle’s capacity.";
    }
    if (!Number.isInteger(luggage) || luggage < 0 || luggage > (vehicle?.luggage ?? 0)) {
      errors.luggage = "Choose a luggage count within this vehicle’s capacity.";
    }
    if (note.length > 1000) errors.note = "Keep the journey note under 1,000 characters.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setCountryCode(nextCountryCode);
    setPhone(nextPhone);
    setMessage("");
    moveToStage(4);
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handlePhoneInput(value: string) {
    setPhoneInput(value);
    const parsedPhone = parsePhoneNumberFromString(
      value.trim(),
      value.trim().startsWith("+") ? undefined : countryForCallingCode(countryCode),
    );
    if (parsedPhone) {
      setCountryCode(`+${parsedPhone.countryCallingCode}`);
      setPhone(parsedPhone.nationalNumber);
    } else {
      setPhone(value.trim());
    }
    clearFieldError("phone");
  }

  async function handleBooking() {
    if (!quote || !vehicle) return;
    setMessage("");
    setLoading(true);
    try {
      const result = await bookingApi.create({
        quoteToken: quote.quoteToken,
        vehicleId: vehicle.id,
        passengers,
        luggage,
        customer: { name: passengerName, email, countryCode, phone },
        note,
      });
      setConfirmation(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not save the booking. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const money = (amount: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(amount);

  async function copyBookingReference(reference: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(reference);
      } else {
        const input = document.createElement("textarea");
        input.value = reference;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.append(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Copy unavailable");
      }
      setReferenceCopied(true);
    } catch {
      setReferenceCopied(false);
    }
  }

  if (!progressReady) {
    return (
      <section className="booking-card booking-card--restoring" aria-busy="true" aria-live="polite">
        <p className="eyebrow">YOUR JOURNEY</p>
        <p>Restoring your saved booking…</p>
      </section>
    );
  }

  if (confirmation) {
    return (
      <section className="booking-card booking-card--confirmation" aria-live="polite">
        <p className="eyebrow">BOOKING RECEIVED</p>
        <h2>Your journey is requested.</h2>
        <p className="booking-confirmation__number">
          <span>Booking reference</span>
          <strong className="booking-confirmation__code">{confirmation.bookingReference}</strong>
          <button
            type="button"
            className="booking-confirmation__copy"
            aria-live="polite"
            onClick={() => copyBookingReference(confirmation.bookingReference)}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="7" y="6" width="9" height="11" rx="1.5" />
              <path d="M13 6V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v9A1.5 1.5 0 0 0 4.5 15H7" />
            </svg>
            {referenceCopied ? "Copied" : "Copy"}
          </button>
        </p>
        <div className="booking-confirmation__vehicle">
          <VehicleArtwork name={confirmation.vehicle.name} passengers={confirmation.vehicle.passengers} />
          <span>
            <strong>{confirmation.vehicle.name}</strong>
            <small>Selected vehicle</small>
          </span>
          <span className="booking-confirmation__fare">
            <strong>{money(confirmation.vehicle.fare)}</strong>
            <small>Estimated fare</small>
          </span>
        </div>
        <div className="booking-summary">
          <p>
            <strong>{confirmation.quote.pickup}</strong>
            <span>Pickup</span>
          </p>
          <p>
            <strong>{confirmation.quote.dropoff}</strong>
            <span>Destination</span>
          </p>
          <p>
            <strong>
              {formatJourneyDate(confirmation.quote.date)} · {confirmation.quote.time}
            </strong>
            <span>Journey time</span>
          </p>
          <p>
            <strong>{plural(confirmation.vehicle.passengers, "passenger")} · {plural(confirmation.vehicle.luggage, "bag")}</strong>
            <span>Selected vehicle capacity</span>
          </p>
        </div>
        <button
          className="button button--primary booking-card__submit"
          type="button"
          onClick={() => {
            setConfirmation(null);
            setQuote(null);
            setQuoteSavedAt(null);
            setVehicle(null);
            setPickup("");
            setDropoff("");
            setDate("");
            setTime("");
            setPassengerName(account?.name ?? "");
            setEmail(account?.email ?? "");
            setPhone("");
            setPhoneInput(countryCode);
            setNote("");
            setRecoveryConsent(false);
            moveToStage(1, true);
          }}
        >
          Plan another journey <span aria-hidden="true">→</span>
        </button>
      </section>
    );
  }

  return (
    <section
      id="booking-card"
      className={`booking-card${stage === 1 ? " booking-card--plan" : ""}${stage === 2 ? " booking-card--vehicles" : ""}${stage === 3 ? " booking-card--passenger" : ""}`}
    >
      <ol className="booking-progress" aria-label={`Booking progress, step ${stage} of 4`}>
        {[
          { number: 1, label: "Journey" },
          { number: 2, label: "Vehicle" },
          { number: 3, label: "Passenger" },
          { number: 4, label: "Review & book" },
        ].map((step) => {
          const complete = step.number < stage;
          const current = step.number === stage;
          return (
            <li
              key={step.number}
              className={`booking-progress__item${complete ? " booking-progress__item--complete" : ""}${
                current ? " booking-progress__item--current" : ""
              }`}
              aria-current={current ? "step" : undefined}
            >
              <span aria-hidden="true">
                {complete ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="15" fill="#2563EB" />
                    <path
                      d="M10 16.5L14 20.5L22.5 12"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : step.number}
              </span>
              <small>{step.label}</small>
            </li>
          );
        })}
      </ol>
      <div className="booking-card__heading">
        <div>
          <p className="eyebrow">
            {stage === 4
              ? "REVIEW BOOKING"
              : stage === 3
                ? "PASSENGER DETAILS"
                : stage === 2
                  ? "VEHICLE OPTIONS"
                  : "PLAN A JOURNEY"}
          </p>
          <h2>
            {stage === 4
              ? "Review your journey"
              : stage === 3
                ? "Complete your booking"
                : stage === 2
                  ? "Choose your ride"
                  : "Where can we take you?"}
          </h2>
          <p className="booking-card__intro">
            {stage === 4
              ? "Check your route, ride, fare, and passenger details before confirming."
              : stage === 3
                ? "Add your contact details so we can confirm the journey request."
                  : stage === 2
                    ? "Compare the available vehicles, capacity, and estimated fares."
                  : "Enter your route and time to compare vehicles and fares."}
          </p>
        </div>
      </div>
      {stage === 1 && (
        <form className="booking-flow" noValidate onSubmit={handleSubmit}>
          <section className="booking-card__form-section" aria-labelledby="journey-route-heading">
            <div className="booking-card__section-heading">
              <h3 id="journey-route-heading">Your route</h3>
              <p>Choose your pickup and destination.</p>
            </div>
            <div className="booking-card__route-group">
              <LocationInput
                id="pickup"
                name="pickup"
                label="Pickup location"
                placeholder="Enter or choose a pickup address"
                value={pickup}
                tone="start"
                onChange={(value) => {
                  setPickup(value);
                  clearFieldError("pickup");
                }}
                onSelect={setPickup}
                error={fieldErrors.pickup}
              />
              <div className="current-location-row">
                <span className="current-location-row__target" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="12" r="8.5" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                </span>
                <button type="button" className="location-button" onClick={useCurrentLocation}>
                  <svg
                    className="location-button__navigation"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  <span>Use my current location</span>
                </button>
                <div className="route-line" aria-hidden="true" />
              </div>
              <LocationInput
                id="dropoff"
                name="dropoff"
                label="Destination"
                placeholder="Where are you going?"
                value={dropoff}
                tone="end"
                onChange={(value) => {
                  setDropoff(value);
                  clearFieldError("dropoff");
                }}
                onSelect={setDropoff}
                error={fieldErrors.dropoff}
              />
            </div>
          </section>
          <section className="booking-card__form-section" aria-labelledby="journey-time-heading">
            <div className="booking-card__section-heading">
              <h3 id="journey-time-heading">Date and time</h3>
              <p>Set the planned pickup time for your journey.</p>
            </div>
            <div className="booking-card__details">
              <label className="field field--compact">
                <span className="field__label">
                  Pickup date{" "}
                  <span className="field__required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  type="date"
                  name="date"
                  min={londonDateString()}
                  max={maxBookingDate()}
                  value={date}
                  onClick={(event) => event.currentTarget.showPicker?.()}
                  onChange={(event) => {
                    setDate(event.target.value);
                    clearFieldError("date");
                  }}
                  aria-invalid={Boolean(fieldErrors.date)}
                  aria-describedby={fieldErrors.date ? "date-error" : undefined}
                  required
                />
                {fieldErrors.date && <small className="field__error" id="date-error" role="alert">{fieldErrors.date}</small>}
              </label>
              <label className="field field--compact">
                <span className="field__label">
                  Pickup time{" "}
                  <span className="field__required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  type="time"
                  name="time"
                  value={time}
                  onClick={(event) => event.currentTarget.showPicker?.()}
                  onChange={(event) => {
                    setTime(event.target.value);
                    clearFieldError("time");
                  }}
                  aria-invalid={Boolean(fieldErrors.time)}
                  aria-describedby={fieldErrors.time ? "time-error" : undefined}
                  required
                />
                {fieldErrors.time && <small className="field__error" id="time-error" role="alert">{fieldErrors.time}</small>}
              </label>
            </div>
          </section>
          <button className="button button--primary booking-card__submit" type="submit" disabled={loading}>
            {loading ? "Calculating your options…" : "View vehicles and fares"} <span aria-hidden="true">→</span>
          </button>
          <p className="booking-card__payment-note">
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 9v5m0-8h.01" />
            </svg>
            No payment required to compare vehicles.
          </p>
          <p className="map-attribution">
            ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>{" "}
            · Search by Photon · Routes by OSRM
          </p>
        </form>
      )}
      {stage === 2 && quote && (
        <>
          <button
            type="button"
            className="text-button booking-card__back"
            onClick={() => {
              setQuote(null);
              setQuoteSavedAt(null);
              setVehicle(null);
              setMessage("");
              moveToStage(1);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 19-7-7 7-7M19 12H5" />
            </svg>
            Back to Journey details
          </button>
          <div className="vehicle-route-summary" aria-label="Journey summary">
            <div className="vehicle-route-summary__route">
            <div className="vehicle-route-summary__place">
              <span className="vehicle-route-summary__icon vehicle-route-summary__icon--pickup" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                  <circle cx="12" cy="10" r="2.2" />
                </svg>
              </span>
              <span>
                <strong>{quote.quote.pickup}</strong>
                <small>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                  </svg>
                  {formatJourneyDate(quote.quote.date)} · {quote.quote.time}
                </small>
              </span>
            </div>
            <span className="vehicle-route-summary__connector" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14m-7-7 7 7-7 7" />
              </svg>
            </span>
            <div className="vehicle-route-summary__place">
              <span className="vehicle-route-summary__icon vehicle-route-summary__icon--destination" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                  <circle cx="12" cy="10" r="2.2" />
                </svg>
              </span>
              <span>
                <strong>{quote.quote.dropoff}</strong>
                <small>Destination</small>
              </span>
            </div>
            </div>
            <div className="vehicle-route-summary__metric">
              <span className="vehicle-route-summary__icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="6" cy="19" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                  <circle cx="18" cy="5" r="3" />
                </svg>
              </span>
              <span>
                <strong>{quote.quote.distanceMiles.toFixed(1)} mi</strong>
                <small>Journey distance</small>
              </span>
            </div>
            <div className="vehicle-route-summary__metric">
              <span className="vehicle-route-summary__icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <span>
                <strong>{quote.quote.durationText}</strong>
                <small>Estimated drive · no live traffic</small>
              </span>
            </div>
          </div>
          <div className="vehicle-list-heading">
            <div>
              <h3>Available vehicles</h3>
              <p>Choose the option that best suits your journey.</p>
            </div>
              <span>{quote.quote.vehicles.length} options · fares in GBP</span>
          </div>
          <div className="vehicle-options">
            {quote.quote.vehicles.map((option, index) => (
              <label
                className={`vehicle-option${vehicle?.id === option.id ? " vehicle-option--selected" : ""}`}
                key={option.id}
              >
                <input
                  className="vehicle-option__input"
                  type="radio"
                  name="vehicle-option"
                  value={option.id}
                  checked={vehicle?.id === option.id}
                  onChange={() => {
                    setVehicle(option);
                    setPassengers(0);
                    setLuggage(-1);
                  }}
                  aria-label={`Select ${option.name}, estimated fare ${money(option.fare)}`}
                />
                {index === 0 && <span className="vehicle-option__badge">Popular</span>}
                <div className="vehicle-option__artwork">
                  <VehicleArtwork name={option.name} passengers={option.passengers} />
                </div>
                <div className="vehicle-option__copy">
                  <h3>{option.name}</h3>
                  <p>{option.description}</p>
                </div>
                <div className="vehicle-option__details">
                  <span className="vehicle-option__capacity">
                    <PassengerIcon />
                    <span>Up to {option.passengers} passengers</span>
                  </span>
                  <span className="vehicle-option__capacity">
                    <LuggageIcon />
                    <span>Up to {plural(option.luggage, "bag")}</span>
                  </span>
                  <span className="vehicle-option__capacity vehicle-option__capacity--fit">
                    <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
                      <path
                        d="m6.2 10.1 2.45 2.45 5.2-5.25"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{option.passengers > 4 ? "Spacious group travel" : "Ideal for airport transfers"}</span>
                  </span>
                </div>
                <span className="vehicle-option__side">
                  <span className="vehicle-option__price">
                  <strong>{money(option.fare)}</strong>
                  <small>Estimated fare · GBP</small>
                  </span>
                  <span className="vehicle-option__tick" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                </span>
                {vehicle?.id === option.id && (
                  <span className="vehicle-option__selected-label" aria-hidden="true">
                    Selected
                  </span>
                )}
              </label>
            ))}
          </div>
          <p className="vehicle-options__note">
            Your fare is estimated from the selected route and vehicle. No online payment is taken at this stage.
          </p>
          <div className="vehicle-confirm-bar">
            <div className="vehicle-confirm-bar__inner">
              <div className="vehicle-confirm-bar__selected" aria-live="polite">
                <span className="vehicle-confirm-bar__label">
                  {vehicle ? "Selected vehicle" : "Your selection"}
                </span>
                <strong>
                  {vehicle ? (
                    <>
                      {vehicle.name} <span>·</span> {money(vehicle.fare)}
                    </>
                  ) : "Choose a vehicle to continue"}
                </strong>
              </div>
              <button
                className="button button--primary vehicle-confirm-bar__continue"
                type="button"
                disabled={!vehicle}
                onClick={() => moveToStage(3)}
              >
                Continue
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14m-7-7 7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
      {stage === 3 && quote && vehicle && (
        <div className="booking-card__stage-layout booking-card__stage-layout--passenger">
          <button type="button" className="text-button booking-card__back" onClick={() => moveToStage(2)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 19-7-7 7-7M19 12H5" />
            </svg>
            Back to vehicle options
          </button>
          <div className="booking-card__journey-vehicle">
            <div className="booking-selected__vehicle">
              <VehicleArtwork name={vehicle.name} passengers={vehicle.passengers} priority />
              <span>
                <strong>{vehicle.name}</strong>
                <small className="booking-selected__vehicle-capacity">
                  <span><PassengerIcon />Up to {vehicle.passengers} passengers</span>
                  <span><LuggageIcon />Up to {plural(vehicle.luggage, "bag")}</span>
                </small>
              </span>
            </div>
            <div className="selected-journey" aria-label="Journey summary">
              <p>
                <span className="field__pin field__pin--start" aria-hidden="true" />
                <strong>{quote.quote.pickup}</strong>
              </p>
              <p>
                <span className="field__pin field__pin--end" aria-hidden="true" />
                <strong>{quote.quote.dropoff}</strong>
              </p>
              <small className="selected-journey__metrics" aria-label="Journey date, time, distance, and duration">
                  <span><BookingFieldIcon name="date" />{formatJourneyDate(quote.quote.date)}</span>
                <span><BookingFieldIcon name="time" />{quote.quote.time}</span>
                <span><BookingFieldIcon name="route" />{quote.quote.distanceMiles.toFixed(1)} miles</span>
                <span><BookingFieldIcon name="duration" />{quote.quote.durationText}</span>
              </small>
            </div>
            <div className="booking-selected__stage-fare">
              <strong>{money(vehicle.fare)}</strong>
              <small>Estimated fare</small>
              <button
                type="button"
                className="button button--primary booking-selected__change"
                onClick={() => {
                  setVehicle(null);
                  moveToStage(2);
                }}
              >
                Change vehicle
              </button>
            </div>
          </div>
          <form
            id="passenger-booking-form"
            className="booking-flow booking-flow--passenger"
            noValidate
            onSubmit={handleReview}
          >
            <div className="booking-card__section-heading passenger-details-banner">
              <span className="passenger-details-banner__icon" aria-hidden="true">
                <PassengerIcon />
              </span>
              <div className="passenger-details-banner__copy">
                <h3>Passenger Details</h3>
                <p>Tell us about your journey and how to contact you.</p>
              </div>
              <svg className="passenger-details-banner__art" viewBox="0 0 560 160" aria-hidden="true" focusable="false">
                <path d="M0 126c54-22 85-12 132-29 54-20 82-4 131-15 50-12 76-4 120-19 63-21 111-5 177-29v126H0Z" fill="#e8f1ff" />
                <path d="M0 141c69-23 105-10 158-21 57-12 91-2 145-17 57-16 98-3 142-18 51-17 79-13 115-31" fill="none" stroke="#c8dcff" strokeWidth="2" />
                <g fill="#d4e5ff">
                  <path d="M294 77h22V48h12V35l13 13v29h13V56h10V40l12 16v21h15V43h12V25l13 18v34h15V55h13V39l12 16v22h25V63h12V51l12 12v14h37v23H294Z" />
                  <path d="M58 57c0-9 8-16 17-16 5-11 22-11 27 1 10 0 15 6 15 15H58ZM443 31c0-7 6-12 13-12 4-9 18-9 22 1 8 0 12 5 12 11h-47Z" />
                </g>
                <path d="M326 106c42-20 78-7 112 2 47 12 84 5 127-11" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="8 7" />
                <g fill="#2563eb">
                  <path d="M322 89c0-10 8-18 18-18s18 8 18 18c0 13-18 31-18 31s-18-18-18-31Z" />
                  <circle cx="340" cy="89" r="5" fill="#fff" />
                  <path d="M540 89c0-10 8-18 18-18s18 8 18 18c0 13-18 31-18 31s-18-18-18-31Z" />
                  <circle cx="558" cy="89" r="5" fill="#fff" />
                </g>
                <g transform="translate(176 74)">
                  <path d="M8 35V15c0-5 4-9 9-9h54c5 0 9 4 11 8l10 8h14c5 0 9 4 9 9v12H8Z" fill="#1760c8" />
                  <path d="M22 11h19v16H18V15c0-2 2-4 4-4ZM47 11h20c4 0 7 3 9 7l4 9H47Z" fill="#eaf3ff" />
                  <circle cx="29" cy="43" r="10" fill="#17366d" /><circle cx="29" cy="43" r="5" fill="#dbe9ff" />
                  <circle cx="87" cy="43" r="10" fill="#17366d" /><circle cx="87" cy="43" r="5" fill="#dbe9ff" />
                </g>
              </svg>
            </div>
            <div className="booking-card__details booking-card__details--three">
              <label className="field field--compact">
                <span className="field__label">Passengers</span>
                <IconFieldControl name="passengers">
                  <select
                    value={passengers || ""}
                    onChange={(event) => {
                      setPassengers(Number(event.target.value));
                      clearFieldError("passengers");
                    }}
                    aria-invalid={Boolean(fieldErrors.passengers)}
                    aria-describedby={fieldErrors.passengers ? "passengers-error" : undefined}
                    required
                  >
                    <option value="" disabled>Select number of passengers</option>
                    {Array.from({ length: vehicle.passengers }, (_, i) => i + 1).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </IconFieldControl>
                {fieldErrors.passengers && <small className="field__error" id="passengers-error" role="alert">{fieldErrors.passengers}</small>}
              </label>
              <label className="field field--compact">
                <span className="field__label">Bags</span>
                <IconFieldControl name="bags">
                  <select
                    value={luggage < 0 ? "" : luggage}
                    onChange={(event) => {
                      setLuggage(event.target.value === "" ? -1 : Number(event.target.value));
                      clearFieldError("luggage");
                    }}
                    aria-invalid={Boolean(fieldErrors.luggage)}
                    aria-describedby={fieldErrors.luggage ? "luggage-error" : undefined}
                    required
                  >
                    <option value="" disabled>Select number of bags</option>
                    {Array.from({ length: vehicle.luggage + 1 }, (_, i) => i).map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </IconFieldControl>
                {fieldErrors.luggage && <small className="field__error" id="luggage-error" role="alert">{fieldErrors.luggage}</small>}
              </label>
            </div>
            <label className="field">
              <span className="field__label">
                Passenger name{" "}
                <span className="field__required" aria-hidden="true">
                  *
                </span>
              </span>
              <IconFieldControl name="name">
                <input
                  value={passengerName}
                  onChange={(event) => {
                    setPassengerName(event.target.value);
                    clearFieldError("name");
                  }}
                  autoComplete="name"
                  minLength={2}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  required
                />
              </IconFieldControl>
              {fieldErrors.name && <small className="field__error" id="name-error" role="alert">{fieldErrors.name}</small>}
            </label>
            <div className="booking-card__details booking-card__details--passenger-contact">
              <label className="field">
                <span className="field__label">
                  Email address{" "}
                  <span className="field__required" aria-hidden="true">
                    *
                  </span>
                </span>
                <IconFieldControl name="email">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearFieldError("email");
                    }}
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    required
                  />
                </IconFieldControl>
                {fieldErrors.email && <small className="field__error" id="email-error" role="alert">{fieldErrors.email}</small>}
              </label>
              <label className="field field--compact booking-phone">
                <span className="field__label">
                  Phone number{" "}
                  <span className="field__required" aria-hidden="true">
                    *
                  </span>
                </span>
                <IconFieldControl name="phone">
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(event) => handlePhoneInput(event.target.value)}
                    placeholder="+44 7700 900000"
                    autoComplete="tel"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                    required
                  />
                </IconFieldControl>
                {fieldErrors.phone && <small className="field__error" id="phone-error" role="alert">{fieldErrors.phone}</small>}
              </label>
            </div>
            <label className="field">
              <span className="field__label">
                Journey note <span className="field__optional">Optional</span>
              </span>
              <IconFieldControl name="note">
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Anything your driver should know?"
                  maxLength={1000}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    clearFieldError("note");
                  }}
                  aria-invalid={Boolean(fieldErrors.note)}
                  aria-describedby={fieldErrors.note ? "note-error" : undefined}
                />
              </IconFieldControl>
              {fieldErrors.note && <small className="field__error" id="note-error" role="alert">{fieldErrors.note}</small>}
            </label>
            <label className="booking-recovery-consent">
              <input
                type="checkbox"
                checked={recoveryConsent}
                onChange={(event) => setRecoveryConsent(event.target.checked)}
              />
              <span>
                <strong>Email me one reminder if I leave before booking.</strong>
                <small>Your saved progress and resume link expire 30 minutes after your last activity.</small>
              </span>
            </label>
          </form>
          <div className="booking-card__stage-footer">
            <button
              className="button button--primary booking-card__submit"
              type="submit"
              form="passenger-booking-form"
            >
              Review booking <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
      {stage === 4 && quote && vehicle && (
        <div className="booking-flow booking-flow--passenger booking-review" aria-label="Review booking">
          <button type="button" className="text-button booking-card__back" onClick={() => moveToStage(3)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 19-7-7 7-7M19 12H5" />
            </svg>
            Back to passenger details
          </button>
          <div className="selected-journey" aria-label="Journey summary">
            <p>
              <span className="field__pin field__pin--start" aria-hidden="true" />
              <strong>{quote.quote.pickup}</strong>
            </p>
            <p>
              <span className="field__pin field__pin--end" aria-hidden="true" />
              <strong>{quote.quote.dropoff}</strong>
            </p>
            <small className="selected-journey__metrics">
                  <span><BookingFieldIcon name="date" />{formatJourneyDate(quote.quote.date)}</span>
              <span><BookingFieldIcon name="time" />{quote.quote.time}</span>
              <span><BookingFieldIcon name="route" />{quote.quote.distanceMiles.toFixed(1)} mi · {quote.quote.durationText}</span>
            </small>
          </div>
          <div className="booking-selected booking-selected--review">
            <VehicleArtwork name={vehicle.name} passengers={vehicle.passengers} />
            <span className="booking-selected__review-copy">
              <strong>{vehicle.name}</strong>
              <small>Up to {plural(vehicle.passengers, "passenger")} · {plural(vehicle.luggage, "bag")}</small>
            </span>
            <span className="booking-selected__review-fare">
              <strong>{money(vehicle.fare)}</strong>
              <small>Estimated fare</small>
            </span>
          </div>
          <section className="booking-card__form-section" aria-labelledby="booking-review-passenger-heading">
            <div className="booking-card__section-heading">
              <h3 id="booking-review-passenger-heading">Passenger details</h3>
              <p>Check the contact details and group size for this request.</p>
            </div>
            <div className="booking-review-grid">
              <p>
                <span className="booking-review-grid__label"><BookingFieldIcon name="name" />Name</span>
                <strong>{passengerName}</strong>
              </p>
              <p>
                <span className="booking-review-grid__label"><BookingFieldIcon name="email" />Email</span>
                <strong>{email}</strong>
              </p>
              <p>
                <span className="booking-review-grid__label"><BookingFieldIcon name="phone" />Phone</span>
                <strong>
                  {countryCode} {phone}
                </strong>
              </p>
              <p>
                <span className="booking-review-grid__label"><BookingFieldIcon name="passengers" />Passengers and bags</span>
                <strong>
                  {plural(passengers, "passenger")} · {plural(luggage, "bag")}
                </strong>
              </p>
            </div>
          </section>
          {note && (
            <section className="booking-card__form-section" aria-labelledby="booking-review-note-heading">
              <div className="booking-card__section-heading">
                <h3 id="booking-review-note-heading">Journey note</h3>
              </div>
              <p className="booking-review__note">{note}</p>
            </section>
          )}
          <button
            className="button button--primary booking-card__submit"
            type="button"
            onClick={handleBooking}
            disabled={loading}
          >
            {loading ? "Saving your booking…" : `Confirm booking · ${money(vehicle.fare)}`}{" "}
            <span aria-hidden="true">→</span>
          </button>
          <p className="booking-payment-note">
            This request reserves your journey details. Online payment is not enabled.
          </p>
        </div>
      )}
      <p
        className={`booking-card__message${
          message.startsWith('We could not sync') || message.startsWith('We could not restore')
            ? ' booking-card__message--warning'
            : !progressReady && !message
              ? ' booking-card__message--loading'
              : ''
        }`}
        role="status"
        aria-live="polite"
      >
        {!progressReady && !message ? 'Checking for a saved journey…' : message || mapMessage}
      </p>
      {stage === 1 && (
        <p className="booking-card__fine">Fare and route estimates are calculated for your selected journey.</p>
      )}
    </section>
  );
}

function HomePage() {
  const [bookingStage, setBookingStage] = useState<BookingStage>(() => readSavedBookingProgress()?.stage ?? 1);
  return (
    <>
      <section
        className={`hero hero--stage-${bookingStage}${
          bookingStage === 1 ? " hero--plan" : ""
        }${bookingStage === 2 ? " hero--vehicles" : ""}`}
      >
        <div className="hero__copy" aria-hidden={bookingStage > 1}>
          <p className="hero__eyebrow">
            <span aria-hidden="true" /> Airport transfers &amp; local travel
          </p>
          <h1>
            Every journey
            <br />
            starts <em>with ease.</em>
          </h1>
          <p className="hero__lead">
            From airport transfers to local trips, plan your ride with clear journey details and straightforward
            booking.
          </p>
          <ul className="hero__features" aria-label="Booking benefits">
            <li>
              <span className="hero__feature-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M8 2v4M16 2v4M3 9h18" />
                  <path d="M8.5 15l2.5 2.5 4.5-5" />
                </svg>
              </span>
              <span>
                <strong>Quick and simple booking</strong>
                <small>Add your route and travel time to compare vehicles and fares.</small>
              </span>
            </li>
            <li>
              <span className="hero__feature-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 17V13l2-4h9l3 4h4a2 2 0 0 1 2 2v2h-2" />
                  <path d="M2 17h2M9 17h6" />
                  <circle cx="6.5" cy="17" r="2" />
                  <circle cx="17.5" cy="17" r="2" />
                  <path d="M4 13h14M9 9v4" />
                </svg>
              </span>
              <span>
                <strong>A range of vehicles for your needs</strong>
                <small>From standard cars to larger vehicles for groups.</small>
              </span>
            </li>
            <li>
              <span className="hero__feature-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
                  <circle cx="7.5" cy="7.5" r="1.5" />
                  <path d="M14.5 10h-3a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-4m3-11v9" />
                </svg>
              </span>
              <span>
                <strong>Clear and upfront fares</strong>
                <small>See estimated prices before you request your ride.</small>
              </span>
            </li>
          </ul>
        </div>
        <div className={`hero__booking${bookingStage === 1 ? ' hero__booking--plan' : ''}`}>
          <BookingForm onStageChange={setBookingStage} />
        </div>
      </section>
      <section
        className={`trust-strip${bookingStage === 2 ? " trust-strip--vehicles" : ""}`}
        aria-label="Booking benefits"
      >
        <article className="trust-strip__item">
          <span className="trust-strip__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m20 13-8 8-9-9V3h9z" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="m12 7 4 4" />
            </svg>
          </span>
          <span>
            <strong>Clear fare estimates</strong>
            <small>Compare prices before requesting</small>
          </span>
        </article>
        <article className="trust-strip__item">
          <span className="trust-strip__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 11 1.5-4h11L19 11" />
              <path d="M4 11h16v7H4zM7 18v2m10-2v2M7 14h.01M17 14h.01" />
            </svg>
          </span>
          <span>
            <strong>Options for your group</strong>
            <small>Choose the space you need</small>
          </span>
        </article>
        <article className="trust-strip__item">
          <span className="trust-strip__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 4h14v16H5zM8 8h8m-8 4h5" />
              <circle cx="17" cy="17" r="3" />
            </svg>
          </span>
          <span>
            <strong>Guest booking lookup</strong>
            <small>View details with your reference</small>
          </span>
        </article>
        <article className="trust-strip__item">
          <span className="trust-strip__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12 2.5 2.5L16 9" />
            </svg>
          </span>
          <span>
            <strong>No online payment</strong>
            <small>Request a ride without paying now</small>
          </span>
        </article>
      </section>
      <section id="how-it-works" className="steps-section">
        <div className="section-intro">
          <p className="eyebrow">A BETTER WAY TO TRAVEL</p>
          <h2>
            Simple from the
            <br />
            very first mile.
          </h2>
        </div>
        <div className="steps-grid">
          <article className="step-card">
            <span className="step-card__number">01</span>
            <h3>Tell us where</h3>
            <p>Share your pickup, destination, and when you would like to travel.</p>
          </article>
          <article className="step-card">
            <span className="step-card__number">02</span>
            <h3>Choose your ride</h3>
            <p>Find the right space for your people, bags, and plans.</p>
          </article>
          <article className="step-card">
            <span className="step-card__number">03</span>
            <h3>Travel easy</h3>
            <p>Get your journey details and enjoy a little more peace of mind.</p>
          </article>
        </div>
      </section>
      <section id="our-service" className="services">
        <div className="services__lines" aria-hidden="true" />
        <div className="services__glow" aria-hidden="true" />
        <div className="services__inner">
          <div className="services__head">
            <div>
              <span className="services__eyebrow">
                <span className="services__eyebrow-dot" aria-hidden="true" />
                Our services
              </span>
              <h2 className="services__title">
                Journeys for every <span className="services__text-gradient">part of your day.</span>
              </h2>
            </div>
            <p className="services__lede">
              Choose the ride that fits your plans, then compare vehicle options and estimated fares —
              all before you book.
            </p>
          </div>
          <div className="services__grid">
            <a className="services__card" href="#booking-card">
              <span className="services__card-glow" aria-hidden="true" />
              <span className="services__card-top">
                <span className="services__card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                  </svg>
                </span>
                <span className="services__card-number">01</span>
              </span>
              <span className="services__card-body">
                <span className="services__card-tag">Most booked</span>
                <span className="services__card-title">Airport transfers</span>
                <span className="services__card-text">
                  Plan a ride to or from the airport with your route and estimated fare shown before you book.
                </span>
                <span className="services__card-cta">
                  Plan this ride
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 7h10v10M7 17 17 7" />
                  </svg>
                </span>
              </span>
            </a>
            <a className="services__card" href="#booking-card">
              <span className="services__card-glow" aria-hidden="true" />
              <span className="services__card-top">
                <span className="services__card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span className="services__card-number">02</span>
              </span>
              <span className="services__card-body">
                <span className="services__card-tag">Arrivals &amp; departures</span>
                <span className="services__card-title">Airport pick-up &amp; drop-off</span>
                <span className="services__card-text">
                  Set your collection point and destination for an airport arrival or departure.
                </span>
                <span className="services__card-cta">
                  Plan this ride
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 7h10v10M7 17 17 7" />
                  </svg>
                </span>
              </span>
            </a>
            <a className="services__card" href="#booking-card">
              <span className="services__card-glow" aria-hidden="true" />
              <span className="services__card-top">
                <span className="services__card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
                    <path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
                  </svg>
                </span>
                <span className="services__card-number">03</span>
              </span>
              <span className="services__card-body">
                <span className="services__card-tag">Scheduled journeys</span>
                <span className="services__card-title">School runs</span>
                <span className="services__card-text">
                  Arrange a school journey by entering the pick-up, destination and travel time.
                </span>
                <span className="services__card-cta">
                  Plan this ride
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 7h10v10M7 17 17 7" />
                  </svg>
                </span>
              </span>
            </a>
            <a className="services__card" href="#booking-card">
              <span className="services__card-glow" aria-hidden="true" />
              <span className="services__card-top">
                <span className="services__card-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                    <circle cx="7" cy="17" r="2" />
                    <path d="M9 17h6" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                </span>
                <span className="services__card-number">04</span>
              </span>
              <span className="services__card-body">
                <span className="services__card-tag">Around town</span>
                <span className="services__card-title">Local travel</span>
                <span className="services__card-text">
                  Book a ride around town for everyday trips, appointments or meeting friends.
                </span>
                <span className="services__card-cta">
                  Plan this ride
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 7h10v10M7 17 17 7" />
                  </svg>
                </span>
              </span>
            </a>
          </div>
        </div>
      </section>
      <footer className="site-footer">
        <Link className="brand" to="/">
          <span className="brand__mark">H</span>
          <span>
            heathrow drive<span className="brand__dot">.</span>
          </span>
        </Link>
        <span>Private hire, made clear.</span>
        <span>© {new Date().getFullYear()} Heathrow Drive</span>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<LoginPage adminOnly />} />
        <Route path="/admin" element={<AdminBookingsPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/bookings" element={<MyBookingsPage />} />
        <Route path="/booking-details" element={<BookingLookupPage />} />
        <Route
          path="*"
          element={
            <main className="message-page">
              <p className="eyebrow">PAGE NOT FOUND</p>
              <h1>That road ends here.</h1>
              <Link className="button button--primary" to="/">
                Back to home <span aria-hidden="true">→</span>
              </Link>
            </main>
          }
        />
      </Routes>
    </>
  );
}
