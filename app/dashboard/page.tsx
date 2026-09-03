"use client";

import Link from "next/link";
import OperatorLogoutButton from "@/app/components/OperatorLogoutButton";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type BookingRow = {
  id: string;
  created_at?: string | null;
  account_name?: string | null;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  pickup_datetime?: string | null;
  distance_miles?: number | string | null;
  fare?: number | string | null;
  payment_status?: string | null;
  status?: string | null;
  notes?: string | null;
  passengers?: number | string | null;
  via?: string | null;
  bags_large?: number | string | null;
  bags_small?: number | string | null;
  local_authority?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  vehicle?: string | null;
  booking_type?: string | null;
  return_group_id?: string | null;
  return_flight_number?: string | null;
  driver_assignment_status?: string | null;
  driver_assigned_at?: string | null;
  driver_response_at?: string | null;
  driver_decline_reason?: string | null;

  lead_passenger?: string | null;
  customer_name?: string | null;
  name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  pickup?: string | null;
  from_address?: string | null;
  dropoff?: string | null;
  to_address?: string | null;
  quoted_fare?: number | string | null;
  amount?: number | string | null;
  pickup_at?: string | null;
  journey_at?: string | null;
  date_time?: string | null;
  journey_type?: string | null;
  type?: string | null;

  [key: string]: unknown;
};

type DriverOption = {
  id: string;
  name: string;
  driver_phone?: string | null;
  default_vehicle?: string | null;
  current_vehicle?: string | null;
  active?: boolean | null;
};

type ClashRow = {
  key: string;
  type: string;
  start: number;
  end: number;
  bookingIds: string[];
  count: number;
  sameDriver: boolean;
  unassigned: boolean;
  strong: boolean;
};

function buildDriverMessage(booking: any) {
  const passenger =
    booking.leadPassenger ??
    booking.lead_passenger ??
    booking.passenger_name ??
    "—";

  const date =
    booking.when ??
    booking.outbound_date ??
    booking.date ??
    "—";

  const time =
    booking.time ??
    booking.outbound_time ??
    "—";

  const pickup =
    booking.pickup ??
    booking.outbound_pickup ??
    booking.pickup_address ??
    "—";

  const dropoff =
    booking.dropoff ??
    booking.outbound_dropoff ??
    booking.dropoff_address ??
    "—";

  const customerPhone =
    booking.booker_phone ??
    booking.customer_phone ??
    booking.passenger_phone ??
    "—";

  const flightNumber = booking.return_flight_number ?? "";

  const notes = booking.notes ?? booking.outbound_notes ?? "None";

  return `My Way Cars

Passenger: ${passenger}
Date: ${date}
Time: ${time}

Pickup:
${pickup}

Dropoff:
${dropoff}

${flightNumber ? `Flight Number:
${flightNumber}

` : ""}Customer Phone:
${customerPhone}

Notes:
${notes}`;
}

function getDriverPhone(row: BookingRow): string {
  return pickString(row, ["driver_phone"]);
}

function getSmsLink(booking: any) {
  const phone = booking.driver_phone || "";
  const message = encodeURIComponent(buildDriverMessage(booking));
  return `sms:${phone}?body=${message}`;
}

function cleanDisplayText(value: unknown): string {
  if (typeof value !== "string") return "";

  let text = value.trim();

  if (!text) return "";

  text = text
    .replace(/ÔÇö|ÔÇò|ÔÇ£|ÔÇ¥|â€”|â€“|â€˜|â€™|â€œ|â€�|┬ú|�/g, "")
    .trim();

  if (
    !text ||
    text === "—" ||
    text === "–" ||
    text === "-" ||
    text.toLowerCase() === "null" ||
    text.toLowerCase() === "undefined" ||
    text.toLowerCase() === "n/a" ||
    text.toLowerCase() === "none"
  ) {
    return "";
  }

  return text;
}

function displayOrDash(value: unknown): string {
  const cleaned = cleanDisplayText(value);
  return cleaned || "—";
}

