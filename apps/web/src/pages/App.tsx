import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LocationInput } from "../components/LocationInput";
import { LuggageIcon, PassengerIcon, VehicleArtwork } from "../components/VehicleArtwork";
import { bookingApi, type BookingConfirmation, type QuoteResponse } from "../services/bookings";
import { reverseGeocode } from "../services/maps";
import type { VehicleOption } from "../types/booking";
import { AccountPage, LoginPage, MyBookingsPage, RegisterPage } from "./AuthPages";
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
    passengers: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20" /></>,
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
      /^\d{2}:\d{2}$/.test(saved.time);
    const validQuote = routeIsComplete && isQuoteResponse(saved.quote) ? saved.quote : null;
    const quoteIsFresh =
      validQuote && typeof saved.quoteSavedAt === "number" && Date.now() - saved.quoteSavedAt < 30 * 60 * 1000;
    const quote = quoteIsFresh ? validQuote : null;
    const vehicle =
      quote && isVehicleOption(saved.vehicle)
        ? (quote.quote.vehicles.find((option) => option.id === saved.vehicle?.id) ?? null)
        : null;
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
      : quote && vehicle && (saved.stage === 3 || saved.stage === 4)
        ? saved.stage
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

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Northstar home">
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
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
          How it works
        </a>
        <a href="#our-service" onClick={() => setMenuOpen(false)}>
          Our service
        </a>
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
    restored?.countryCode ?? account?.phone.match(/^\+\d{1,4}/)?.[0] ?? getDefaultCountryCode(),
  );
  const [phone, setPhone] = useState(restored?.phone ?? account?.phone.replace(/^\+\d{1,4}-?/, "") ?? "");
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
      const restoredCountryCode = progress.countryCode || account?.phone.match(/^\+\d{1,4}/)?.[0] || getDefaultCountryCode();
      const restoredPhone = progress.phone || account?.phone.replace(/^\+\d{1,4}-?/, "") || "";
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
      const requested = parseBookingStage(params.get("bookingStep"));
      const target = progress
        ? (requested === progress.stage ? requested : progress.stage)
        : 1;
      setStage(target);
      initialLocation.current = false;
      const nextParams = new URLSearchParams(location.search);
      nextParams.delete("bookingResume");
      nextParams.set("bookingStep", `${target}/${BOOKING_STAGE_NAMES[target]}`);
      navigate({ search: `?${serialiseBookingQuery(nextParams)}` }, { replace: true });
      setProgressReady(true);
    }

    bookingApi.restoreProgress(resumeToken).then((result) => {
      if (cancelled) return;
      let progress = restored;
      if (result.progress && typeof result.progress === "object") {
        try {
          sessionStorage.setItem(
            BOOKING_STORAGE_KEY,
            JSON.stringify({ ...(result.progress as object), lastActivityAt: Date.now() }),
          );
          progress = readSavedBookingProgress();
        } catch {
          progress = restored;
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
      if (restored) applyProgress(restored);
      syncInitialStage(restored);
    });

    return () => {
      cancelled = true;
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
    const timeout = window.setTimeout(() => {
      void bookingApi.saveProgress(progress).catch(() => undefined);
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
    const accountPhone = account.phone.replace(/^\+\d{1,4}-?/, "");
    const accountCountryCode = account.phone.match(/^\+\d{1,4}/)?.[0] ?? getDefaultCountryCode();
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
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (!date) errors.date = "Please choose your pickup date.";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Enter a valid pickup date.";
    else if (date < todayString) errors.date = "Choose a date that is today or later.";
    if (!time || !/^\d{2}:\d{2}$/.test(time)) errors.time = "Please choose a valid pickup time.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setMessage("");
    setLoading(true);
    try {
      const result = await bookingApi.quote({ pickup, dropoff, date, time });
      setQuote(result);
      setQuoteSavedAt(Date.now());
      setVehicle(null);
      setConfirmation(null);
      moveToStage(2);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not estimate this journey. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredPhone = phoneInput.trim();
    const phoneWithCode = enteredPhone.match(/^(\+\d{1,4})[\s-]+(.+)$/);
    let nextCountryCode = countryCode;
    let nextPhone = phone;
    if (enteredPhone.startsWith(countryCode)) {
      nextPhone = enteredPhone.slice(countryCode.length).replace(/^[\s()-]+/, "").trim();
    } else if (phoneWithCode) {
      nextCountryCode = phoneWithCode[1];
      nextPhone = phoneWithCode[2].trim();
    } else {
      nextPhone = enteredPhone;
    }
    const errors: Record<string, string> = {};
    const trimmedName = passengerName.trim();
    if (!trimmedName) errors.name = "Please enter the passenger’s full name.";
    else if (trimmedName.length < 2) errors.name = "Enter a name with at least 2 characters.";
    else if (!/^[\p{L}][\p{L}\p{M}\s'.-]*$/u.test(trimmedName)) errors.name = "Use letters and common name punctuation only.";
    if (!email.trim()) errors.email = "Please enter an email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errors.email = "Enter a valid email address, such as name@example.com.";
    if (!/^\+\d{1,4}$/.test(nextCountryCode)) errors.phone = "Choose a valid country calling code.";
    const phoneDigits = nextPhone.replace(/\D/g, "");
    if (!enteredPhone) errors.phone = "Please enter a phone number with its country code.";
    else if (phoneDigits.length < 6 || phoneDigits.length > 15) errors.phone = "Enter a phone number with 6 to 15 digits.";
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
    const trimmedValue = value.trimStart();
    if (trimmedValue.startsWith(countryCode)) {
      setPhone(trimmedValue.slice(countryCode.length).replace(/^[\s()-]+/, ""));
      return;
    }

    const recognizedCode = Object.values(callingCodes)
      .sort((a, b) => b.length - a.length)
      .find((code) => trimmedValue.startsWith(code));
    if (recognizedCode && trimmedValue.length > recognizedCode.length) {
      setCountryCode(recognizedCode);
      setPhone(trimmedValue.slice(recognizedCode.length).replace(/^[\s()-]+/, ""));
      return;
    }

    const splitPhone = trimmedValue.match(/^(\+\d{1,4})\s+(.+)$/);
    if (splitPhone) {
      setCountryCode(splitPhone[1]);
      setPhone(splitPhone[2].trim());
      return;
    }

    if (/^\+\d{1,4}$/.test(trimmedValue)) {
      setCountryCode(trimmedValue);
      setPhone("");
      return;
    }

    setPhone(trimmedValue);
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
              {confirmation.quote.date} · {confirmation.quote.time}
            </strong>
            <span>Journey time</span>
          </p>
          <p>
            <strong>{confirmation.vehicle.passengers} passengers · {confirmation.vehicle.luggage} bags</strong>
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
                  ? "Select the right ride"
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
              <button type="button" className="location-button" onClick={useCurrentLocation}>
                <span aria-hidden="true">◎</span> Use my current location
              </button>
              <div className="route-line" aria-hidden="true" />
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
                  min={new Date().toLocaleDateString("en-CA")}
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
            <span aria-hidden="true">←</span> Back to journey details
          </button>
          <div className="vehicle-route-summary" aria-label="Journey summary">
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
                  {quote.quote.date} · {quote.quote.time}
                </small>
              </span>
            </div>
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
                  <circle cx="6" cy="17" r="2.2" />
                  <circle cx="18" cy="7" r="2.2" />
                  <path d="M8.2 17h3a4 4 0 0 0 4-4V11a4 4 0 0 1 4-4" />
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
            <span>{quote.quote.vehicles.length} options</span>
          </div>
          <div className="vehicle-options">
            {quote.quote.vehicles.map((option, index) => (
              <article className="vehicle-option" key={option.id}>
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
                    <span>Up to {option.luggage} bags</span>
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
                <div className="vehicle-option__action">
                  <strong>{money(option.fare)}</strong>
                  <small>Estimated fare · GBP</small>
                </div>
                <button
                  type="button"
                  className="button button--primary vehicle-option__choose"
                  onClick={() => {
                    setVehicle(option);
                    setPassengers(Math.min(option.passengers, 1));
                    setLuggage(0);
                    moveToStage(3);
                  }}
                >
                  Choose this vehicle <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
          <p className="vehicle-options__note">
            Your fare is estimated from the selected route and vehicle. No online payment is taken at this stage.
          </p>
        </>
      )}
      {stage === 3 && quote && vehicle && (
        <div className="booking-card__stage-layout booking-card__stage-layout--passenger">
          <button type="button" className="text-button booking-card__back" onClick={() => moveToStage(2)}>
            <span aria-hidden="true">←</span> Back to vehicle options
          </button>
          <div className="booking-card__journey-vehicle">
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
                <span><BookingFieldIcon name="date" />{quote.quote.date}</span>
                <span><BookingFieldIcon name="time" />{quote.quote.time}</span>
                <span><BookingFieldIcon name="route" />{quote.quote.distanceMiles.toFixed(1)} miles</span>
                <span><BookingFieldIcon name="duration" />{quote.quote.durationText}</span>
              </small>
            </div>
            <div className="booking-selected booking-selected--passenger">
              <div className="booking-selected__vehicle">
                <VehicleArtwork name={vehicle.name} passengers={vehicle.passengers} />
                <span>
                  <strong>{vehicle.name}</strong>
                  <small>Up to {vehicle.passengers} passengers · {vehicle.luggage} bags</small>
                </span>
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
              <div className="booking-selected__stage-fare">
                <strong>{money(vehicle.fare)}</strong>
                <small>Estimated fare</small>
              </div>
            </div>
          </div>
          <form
            id="passenger-booking-form"
            className="booking-flow booking-flow--passenger"
            noValidate
            onSubmit={handleReview}
          >
            <div className="booking-card__section-heading">
              <h3>Who’s travelling?</h3>
              <p>Choose your group size and add the lead passenger’s contact details.</p>
            </div>
            <div className="booking-card__details booking-card__details--three">
              <label className="field field--compact">
                <span className="field__label">Passengers</span>
                <IconFieldControl name="passengers">
                  <select
                    value={passengers}
                    onChange={(event) => {
                      setPassengers(Number(event.target.value));
                      clearFieldError("passengers");
                    }}
                    aria-invalid={Boolean(fieldErrors.passengers)}
                    aria-describedby={fieldErrors.passengers ? "passengers-error" : undefined}
                  >
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
                    value={luggage}
                    onChange={(event) => {
                      setLuggage(Number(event.target.value));
                      clearFieldError("luggage");
                    }}
                    aria-invalid={Boolean(fieldErrors.luggage)}
                    aria-describedby={fieldErrors.luggage ? "luggage-error" : undefined}
                  >
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
            <span aria-hidden="true">←</span> Back to passenger details
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
              <span><BookingFieldIcon name="date" />{quote.quote.date}</span>
              <span><BookingFieldIcon name="time" />{quote.quote.time}</span>
              <span><BookingFieldIcon name="route" />{quote.quote.distanceMiles.toFixed(1)} mi · {quote.quote.durationText}</span>
            </small>
          </div>
          <div className="booking-selected booking-selected--review">
            <VehicleArtwork name={vehicle.name} passengers={vehicle.passengers} />
            <span className="booking-selected__review-copy">
              <strong>{vehicle.name}</strong>
              <small>Up to {vehicle.passengers} passengers · {vehicle.luggage} bags</small>
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
                  {passengers} passengers · {luggage} bags
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
      <p className="booking-card__message" role="status" aria-live="polite">
        {message || mapMessage}
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
      <section className={`hero${bookingStage === 2 ? " hero--vehicles" : ""}`}>
        <div className="hero__copy" aria-hidden={bookingStage === 2}>
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
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 11 1.5-4h11L19 11" />
                  <path d="M4 11h16v7H4zM7 18v2m10-2v2M7 14h.01M17 14h.01" />
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
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v18m5-14.5C16.2 5.5 14.5 5 12 5c-2.8 0-4.5 1-4.5 3s1.7 3 4.5 3 4.5 1 4.5 3-1.7 3-4.5 3c-2.4 0-4.1-.6-5-1.5" />
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
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="5" width="16" height="16" rx="2" />
                  <path d="M8 3v4m8-4v4M4 10h16" />
                </svg>
              </span>
              <span>
                <strong>Clear and upfront fares</strong>
                <small>See estimated prices before you request your ride.</small>
              </span>
            </li>
          </ul>
        </div>
        <div className="hero__booking">
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
      <section id="our-service" className="service-strip">
        <div>
          <span className="service-strip__spark" aria-hidden="true">
            ✳
          </span>
          <p>
            Thoughtful travel,
            <br />
            <strong>from door to door.</strong>
          </p>
        </div>
        <span className="service-strip__note">Built around your journey</span>
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