function pickString(row: BookingRow, keys: string[]): string {
  for (const key of keys) {
    const value = cleanDisplayText(row[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function pickNumber(row: BookingRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function getWhen(row: BookingRow): string {
  return pickString(row, [
    "pickup_datetime",
    "pickup_at",
    "journey_at",
    "date_time",
    "created_at",
  ]);
}

function getName(row: BookingRow): string {
  return (
    pickString(row, [
      "passenger_name",
      "lead_passenger",
      "customer_name",
      "name",
    ]) || "Unnamed booking"
  );
}

function getPhone(row: BookingRow): string {
  return pickString(row, ["passenger_phone", "phone", "mobile"]);
}

function getPickup(row: BookingRow): string {
  return pickString(row, ["pickup_address", "pickup", "from_address"]);
}

function getDropoff(row: BookingRow): string {
  return pickString(row, ["dropoff_address", "dropoff", "to_address"]);
}

function getFare(row: BookingRow): number | null {
  return pickNumber(row, ["fare", "quoted_fare", "amount"]);
}

function getDriver(row: BookingRow): string {
  return pickString(row, ["driver_name", "driver_allocated", "assigned_driver"]);
}

function getVehicle(row: BookingRow): string {
  return pickString(row, ["vehicle", "car_used", "assigned_vehicle"]);
}

function getBookingType(row: BookingRow): string {
  return pickString(row, ["booking_type", "journey_type"]);
}

function getJourneyType(row: BookingRow): string {
  return pickString(row, ["journey_type", "type", "booking_type"]);
}

function parseLocalDateTimeParts(value: string | null | undefined) {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
}

function localDateTimeToMs(value: string | null | undefined): number {
  const parts = parseLocalDateTimeParts(value);
  if (!parts) return Number.NaN;

  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  ).getTime();
}

function getWhenMs(row: BookingRow): number {
  const value = getWhen(row);

  if (!value) return Number.NaN;

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function fmtDateTime(value: string): string {
  if (!value) return "No date set";

  const parts = parseLocalDateTimeParts(value);
  if (!parts) return value;

  const d = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function smsHref(phone: string): string {
  return `sms:${phone.replace(/\s+/g, "")}`;
}

function mapHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;
}

function getCountdownLabel(value: string, nowMs: number): string {
  if (!value) return "No date set";

  const targetMs = localDateTimeToMs(value);
  if (Number.isNaN(targetMs)) return "Invalid date";

  const diff = targetMs - nowMs;

  if (diff <= 0) {
    return "Due now";
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function normalizeBookingType(
  rawType: string
): "Airport" | "Long Distance" | "Local" | "" {
  const value = rawType.trim().toLowerCase();

  if (!value) return "";
  if (value.includes("airport")) return "Airport";
  if (value.includes("long")) return "Long Distance";
  if (value.includes("local")) return "Local";

  return "";
}

function makeClashKey(a: string, b: string): string {
  return [a, b].sort().join("__");
}

function DashboardContent() {
  const [completedFlash, setCompletedFlash] = useState<BookingRow | null>(null);
  const searchParams = useSearchParams();
  const focusBookingId = searchParams.get("focus");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [allDrivers, setAllDrivers] = useState<DriverOption[]>([]);
  const [assignmentChoices, setAssignmentChoices] = useState<
    Record<string, string>
  >({});
  const clashSectionRef = useRef<HTMLDivElement | null>(null);
  const linkedSectionRef = useRef<HTMLDivElement | null>(null);
  const offendingBookingsRef = useRef<HTMLDivElement | null>(null);
  const editedBookingRef = useRef<HTMLDivElement | null>(null);
  const bookingFiltersRef = useRef<HTMLDivElement | null>(null);

  function scrollToRefWithOffset(
    ref: React.RefObject<HTMLDivElement | null>,
    offset = 120
  ) {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;

      const y = el.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top: y,
        behavior: "smooth",
      });
    });
  }

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Upcoming");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cardModes, setCardModes] = useState<
    Record<string, "compact" | "normal" | "full">
  >({});
  const [nowMs, setNowMs] = useState(0);
  const [reviewedClashKeys, setReviewedClashKeys] = useState<string[]>([]);
  const [selectedClashBookingIds, setSelectedClashBookingIds] = useState<
    string[]
  >([]);
  const [selectedReturnGroupId, setSelectedReturnGroupId] = useState<string | null>(null);
const [selectedBookings, setSelectedBookings] = useState<string[]>([]);

const [showPassengerNames, setShowPassengerNames] =
  useState(true);

  async function loadReviewedClashes() {
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("clash_reviews")
        .select("clash_key");

      if (error) throw error;

      setReviewedClashKeys(
        ((data ?? []) as { clash_key: string }[]).map((row) => row.clash_key)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load clash reviews";
      setErrorMessage(message);
    }
  }

  async function loadBookings(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      setErrorMessage("");

      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("pickup_datetime", { ascending: true });

      if (error) throw error;

      setBookings((data as BookingRow[]) ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load bookings";
      setErrorMessage(message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function loadDrivers() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id,name,driver_phone,default_vehicle,current_vehicle,active"
      )
      .order("name", { ascending: true });

    if (error) {
      setErrorMessage(`Could not load drivers: ${error.message}`);
      return;
    }

    const loadedDrivers = ((data as DriverOption[]) ?? []).filter((driver) =>
      driver.name?.trim()
    );

    setAllDrivers(loadedDrivers);
    setDrivers(
      loadedDrivers.filter((driver) => driver.active !== false)
    );
  }

  async function onRefresh() {
    try {
      setRefreshing(true);
      await loadBookings();
      await loadReviewedClashes();
      await loadDrivers();
    } finally {
      setRefreshing(false);
    }
  }

useEffect(() => {
  const savedFlash = window.sessionStorage.getItem("myWayCarsCompletedFlash");
  if (savedFlash) {
    try {
      setCompletedFlash(JSON.parse(savedFlash) as BookingRow);
    } catch {
      window.sessionStorage.removeItem("myWayCarsCompletedFlash");
    }
  }

  const saved = localStorage.getItem(
    "showPassengerNames"
  );

  if (saved !== null) {
    setShowPassengerNames(saved === "true");
  }
}, []);

useEffect(() => {
  if (!focusBookingId) return;
  if (loading) return;

  const timer = window.setTimeout(() => {
    scrollToRefWithOffset(editedBookingRef, 0);
  }, 150);

  return () => window.clearTimeout(timer);
}, [focusBookingId, loading, bookings.length]);

  useEffect(() => {
    void loadBookings();
    void loadReviewedClashes();
    void loadDrivers();

    const supabase = getSupabase();

    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        () => {
          void loadBookings(false);
          void loadReviewedClashes();
        }
      )
      .subscribe();

    // Supabase Realtime may be unavailable if replication is not enabled for
    // this table. Polling provides a reliable fallback for dispatch responses.
    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadBookings(false);
      }
    }, 5000);

    return () => {
      window.clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

const filteredBookings = useMemo(() => {
  const now = Date.now();
  const needle = searchTerm.trim().toLowerCase();
  const normalisedNeedle = needle.replace(/[^\dA-Za-z]/g, "");
  const matchingDriverNames = new Set<string>();
  const matchingDriverPhones = new Set<string>();

  if (needle) {
    allDrivers.forEach((driver) => {
      const driverName = driver.name.trim().toLowerCase();
      const driverPhone = (driver.driver_phone ?? "").replace(/\D/g, "");
      const matchesName = driverName.includes(needle);
      const matchesPhone =
        !!normalisedNeedle && driverPhone.includes(normalisedNeedle);

      if (matchesName || matchesPhone) {
        matchingDriverNames.add(driverName);
        if (driverPhone) matchingDriverPhones.add(driverPhone);
      }
    });
  }

  const sorted = [...bookings].sort((a, b) => {
    const aTime = getWhenMs(a);
    const bTime = getWhenMs(b);

    const safeA = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
    const safeB = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;

    const aStatus = (a.status ?? "Scheduled").toString();

    if (
      aStatus === "Completed" ||
      aStatus === "Cancelled" ||
      aStatus === "Rejected"
    ) {
      return safeB - safeA;
    }

    return safeA - safeB;
  });

  let result = sorted;

  if (statusFilter === "Upcoming") {
    result = result.filter((row) => {
      const when = getWhenMs(row);
      const status = (row.status ?? "Scheduled").toString();
      const graceMs = 30 * 60 * 1000;

      if (status === "POB") return true;

      return (
        !Number.isNaN(when) &&
        when >= now - graceMs &&
        status !== "Cancelled" &&
        status !== "Completed" &&
        status !== "Rejected"
      );
    });
  } else if (statusFilter === "Unpaid") {
    result = result.filter((row) => {
      const payment = (row.payment_status ?? "Unpaid").toString();
      const status = (row.status ?? "Scheduled").toString();

      return payment === "Unpaid" && status === "Completed";
    });
  } else if (statusFilter === "Needs Action") {
    result = result.filter((row) => {
      const when = getWhenMs(row);
      const status = (row.status ?? "Scheduled").toString();
      const assignment = (row.driver_assignment_status ?? "").toString();

      if (status === "Pending Approval") return true;
      if (assignment === "Declined") return true;
      if (assignment === "Awaiting response") return true;
      if (status === "Scheduled" && !getDriver(row)) return true;

      return (
        !Number.isNaN(when) &&
        when < now &&
        status !== "Completed" &&
        status !== "Cancelled" &&
        status !== "Rejected"
      );
    });
  } else if (statusFilter !== "All") {
    result = result.filter(
      (row) => (row.status ?? "Scheduled").toString() === statusFilter
    );
  }

  if (!needle) return result;

  return result.filter((row) => {
    const whenText = getWhen(row);
    const whenParts = parseLocalDateTimeParts(whenText);

    const ukDateText = whenParts
      ? new Date(
          whenParts.year,
          whenParts.month - 1,
          whenParts.day
        ).toLocaleDateString("en-GB")
      : "";

    const shortUkDateText = ukDateText.slice(0, 5);

    const haystack = [
      getName(row),
      getPhone(row),
      getPickup(row),
      getDropoff(row),
      getDriver(row),
      getVehicle(row),
      ukDateText,
      shortUkDateText,
      fmtDateTime(getWhen(row)),
      getWhen(row),
      pickString(row, ["notes"]),
      pickString(row, ["via"]),
      pickString(row, ["local_authority"]),
      pickString(row, [
        "account_name",
        "account",
        "customer_account",
        "business_name",
        "company_name",
      ]),
      pickString(row, ["return_flight_number"]),
      (row.status ?? "Scheduled").toString(),
      (row.payment_status ?? "Unpaid").toString(),
    ]
      .join(" ")
      .toLowerCase();

    const normalisedHaystack = haystack.replace(/[^\dA-Za-z]/g, "");
    const bookingDriverName = getDriver(row).trim().toLowerCase();
    const bookingDriverPhone = getDriverPhone(row).replace(/\D/g, "");
    const matchesDriverRecord =
      matchingDriverNames.has(bookingDriverName) ||
      (!!bookingDriverPhone && matchingDriverPhones.has(bookingDriverPhone));

    return (
      haystack.includes(needle) ||
      normalisedHaystack.includes(normalisedNeedle) ||
      matchesDriverRecord
    );
  });
}, [allDrivers, bookings, statusFilter, searchTerm]);

const matchedDriverSearch = useMemo(() => {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) return null;

  const normalisedNeedle = needle.replace(/\D/g, "");

  return (
    allDrivers.find((driver) => {
      const driverName = driver.name.trim().toLowerCase();
      const driverPhone = (driver.driver_phone ?? "").replace(/\D/g, "");

      return (
        driverName.includes(needle) ||
        (!!normalisedNeedle && driverPhone.includes(normalisedNeedle))
      );
    }) ?? null
  );
}, [allDrivers, searchTerm]);

const unpaidTotal = useMemo(() => {
  return bookings.reduce((sum, row) => {
      const payment = (row.payment_status ?? "Unpaid").toString();
      const status = (row.status ?? "Scheduled").toString();

      if (payment === "Unpaid" && status === "Completed") {
        const fare = getFare(row);
        return sum + (fare ?? 0);
      }

      return sum;
    }, 0);
  }, [bookings]);

  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let jobs = 0;
    let revenue = 0;
    let unpaid = 0;

    bookings.forEach((row) => {
      const whenMs = getWhenMs(row);
      const status = (row.status ?? "Scheduled").toString();
      const payment = (row.payment_status ?? "Unpaid").toString();
      const fare = getFare(row) ?? 0;

      if (
        !Number.isNaN(whenMs) &&
        whenMs >= today.getTime() &&
        whenMs < tomorrow.getTime() &&
        status !== "Cancelled"
      ) {
        jobs += 1;

        if (status === "Completed") {
          revenue += fare;

          if (payment === "Unpaid") {
            unpaid += fare;
          }
        }
      }
    });

    return { jobs, revenue, unpaid };
  }, [bookings]);

  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let jobs = 0;
    let revenue = 0;
    let unpaid = 0;

    bookings.forEach((row) => {
      const whenMs = getWhenMs(row);
      const status = (row.status ?? "Scheduled").toString();
      const payment = (row.payment_status ?? "Unpaid").toString();
      const fare = getFare(row) ?? 0;

      if (
        !Number.isNaN(whenMs) &&
        whenMs >= today.getTime() &&
        whenMs < tomorrow.getTime() &&
        status !== "Cancelled"
      ) {
        jobs += 1;

        if (status === "Completed") {
          revenue += fare;

          if (payment === "Unpaid") {
            unpaid += fare;
          }
        }
      }
    });

    return { jobs, revenue, unpaid };
  }, [bookings]);

  const detectedClashes = useMemo(() => {
    const relevant = bookings
      .map((row) => {
        const whenMs = getWhenMs(row);
        const type = normalizeBookingType(getBookingType(row));
        const driver = getDriver(row);
        const status = (row.status ?? "Scheduled").toString();

        return {
          id: row.id,
          whenMs,
          type,
          driver,
          status,
        };
      })
      .filter(
        (row) =>
          !Number.isNaN(row.whenMs) &&
          row.status !== "Cancelled" &&
          row.status !== "Completed"
      )
      .sort((a, b) => a.whenMs - b.whenMs);

    const clashes: ClashRow[] = [];
    const seen = new Set<string>();

    function getWindowMinutes(
      aType: "Airport" | "Long Distance" | "Local" | "",
      bType: "Airport" | "Long Distance" | "Local" | ""
    ) {
      const longWindowTypes = new Set(["Airport", "Long Distance"]);

      if (longWindowTypes.has(aType) || longWindowTypes.has(bType)) {
        return 120;
      }

      return 30;
    }

    for (let i = 0; i < relevant.length; i++) {
      for (let j = i + 1; j < relevant.length; j++) {
        const first = relevant[i];
        const second = relevant[j];

        const diffMinutes = Math.abs(second.whenMs - first.whenMs) / 60000;
        const windowMinutes = getWindowMinutes(first.type, second.type);

        if (diffMinutes > windowMinutes) {
          continue;
        }

        const bookingIds = [first.id, second.id].sort();
        const key = makeClashKey(bookingIds[0], bookingIds[1]);

        if (seen.has(key)) continue;
        seen.add(key);

        const firstDriver = first.driver.trim();
        const secondDriver = second.driver.trim();

        const sameDriver =
          !!firstDriver &&
          !!secondDriver &&
          firstDriver.toLowerCase() === secondDriver.toLowerCase();

        const unassigned = !firstDriver || !secondDriver;

        if (reviewedClashKeys.includes(key)) continue;

        const clashType =
          first.type === second.type
            ? first.type || "General"
            : `${first.type || "General"} / ${second.type || "General"}`;

        clashes.push({
          key,
          type: clashType,
          start: first.whenMs,
          end: second.whenMs,
          bookingIds,
          count: 2,
          sameDriver,
          unassigned,
          strong: sameDriver || unassigned,
        });
      }
    }

    return clashes;
  }, [bookings, reviewedClashKeys]);

  const linkedBookings = useMemo(() => {
    if (!selectedReturnGroupId) return [];

    return bookings
      .filter((b) => b.return_group_id === selectedReturnGroupId)
      .sort((a, b) => getWhenMs(a) - getWhenMs(b));
  }, [bookings, selectedReturnGroupId]);

  function openLinkedBookings(returnGroupId: string) {
    setSelectedReturnGroupId(returnGroupId);
    window.setTimeout(() => scrollToRefWithOffset(linkedSectionRef, 24), 0);
  }

  const clashSummaryText = useMemo(() => {
    if (detectedClashes.length === 0) return "";

    return detectedClashes
      .map((c) => {
        const label = c.strong ? "clash" : "cluster";
        let reason = "";

        if (c.sameDriver && c.unassigned) {
          reason = "same driver + unassigned";
        } else if (c.sameDriver) {
          reason = "same driver";
        } else if (c.unassigned) {
          reason = "unassigned driver";
        } else {
          reason = "jobs close together";
        }

        return `${c.type} ${label}${
          c.count > 2 ? ` (${c.count} jobs)` : ""
        } — ${reason}`;
      })
      .join(" • ");
  }, [detectedClashes]);

  const selectedRows = useMemo(
  () => bookings.filter((b) => selectedBookings.includes(b.id)),
  [bookings, selectedBookings]
);

const selectedTotal = useMemo(
  () =>
    selectedRows.reduce(
      (sum, row) => sum + (getFare(row) ?? 0),
      0
    ),
  [selectedRows]
);

  const nextJob = useMemo(() => {
    const now = Date.now();

    const pobJob =
      [...bookings]
        .filter((row) => (row.status ?? "Scheduled").toString() === "POB")
        .sort((a, b) => getWhenMs(a) - getWhenMs(b))[0] ?? null;

    if (pobJob) return pobJob;

  return (
  [...bookings]
    .filter((row) => {
      const when = getWhenMs(row);
      const status = (row.status ?? "Scheduled").toString();

      return (
        !Number.isNaN(when) &&
        status !== "Cancelled" &&
        status !== "Completed" &&
status !== "POB" &&
status !== "Rejected"
      );
    })
    .sort((a, b) => getWhenMs(a) - getWhenMs(b))[0] ?? null
);
  }, [bookings]);

  const dispatchAttentionCount = useMemo(
    () =>
      bookings.filter((booking) => {
        const status = (booking.status ?? "Scheduled").toString();
        const assignment = (
          booking.driver_assignment_status ?? ""
        ).toString();
        if (
          status === "Completed" ||
          status === "Cancelled" ||
          status === "Rejected"
        ) {
          return false;
        }
        return (
          assignment === "Declined" ||
          assignment === "Awaiting response" ||
          (status === "Scheduled" && !getDriver(booking))
        );
      }).length,
    [bookings]
  );

async function updateBooking(
  id: string,
  patch: Partial<BookingRow>
) {
  try {
    setBusyId(id);
    setErrorMessage("");

    const supabase = getSupabase();

    const { error } = await supabase
      .from("bookings")
  .update(patch as never)
      .eq("id", id);

    if (error) throw error;

    setBookings((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      )
    );

if (patch.status === "Completed") {
  const completedBooking =
    bookings.find((b) => b.id === id) ?? null;

  setCompletedFlash(completedBooking);
  if (completedBooking) {
    window.sessionStorage.setItem(
      "myWayCarsCompletedFlash",
      JSON.stringify(completedBooking)
    );
  }
}

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update booking";

    setErrorMessage(message);
  } finally {
    setBusyId(null);
  }
}

async function assignBookingToDriver(
  booking: BookingRow,
  driverId: string
) {
  const selectedDriver = drivers.find((driver) => driver.id === driverId);
  if (!selectedDriver) {
    window.alert("Select a driver first.");
    return;
  }

  const vehicle =
    selectedDriver.current_vehicle?.trim() ||
    selectedDriver.default_vehicle?.trim() ||
    "";
  const confirmed = window.confirm(
    `Assign this booking to ${selectedDriver.name}${
      vehicle ? ` in ${vehicle}` : ""
    }? The driver will need to accept it.`
  );
  if (!confirmed) return;

  try {
    setBusyId(booking.id);
    setErrorMessage("");
    const patch: Partial<BookingRow> = {
      driver_name: selectedDriver.name,
      driver_phone: selectedDriver.driver_phone?.trim() || null,
      vehicle: vehicle || null,
      driver_assignment_status: "Awaiting response",
      driver_assigned_at: new Date().toISOString(),
      driver_response_at: null,
      driver_decline_reason: null,
    };
    const supabase = getSupabase();
    const { error } = await supabase
      .from("bookings")
      .update(patch as never)
      .eq("id", booking.id);
    if (error) throw error;

    setBookings((current) =>
      current.map((row) =>
        row.id === booking.id ? { ...row, ...patch } : row
      )
    );
    window.alert(
      `Booking assigned to ${selectedDriver.name}. Awaiting driver response.`
    );
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "Could not assign the driver"
    );
  } finally {
    setBusyId(null);
  }
}

async function acceptBookingRequest(booking: BookingRow) {
  try {
    setBusyId(booking.id);
    setErrorMessage("");
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Your operator session has expired. Please sign in again.");
    }
    const response = await fetch("/api/booking-requests/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bookingId: booking.id }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      throw new Error(result.error || "Unable to accept booking request");
    }
    await loadBookings();
    window.alert(result.message || "Booking request accepted.");
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "Unable to accept booking request"
    );
  } finally {
    setBusyId(null);
  }
}

async function rejectBookingRequest(booking: BookingRow) {
  const defaultReason =
    "Unfortunately, we do not have availability for the requested journey.";
  const enteredReason = window.prompt(
    "Reason shown to the customer:",
    defaultReason
  );

  if (enteredReason === null) return;

  const reason = enteredReason.trim();
  if (!reason) {
    window.alert("Please enter a reason for rejecting the request.");
    return;
  }

  const confirmed = window.confirm(
    booking.return_group_id
      ? "Reject only this journey leg and notify the customer? The linked journey will keep its current status."
      : "Reject this booking request and notify the customer?"
  );

  if (!confirmed) return;

  try {
    setBusyId(booking.id);
    setErrorMessage("");

    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Your operator session has expired. Please sign in again.");
    }

    const response = await fetch("/api/booking-requests/reject", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bookingId: booking.id, reason }),
    });

    const result = (await response.json()) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Unable to reject booking request");
    }

    await loadBookings();
    window.alert(result.message || "Booking request rejected.");
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "Unable to reject booking request"
    );
  } finally {
    setBusyId(null);
  }
}

async function markClashResolved(
  clashKey: string,
  bookingIds: string[]
) {
  try {
    setErrorMessage("");

    const supabase = getSupabase();
    const sortedIds = [...bookingIds].sort();

 const { error } = await supabase
  .from("clash_reviews")
  .upsert({
    clash_key: clashKey,
    booking_a_id: sortedIds[0],
    booking_b_id: sortedIds[1],
  } as never);

if (error) throw error;

      setReviewedClashKeys((current) =>
        current.includes(clashKey) ? current : [...current, clashKey]
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resolve clash";
      setErrorMessage(message);
    }
  }

  async function onMarkPaid(id: string) {
    await updateBooking(id, { payment_status: "Paid" });
  }

  async function onCancel(id: string) {
    const ok = window.confirm("Cancel this booking?");
    if (!ok) return;
    await updateBooking(id, { status: "Cancelled" });
  }
function toggleBookingSelection(id: string) {
  setSelectedBookings((current) =>
    current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id]
  );
}

  function cycleCardMode(id: string) {
    setCardModes((current) => {
      const currentMode = current[id] ?? "compact";

      const nextMode =
        currentMode === "compact"
          ? "normal"
          : currentMode === "normal"
          ? "full"
          : "compact";

      return {
        ...current,
        [id]: nextMode,
      };
    });
  }

  function stopCardToggle(e: React.MouseEvent) {
    e.stopPropagation();
  }


  function BookingCard({
  
    
    booking,
    
    forceExpanded = false,
    highlightClash = false,
  }: {
    booking: BookingRow;
    forceExpanded?: boolean;
    highlightClash?: boolean;
  }) {
    const driver = cleanDisplayText(getDriver(booking));
    const vehicle = cleanDisplayText(getVehicle(booking));
    const bookingType = cleanDisplayText(getBookingType(booking));
    const journeyType = cleanDisplayText(getJourneyType(booking));
    const when = getWhen(booking);
    const name = getName(booking);
    const phone = getPhone(booking);
    const pickup = getPickup(booking);
    const dropoff = getDropoff(booking);
    const fare = getFare(booking);
    const status = (booking.status ?? "Scheduled").toString();
    const paymentStatus = (booking.payment_status ?? "Unpaid").toString();
    const driverAssignmentStatus = (
      booking.driver_assignment_status ?? ""
    ).toString();
    const selectedDriverId =
      assignmentChoices[booking.id] ??
      drivers.find((option) => option.name === driver)?.id ??
      "";
    const notes = cleanDisplayText(booking.notes);
    const via = cleanDisplayText(booking.via);
    const localAuthority = cleanDisplayText(booking.local_authority);
    const passengers = pickNumber(booking, ["passengers"]);
    const bagsLarge = pickNumber(booking, ["bags_large"]);
    const bagsSmall = pickNumber(booking, ["bags_small"]);
    const distanceMiles = pickNumber(booking, ["distance_miles"]);
    const isBusy = busyId === booking.id;
    const isSelected = selectedBookings.includes(booking.id);
    const cardMode = forceExpanded ? "full" : cardModes[booking.id] ?? "compact";
    const compact = cardMode === "compact";
    const expanded = cardMode === "full";
    const countdown = getCountdownLabel(when, nowMs);
    const driverPhone = getDriverPhone(booking);

    const linkedPair = booking.return_group_id
      ? bookings
          .filter((b) => b.return_group_id === booking.return_group_id)
          .sort((a, b) => getWhenMs(a) - getWhenMs(b))
      : [];

    const isOutboundLeg =
      linkedPair.length > 1 ? linkedPair[0]?.id === booking.id : false;

    return (
      <div
        onClick={() => {
          if (!forceExpanded) {
            cycleCardMode(booking.id);
          }
        }}
        className={`relative cursor-pointer rounded-2xl border p-4 transition hover:shadow-md ${
          highlightClash
            ? "border-rose-500 bg-rose-50 shadow-md ring-2 ring-rose-300"
            : status === "Pending Approval"
            ? "border-amber-500 bg-amber-50 shadow-lg ring-4 ring-amber-200"
            : driverAssignmentStatus === "Declined"
            ? "border-red-500 bg-red-50 shadow-lg ring-4 ring-red-200"
            : driverAssignmentStatus === "Awaiting response"
            ? "border-amber-400 bg-amber-50 shadow-md ring-2 ring-amber-200"
            : status === "POB"
            ? "border-amber-300 bg-amber-50 shadow-md"
            : (() => {
                const whenMs = getWhenMs(booking);
                const diff = whenMs - nowMs;

                if (diff <= 15 * 60 * 1000) {
                  return "border-red-300 bg-red-50 shadow-sm";
                }

                if (diff <= 60 * 60 * 1000) {
                  return "border-blue-300 bg-blue-50 shadow-sm";
                }

                return "bg-white shadow-sm";
              })()
        }`}
      >
  {compact ? (
  <div className="flex items-center justify-between gap-2 overflow-hidden text-sm text-slate-900">

    <div className="flex items-center gap-2 overflow-hidden">
      {status === "Pending Approval" ? (
        <span className="shrink-0 rounded-full bg-amber-500 px-2 py-1 text-xs font-black text-slate-950">
          NEW REQUEST
        </span>
      ) : null}
      {driverAssignmentStatus === "Declined" ? (
        <span className="shrink-0 rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white">
          DRIVER DECLINED
        </span>
      ) : driverAssignmentStatus === "Awaiting response" ? (
        <span className="shrink-0 rounded-full bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900">
          AWAITING DRIVER
        </span>
      ) : driverAssignmentStatus === "Accepted" ? (
        <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
          DRIVER ACCEPTED
        </span>
      ) : null}
      {booking.return_group_id ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openLinkedBookings(booking.return_group_id!);
          }}
          className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200"
          title="Open both linked journeys"
        >
          Linked
        </button>
      ) : null}

      <div className="truncate">
        {(() => {
          const parts = parseLocalDateTimeParts(when);

          if (!parts) {
            return `— | — | ${name} | ${displayOrDash(pickup)}`;
          }

          const d = new Date(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second
          );

          const dateText = d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
          });

          const timeText = d.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          return `${dateText} | ${timeText} | ${name} | ${displayOrDash(
            pickup
          )}`;
        })()}
      </div>
    </div>

    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleBookingSelection(booking.id);
      }}
      className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium ${
        isSelected
          ? "bg-green-600 text-white"
          : "bg-slate-200 text-slate-900"
      }`}
    >
      {isSelected ? "Added" : "Invoice"}
    </button>

  </div>
) : (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              {status === "Pending Approval" ? (
                <div className="mb-3 rounded-xl bg-amber-500 px-4 py-2 text-center text-sm font-black tracking-wide text-slate-950 shadow">
                  NEW BOOKING REQUEST — ACTION REQUIRED
                </div>
              ) : null}
              {highlightClash ? (
                <div className="mb-2">
                  <span className="rounded-full bg-rose-600 px-2 py-1 text-xs font-bold text-white">
                    CLASH
                  </span>
                </div>
              ) : null}

              <div className="text-lg font-semibold">{name}</div>

              {booking.account_name && (
                <div className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                  {booking.account_name}
                </div>
              )}

{booking.return_group_id ? (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      openLinkedBookings(booking.return_group_id!);
    }}
    className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-200"
    title="Open both linked journeys"
  >
    Linked return booking
  </button>
) : null}

{booking.return_flight_number ? (
  <div className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
    Flight: {booking.return_flight_number}
  </div>
) : null}

<div className="text-sm text-slate-600">{fmtDateTime(when)}</div>


              <div
                className={`mt-1 text-xs font-medium ${
                  countdown.includes("d")
                    ? "text-slate-500"
                    : countdown.includes("h")
                    ? "text-amber-600"
                    : countdown.includes("m")
                    ? "text-red-600"
                    : "text-red-700 font-bold"
                }`}
              >
                Countdown: {countdown}
              </div>
            </div>

            <div className="text-right text-sm">
              <div className="font-medium">{status}</div>
              <div className="text-slate-500">{paymentStatus}</div>
              <div className="mt-1 text-xs text-slate-400">
                {expanded ? "Tap to collapse" : "Tap to expand"}
              </div>
            </div>
          </div>
        )}

        {!compact && (
          <>
            <div className="space-y-1 text-sm text-slate-700">
              <div>
                <span className="font-medium">From:</span> {displayOrDash(pickup)}
              </div>
              <div>
                <span className="font-medium">To:</span> {displayOrDash(dropoff)}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {displayOrDash(phone)}
              </div>
              <div>
                <span className="font-medium">Fare:</span>{" "}
                {fare === null ? "—" : `£${fare.toFixed(2)}`}
              </div>
              <div>
                <span className="font-medium">Driver:</span>{" "}
                <span className="font-semibold text-blue-700">
                  {driver || "Unassigned"}
                </span>
              </div>
              <div>
                <span className="font-medium">Vehicle:</span>{" "}
                {vehicle || "Unassigned"}
              </div>
              <div>
                <span className="font-medium">Type:</span> {displayOrDash(bookingType)}
              </div>

              {(() => {
                const hasDriver = !!driver;
                const whenMs = getWhenMs(booking);
                const diff = whenMs - nowMs;

                if (driverAssignmentStatus === "Declined") {
                  return (
                    <div className="mt-2 rounded-xl border-2 border-red-500 bg-red-50 p-3 text-sm font-bold text-red-800">
                      DRIVER DECLINED — {driver || "assigned driver"}
                      {booking.driver_decline_reason ? (
                        <div className="mt-1 font-medium">
                          Reason: {booking.driver_decline_reason}
                        </div>
                      ) : null}
                      <div className="mt-1">Reassign this booking now.</div>
                    </div>
                  );
                }

                if (driverAssignmentStatus === "Awaiting response") {
                  return (
                    <div className="mt-2 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                      Awaiting response from {driver || "driver"}
                    </div>
                  );
                }

                if (
                  driverAssignmentStatus === "Accepted" ||
                  (hasDriver && !driverAssignmentStatus)
                ) {
                  return (
                    <div className="mt-2 rounded-xl border border-green-300 bg-green-50 p-2 text-sm font-semibold text-green-700">
                      Driver accepted
                    </div>
                  );
                }

                if (!Number.isNaN(whenMs) && diff <= 2 * 60 * 60 * 1000) {
                  return (
                    <div className="mt-2 rounded-xl border border-red-300 bg-red-50 p-2 text-sm font-semibold text-red-700 animate-pulse">
                      URGENT — driver not assigned
                    </div>
                  );
                }

                return (
                  <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-sm font-semibold text-amber-700">
                    Driver not yet assigned
                  </div>
                );
              })()}

              {status === "Scheduled" ? (
                <div
                  className="mt-3 rounded-xl border border-slate-300 bg-slate-50 p-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-2 text-sm font-bold text-slate-900">
                    {driver ? "Reassign driver" : "Assign driver"}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedDriverId}
                      onChange={(event) =>
                        setAssignmentChoices((current) => ({
                          ...current,
                          [booking.id]: event.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Choose an active driver</option>
                      {drivers.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                          {option.current_vehicle || option.default_vehicle
                            ? ` — ${option.current_vehicle || option.default_vehicle}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        void assignBookingToDriver(
                          booking,
                          selectedDriverId
                        )
                      }
                      disabled={isBusy || !selectedDriverId}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {isBusy ? "Assigning..." : "Send to driver"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {expanded && (
              <div className="mt-4 border-t pt-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">
                
                  Compliance / Job details
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    {displayOrDash(booking.status)}
                  </div>
                  <div>
                    <span className="font-medium">Payment:</span>{" "}
                    {displayOrDash(booking.payment_status)}
                  </div>

                  <div>
                    <span className="font-medium">Driver:</span>{" "}
                    <span className="font-semibold text-blue-700">
                      {displayOrDash(driver)}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium">Vehicle:</span>{" "}
                    <span className="font-semibold text-purple-700">
                      {displayOrDash(vehicle)}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium">Passengers:</span>{" "}
                    {passengers === null ? "—" : passengers}
                  </div>
                  <div>
                    <span className="font-medium">Distance:</span>{" "}
                    {distanceMiles === null ? "—" : `${distanceMiles} miles`}
                  </div>

                  {via ? (
                    <div>
                      <span className="font-medium">Via:</span> {via}
                    </div>
                  ) : null}

                  {journeyType ? (
                    <div>
                      <span className="font-medium">Journey type:</span>{" "}
                      {journeyType}
                    </div>
                  ) : null}

                  <div>
                    <span className="font-medium">Large bags:</span>{" "}
                    {bagsLarge === null ? "—" : bagsLarge}
                  </div>
                  <div>
                    <span className="font-medium">Small bags:</span>{" "}
                    {bagsSmall === null ? "—" : bagsSmall}
                  </div>

                  <div>
                    <span className="font-medium">Local authority:</span>{" "}
                    {displayOrDash(localAuthority)}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {booking.created_at ? fmtDateTime(booking.created_at) : "—"}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="font-medium">Booking ID:</span> {booking.id}
                  </div>

                  <div className="sm:col-span-2">
                    <span className="font-medium">Notes:</span> {displayOrDash(notes)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!compact && (
       <div
  className="mt-4 sticky bottom-0 z-10 border-t bg-white pt-3 pb-2 flex flex-wrap gap-2"
  onClick={stopCardToggle}
>
 <label
  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
  onClick={(e) => e.stopPropagation()}
>
  <input
    type="checkbox"
    checked={isSelected}
    onChange={() => toggleBookingSelection(booking.id)}
   onClick={(e) => e.stopPropagation()}
  />
	  Select for document
</label>

<Link
  href={`/edit/${booking.id}`}
  className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
>
  Edit
</Link>

{phone ? (
  <a
    href={telHref(phone)}
    className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
  >
                Call
              </a>
            ) : null}

            <button
              onClick={(e) => {
                e.stopPropagation();

                if (!driverPhone) return;

                const message = `MY WAY CARS

Passenger: ${name}
Passenger Phone: ${displayOrDash(phone)}
${booking.return_flight_number ? `Flight Number: ${booking.return_flight_number}
` : ""}
When: ${fmtDateTime(when)}

From:
${displayOrDash(pickup)}

To:
${displayOrDash(dropoff)}

Estimated Price: ${fare === null ? "—" : `£${fare.toFixed(2)}`}

Notes:
${cleanDisplayText(notes) || "None"}`;

                window.location.href = `sms:${driverPhone.replace(/\s+/g, "")}?body=${encodeURIComponent(message)}`;
              }}
              disabled={!driverPhone}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Text details to driver
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();

                if (!phone) return;

                const returnNote = isOutboundLeg
                  ? `

Please note: The driver for your return journey may be different. Full return details will be confirmed separately.`
                  : "";

                const customerMessage = `MY WAY CARS

Your booking is confirmed.

When:
${fmtDateTime(when)}

From:
${displayOrDash(pickup)}

To:
${displayOrDash(dropoff)}

Driver:
${driver || "To be confirmed"}

Driver Contact:
${driverPhone || "Will be provided prior to pickup"}

Vehicle:
${vehicle || "To be confirmed"}${returnNote}`;

                window.location.href = `sms:${phone.replace(/\s+/g, "")}?body=${encodeURIComponent(customerMessage)}`;
              }}
              disabled={!phone}
              className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Text customer job details
            </button>

            {status === "Scheduled" ? (
              <button
                onClick={() => void updateBooking(booking.id, { status: "POB" })}
                disabled={isBusy}
                className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Mark POB
              </button>
            ) : null}

            {phone ? (
              <a
                href={smsHref(phone)}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              >
                Send Text to Customer
              </a>
            ) : null}

            {pickup ? (
              <a
                href={mapHref(pickup)}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              >
                Pickup map
              </a>
            ) : null}

            {dropoff ? (
              <a
                href={mapHref(dropoff)}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              >
                Dropoff map
              </a>
            ) : null}
{status === "Pending Approval" ? (
  <div className="mb-3 rounded-2xl border-2 border-amber-500 bg-amber-100 p-3 shadow-md">
    <div className="mb-2 text-center text-xs font-black uppercase tracking-wide text-amber-950">
      Accept or reject this request
    </div>
    <div className="flex gap-2">
    <button
      onClick={() => void acceptBookingRequest(booking)}
      disabled={isBusy}
      className="flex-1 rounded-xl bg-green-700 px-4 py-3 text-base font-bold text-white shadow disabled:opacity-60"
    >
      {isBusy ? "Working..." : "ACCEPT REQUEST"}
    </button>

    <button
      onClick={() => void rejectBookingRequest(booking)}
      disabled={isBusy}
      className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-base font-bold text-white shadow disabled:opacity-60"
    >
      {isBusy ? "Working..." : "REJECT REQUEST"}
    </button>
    </div>
  </div>
) : null}
            {status !== "Completed" && status !== "Rejected" ? (
              <button
                onClick={() =>
                  void updateBooking(booking.id, {
                    status: "Completed",
                    payment_status: "Unpaid",
                  })
                }
                disabled={isBusy}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
        
                Complete (Unpaid)
              </button>
            ) : null}

            {status !== "Completed" && status !== "Rejected" ? (
              <button
                onClick={() =>
                  void updateBooking(booking.id, {
                    status: "Completed",
                    payment_status: "Paid",
                  })
                }
                disabled={isBusy}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Complete & Paid
              </button>
            ) : null}

            {expanded && status === "Completed" && paymentStatus !== "Paid" ? (
              <button
                onClick={() => void onMarkPaid(booking.id)}
                disabled={isBusy}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Mark paid
              </button>
            ) : null}

            {status !== "Cancelled" &&
            status !== "Rejected" &&
            status !== "Completed" ? (
              <button
                onClick={() => void onCancel(booking.id)}
                disabled={isBusy}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Cancel
              </button>
            ) : expanded ? (
              <button
                onClick={() =>
                  void updateBooking(booking.id, { status: "Scheduled" })
                }
                disabled={isBusy}
                className="rounded-xl bg-slate-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Restore booking
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      {completedFlash ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="completed-job-title"
        >
          <div className="w-full max-w-lg rounded-3xl border-4 border-green-500 bg-green-50 p-8 text-center shadow-2xl">
            <div
              id="completed-job-title"
              className="text-3xl font-bold text-green-700"
            >
              ✓ JOB COMPLETED
            </div>
            <div className="mt-4 text-xl font-semibold">
              {completedFlash.passenger_name}
            </div>
            <div className="mt-2 text-sm text-slate-700">
              {completedFlash.pickup_address}
            </div>
            <div className="text-sm text-slate-700">
              {completedFlash.dropoff_address}
            </div>
            <button
              autoFocus
              onClick={() => {
                window.sessionStorage.removeItem("myWayCarsCompletedFlash");
                setCompletedFlash(null);
              }}
              className="mt-6 rounded-xl bg-green-700 px-8 py-3 text-lg font-bold text-white shadow"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-5xl space-y-6">
        {dispatchAttentionCount > 0 ? (
          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("Needs Action");
              scrollToRefWithOffset(bookingFiltersRef, 24);
            }}
            className="w-full rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-left font-bold text-red-800 shadow"
          >
            DRIVER ACTION REQUIRED — {dispatchAttentionCount} booking
            {dispatchAttentionCount === 1 ? "" : "s"} need assignment or a
            driver response. Tap to review.
          </button>
        ) : null}
        {selectedBookings.length > 0 && (
  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
    <div className="font-semibold text-slate-900">
      {selectedBookings.length} booking
      {selectedBookings.length !== 1 ? "s" : ""} selected
    </div>

    <div className="text-sm text-slate-600">
      Total value: £{selectedTotal.toFixed(2)}
    </div>

    <div className="mt-3 flex flex-wrap gap-2">



<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={showPassengerNames}
    onChange={(e) => {
      setShowPassengerNames(e.target.checked);

      localStorage.setItem(
        "showPassengerNames",
        String(e.target.checked)
      );
    }}
  />
  Show Passenger Names
</label>

<button
  onClick={() => {
    const ids = selectedBookings.join(",");

    window.location.href =
      `/receipt-multi?ids=${ids}` +
      `&type=invoice` +
      `&showPassengers=${showPassengerNames}`;
  }}
  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
>
  Generate Invoice
</button>

<button
  onClick={() => {
    const ids = selectedBookings.join(",");
    window.location.href = `/receipt-multi?ids=${ids}&type=receipt`;
  }}
  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white"
>
  Generate Receipt
</button>

<button
  onClick={() => {
    const ids = selectedBookings.join(",");
    window.location.href =
      `/receipt-multi?ids=${ids}` +
      `&type=summary&showPassengers=true`;
  }}
  className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-medium text-white"
>
  Booking Summary / PDF
</button>

      <button
        onClick={() => setSelectedBookings([])}
        className="rounded-xl bg-slate-500 px-4 py-2 text-sm font-medium text-white"
      >
        Clear
      </button>
    </div>
  </div>
)}
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
<div>
  <h1 className="text-2xl font-bold text-slate-900">
    My Way Cars
  </h1>

  <p className="text-sm text-slate-600">
    Booking dashboard
  </p>

  <div className="mt-2 text-sm font-medium text-slate-700">
    {nowMs ? new Date(nowMs).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }) : ""}
  </div>

  <div className="text-lg font-bold text-slate-900">
    {nowMs ? new Date(nowMs).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }) : ""}
  </div>
</div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/add"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                
              >
                Add booking
              </Link>
<Link
  href="/calendar"
  className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
>
  Calendar view
</Link>
              <Link
                href="/customers"
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
              >
                Customers
              </Link>
              <Link
                href="/business-setup"
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
              >
                Business setup
              </Link>

              <button
                onClick={() => void onRefresh()}
                disabled={refreshing}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60 active:scale-95 active:shadow-inner transition"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <OperatorLogoutButton />
            </div>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-2 text-lg font-semibold text-slate-900">
            Dashboard
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <div className="text-slate-500">Jobs today</div>
              <div className="text-lg font-bold text-slate-900">
                {dashboardStats.jobs}
              </div>
            </div>

            <div className="rounded-xl bg-slate-100 px-4 py-3">
              <div className="text-slate-500">Revenue</div>
              <div className="text-lg font-bold text-slate-900">
                {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                }).format(dashboardStats.revenue)}
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <div className="text-amber-700">Unpaid</div>
              <div className="text-lg font-bold text-amber-800">
                {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                }).format(dashboardStats.unpaid)}
              </div>
            </div>
          </div>
        </section>

        {linkedBookings.length > 0 && (
          <section
            ref={linkedSectionRef}
            className="rounded-3xl border border-indigo-300 bg-indigo-50 p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold text-indigo-900">
                Linked return journey
              </div>

              <button
                onClick={() => {
                  setCardModes((current) => {
                    const next = { ...current };

                    linkedBookings.forEach((booking) => {
                      next[booking.id] = "compact";
                    });

                    return next;
                  });

                  setSelectedReturnGroupId(null);
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
              >
                Clear
              </button>
            </div>

            <div className="space-y-4">
              {linkedBookings.map((booking) => (
                <BookingCard
                  key={`linked-${booking.id}`}
                  booking={booking}
                  forceExpanded
                />
              ))}
            </div>
          </section>
        )}

        {focusBookingId ? (
        <section id="focused-booking" ref={editedBookingRef}>
<div className="mb-3 flex items-center justify-between gap-3">
  <div className="text-xl font-bold text-slate-900">
    Edited Booking
  </div>

  <Link
    href="/dashboard"
    className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
  >
    Clear
  </Link>
</div>

            {bookings.find((booking) => booking.id === focusBookingId) ? (
              <BookingCard
                booking={bookings.find((booking) => booking.id === focusBookingId)!}
                forceExpanded
              />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="text-sm text-slate-600">
                  Edited booking not found.
                </div>
              </div>
            )}
          </section>
        ) : nextJob ? (
          <section id="next-job">
            <div className="mb-3 text-xl font-bold text-slate-900">
              {(nextJob?.status ?? "Scheduled").toString() === "POB"
                ? "Current Job"
                : "Next Job"}
            </div>

            <BookingCard
              booking={nextJob}
              forceExpanded
              highlightClash={selectedClashBookingIds.includes(nextJob.id)}
            />
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">
              You’re clear
            </div>
            <p className="mt-1 text-sm text-slate-600">
              No upcoming scheduled jobs found.
            </p>
          </section>
        )}

        <section ref={clashSectionRef} className="rounded-3xl bg-white p-5 shadow-sm">
          {detectedClashes.length > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <div>
                ⚠ {detectedClashes.length} scheduling issue
                {detectedClashes.length > 1 ? "s" : ""}: {clashSummaryText}
              </div>

              <button
                onClick={() => {
                  const clashIds = detectedClashes.flatMap((c) => c.bookingIds);
                  setSearchTerm("");
                  setStatusFilter("All");
                  setSelectedClashBookingIds([...new Set(clashIds)]);

                  requestAnimationFrame(() => {
                    linkedSectionRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  });
                }}
                className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                View
              </button>
            </div>
          )}

          {selectedClashBookingIds.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => {
                  setSelectedClashBookingIds([]);
                }}
                className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
              >
                ← Back to all bookings
              </button>
            </div>
          )}

          {selectedClashBookingIds.length > 0 && detectedClashes.length > 0 && (
            <div className="mb-4 space-y-3">
              {detectedClashes
                .filter((c) =>
                  c.bookingIds.some((id) => selectedClashBookingIds.includes(id))
                )
                .map((clash) => (
                  <div
                    key={clash.key}
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                  >
                    <div className="mb-2 font-medium">
                      {clash.type} clash{" "}
                      {clash.sameDriver
                        ? "— same driver"
                        : clash.unassigned
                        ? "— unassigned driver"
                        : "— jobs close together"}
                    </div>

                    <div className="mb-3 space-y-2">
                      {clash.bookingIds.map((id, index) => {
                        const booking = bookings.find((b) => b.id === id);
                        if (!booking) return null;

                        return (
                          <div
                            key={id}
                            className="rounded-lg border border-amber-200 bg-white/70 p-2"
                          >
                            <div className="font-semibold">
                              {index + 1}) {getName(booking)}
                            </div>
                            <div>{fmtDateTime(getWhen(booking))}</div>
                            <div>From: {getPickup(booking) || "—"}</div>
                            <div>To: {getDropoff(booking) || "—"}</div>
                            <div>Driver: {getDriver(booking) || "Unassigned"}</div>
                            <div className="text-xs text-slate-500">
                              ID: {booking.id.slice(0, 8)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setStatusFilter("All");
                          setSearchTerm("");
                          setSelectedClashBookingIds(clash.bookingIds);
                          scrollToRefWithOffset(offendingBookingsRef, 515);
                        }}
                        className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Show this clash group
                      </button>

                      <button
                        onClick={async () => {
                          await markClashResolved(clash.key, clash.bookingIds);

                          const remainingIds = detectedClashes
                            .filter((c) => c.key !== clash.key)
                            .flatMap((c) => c.bookingIds);

                          setSelectedClashBookingIds([...new Set(remainingIds)]);
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        ✔ Mark resolved
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {selectedClashBookingIds.length > 0 &&
            bookings.some(
              (booking) =>
                selectedClashBookingIds.includes(booking.id) &&
                (booking.status ?? "Scheduled").toString() !== "Cancelled" &&
                (booking.status ?? "Scheduled").toString() !== "Completed"
            ) && (
              <div ref={offendingBookingsRef} className="mb-6">
                <div className="mb-3 text-base font-semibold text-slate-900">
                  Offending bookings
                </div>

                <div className="space-y-4">
                  {bookings
                    .filter(
                      (booking) =>
                        selectedClashBookingIds.includes(booking.id) &&
                        (booking.status ?? "Scheduled").toString() !== "Cancelled" &&
                        (booking.status ?? "Scheduled").toString() !== "Completed"
                    )
                    .sort((a, b) => getWhenMs(a) - getWhenMs(b))
                    .map((booking) => (
                      <BookingCard
                        key={`clash-top-${booking.id}`}
                        booking={booking}
                        highlightClash
                      />
                    ))}
                </div>
              </div>
            )}

          {unpaidTotal > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
              Unpaid total:{" "}
              {new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(unpaidTotal)}
            </div>
          ) : null}

          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="mb-1 font-semibold text-slate-800">Today</div>
            <div className="flex gap-4 text-slate-700">
              <span>Jobs: {todayStats.jobs}</span>
              <span>
                Revenue:{" "}
                {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                }).format(todayStats.revenue)}
              </span>
              <span>
                Unpaid:{" "}
                {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                }).format(todayStats.unpaid)}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Search bookings
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>

              <input
                type="text"
                list="booking-driver-suggestions"
                placeholder="Search by passenger, driver, phone, address or notes"
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);

                  if (value.trim()) setStatusFilter("All");
                }}
                className="w-full rounded-2xl border-2 border-slate-300 bg-white py-3 pl-10 pr-4 text-base shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-500"
              />
              <datalist id="booking-driver-suggestions">
                {allDrivers.map((driver) => (
                  <option key={driver.id} value={driver.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div
            ref={bookingFiltersRef}
            className="sticky top-0 z-20 mb-4 flex flex-wrap gap-2 bg-white py-2"
          >
            {[
              "All",
              "Upcoming",
              "Needs Action",
              "Scheduled",
              "Completed",
              "Unpaid",
              "Cancelled",
            ].map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  statusFilter === value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-200 text-slate-900"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          {errorMessage ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}


          {loading ? (
            <div className="text-sm text-slate-600">Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-sm text-slate-600">
              {matchedDriverSearch
                ? `No booking cards are assigned to ${matchedDriverSearch.name}. Older jobs can only be found where that driver's name or phone number was saved on the booking.`
                : "No bookings found."}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  highlightClash={selectedClashBookingIds.includes(booking.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Link
        href="/add"
        className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 sm:hidden"
      >
        + Add booking
      </Link>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-4">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
