"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "./lib/supabase";

type BookingRow = {
  id: string;
  created_at?: string | null;
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

  [key: string]: unknown;
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
    "—";

  const dropoff =
    booking.dropoff ??
    booking.outbound_dropoff ??
    "—";

  const customerPhone =
    booking.booker_phone ??
    booking.customer_phone ??
    booking.passenger_phone ??
    "—";

  const notes =
    booking.notes ??
    booking.outbound_notes ??
    "None";

  return `My Way Cars

Passenger: ${passenger}
Date: ${date}
Time: ${time}

Pickup:
${pickup}

Dropoff:
${dropoff}

Customer Phone:
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

function pickString(row: BookingRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
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
  return localDateTimeToMs(getWhen(row));
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

export default function HomePage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const clashSectionRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Upcoming");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"compact" | "normal">("normal");
  const [nowMs, setNowMs] = useState(Date.now());
  const [reviewedClashKeys, setReviewedClashKeys] = useState<string[]>([]);
  const [selectedClashBookingIds, setSelectedClashBookingIds] = useState<
    string[]
  >([]);
  const [selectedReturnGroupId, setSelectedReturnGroupId] = useState<string | null>(null);

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

  async function loadBookings() {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }

  async function onRefresh() {
    try {
      setRefreshing(true);
      await loadBookings();
      await loadReviewedClashes();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadBookings();
    void loadReviewedClashes();

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
          void loadBookings();
          void loadReviewedClashes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const filteredBookings = useMemo(() => {
    const now = Date.now();
    const needle = searchTerm.trim().toLowerCase();

    const sorted = [...bookings].sort((a, b) => {
      const aTime = getWhenMs(a);
      const bTime = getWhenMs(b);

      const safeA = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
      const safeB = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;

      const aStatus = (a.status ?? "Scheduled").toString();

      if (aStatus === "Completed" || aStatus === "Cancelled") {
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

        if (status === "POB") {
          return true;
        }

        return (
          !Number.isNaN(when) &&
          when >= now - graceMs &&
          status !== "Cancelled" &&
          status !== "Completed"
        );
      });
    } else if (statusFilter === "Unpaid") {
      result = result.filter((row) => {
        const payment = (row.payment_status ?? "Unpaid").toString();
        const status = (row.status ?? "Scheduled").toString();
        return payment === "Unpaid" && status === "Completed";
      });
    } else if (statusFilter !== "All") {
      result = result.filter(
        (row) => (row.status ?? "Scheduled").toString() === statusFilter
      );
    }

    if (!needle) {
      return result;
    }

    return result.filter((row) => {
      const haystack = [
        getName(row),
        getPhone(row),
        getPickup(row),
        getDropoff(row),
        pickString(row, ["notes"]),
        pickString(row, ["via"]),
        pickString(row, ["local_authority"]),
        (row.status ?? "Scheduled").toString(),
        (row.payment_status ?? "Unpaid").toString(),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [bookings, statusFilter, searchTerm]);

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

    return bookings.filter(
      (b) => b.return_group_id === selectedReturnGroupId
    );
  }, [bookings, selectedReturnGroupId]);

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
            when >= now &&
            status !== "Cancelled" &&
            status !== "Completed" &&
            status !== "POB"
          );
        })
        .sort((a, b) => getWhenMs(a) - getWhenMs(b))[0] ?? null
    );
  }, [bookings]);

  async function updateBooking(id: string, patch: Record<string, unknown>) {
    try {
      setBusyId(id);
      setErrorMessage("");

      const supabase = getSupabase();
      const { error } = await supabase
        .from("bookings")
        .update(patch)
        .eq("id", id);

      if (error) throw error;

      setBookings((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update booking";
      setErrorMessage(message);
    } finally {
      setBusyId(null);
    }
  }

  async function markClashResolved(clashKey: string, bookingIds: string[]) {
    try {
      setErrorMessage("");
      const supabase = getSupabase();
      const sortedIds = [...bookingIds].sort();

      const { error } = await supabase.from("clash_reviews").upsert({
        clash_key: clashKey,
        booking_a_id: sortedIds[0],
        booking_b_id: sortedIds[1],
      });

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

  function toggleExpanded(id: string) {
    setExpandedIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function stopCardToggle(e: React.MouseEvent) {
    e.stopPropagation();
  }

function BookingCard({
  booking,
  forceExpanded = false,
  highlightClash = false,
  viewMode = "normal",
}: {
  booking: BookingRow;
  forceExpanded?: boolean;
  highlightClash?: boolean;
  viewMode?: "compact" | "normal";
}) {
    const driver = getDriver(booking);
    const vehicle = getVehicle(booking);
    const bookingType = getBookingType(booking);
    const when = getWhen(booking);
    const name = getName(booking);
    const phone = getPhone(booking);
    const pickup = getPickup(booking);
    const dropoff = getDropoff(booking);
    const fare = getFare(booking);
    const status = (booking.status ?? "Scheduled").toString();
    const paymentStatus = (booking.payment_status ?? "Unpaid").toString();
    const notes = pickString(booking, ["notes"]);
    const via = pickString(booking, ["via"]);
    const localAuthority = pickString(booking, ["local_authority"]);
    const passengers = pickNumber(booking, ["passengers"]);
    const bagsLarge = pickNumber(booking, ["bags_large"]);
    const bagsSmall = pickNumber(booking, ["bags_small"]);
    const distanceMiles = pickNumber(booking, ["distance_miles"]);
    const isBusy = busyId === booking.id;
 const expanded =
  forceExpanded || (!!expandedIds[booking.id] && viewMode !== "compact");

const compact = viewMode === "compact" && !forceExpanded;
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
          toggleExpanded(booking.id);

          const groupId = booking.return_group_id;
          if (groupId) {
            setSelectedReturnGroupId(groupId);
          }
        }}
      className={`relative cursor-pointer rounded-2xl border p-4 transition hover:shadow-md ...
          highlightClash
            ? "border-rose-500 bg-rose-50 shadow-md ring-2 ring-rose-300"
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
  <div className="flex items-center justify-between gap-3 text-sm">
    <div className="min-w-0 flex-1">
      <div className="truncate font-semibold text-slate-900">
        {name}
      </div>
      <div className="truncate text-slate-600">
        {fmtDateTime(when)} • {pickup || "—"} → {dropoff || "—"}
      </div>
    </div>

    <div className="shrink-0 text-right">
      <div className="font-medium">{status}</div>
      <div className="text-xs text-slate-500">
        {fare === null ? "—" : `£${fare.toFixed(2)}`}
      </div>
    </div>
  </div>
) : (
  <div className="mb-3 flex items-start justify-between gap-3">
    <div>
      {highlightClash ? (
        <div className="mb-2">
          <span className="rounded-full bg-rose-600 px-2 py-1 text-xs font-bold text-white">
            CLASH
          </span>
        </div>
      ) : null}

      <div className="text-lg font-semibold">{name}</div>
      {booking.return_group_id ? (
        <div className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
          Linked return booking
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
        {expanded && (
          <>
            <div className="space-y-1 text-sm text-slate-700">
              <div>
                <span className="font-medium">From:</span> {pickup || "—"}
              </div>
              <div>
                <span className="font-medium">To:</span> {dropoff || "—"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {phone || "—"}
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
                <span className="font-medium">Type:</span> {bookingType || "—"}
              </div>

              {(() => {
                const hasDriver = !!driver;
                const whenMs = getWhenMs(booking);
                const diff = whenMs - nowMs;

                if (hasDriver) {
                  return (
                    <div className="mt-2 rounded-xl border border-green-300 bg-green-50 p-2 text-sm font-semibold text-green-700">
                      Driver assigned
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
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">
                Compliance / Job details
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  {booking.status || "—"}
                </div>
                <div>
                  <span className="font-medium">Payment:</span>{" "}
                  {booking.payment_status || "—"}
                </div>

                <div>
                  <span className="font-medium">Driver:</span>{" "}
                  <span className="font-semibold text-blue-700">
                    {driver || "—"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Driver phone test:</span>{" "}
                  {String(booking.driver_phone || "NONE")}
                </div>
                <div>
                  <span className="font-medium">Vehicle:</span>{" "}
                  <span className="font-semibold text-purple-700">
                    {vehicle || "—"}
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

                <div>
                  <span className="font-medium">Via:</span> {via || "—"}
                </div>
                <div>
                  <span className="font-medium">Journey type:</span>{" "}
                  {(booking as any).journey_type || (booking as any).type || "—"}
                </div>

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
                  {localAuthority || "—"}
                </div>
                <div>
                  <span className="font-medium">Created:</span>{" "}
                  {booking.created_at ? fmtDateTime(booking.created_at) : "—"}
                </div>

                <div className="sm:col-span-2">
                  <span className="font-medium">Booking ID:</span> {booking.id}
                </div>

                <div className="sm:col-span-2">
                  <span className="font-medium">Notes:</span> {notes || "—"}
                </div>
              </div>
            </div>
          </>
        )}

       <div
  className="mt-4 sticky bottom-0 z-10 bg-white pt-3 pb-2 border-t flex flex-wrap gap-2"
  onClick={stopCardToggle}
>
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
Passenger Phone: ${phone || "—"}
When: ${fmtDateTime(when)}

From:
${pickup || "—"}

To:
${dropoff || "—"}

Estimated Price: ${fare === null ? "—" : `£${fare.toFixed(2)}`}

Notes:
${notes || "None"}`;

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
${pickup || "—"}

To:
${dropoff || "—"}

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
            Text customer
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

          {expanded && phone ? (
            <a
              href={smsHref(phone)}
              className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
            >
              Text
            </a>
          ) : null}

          {expanded && pickup ? (
            <a
              href={mapHref(pickup)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
            >
              Pickup map
            </a>
          ) : null}

          {expanded && dropoff ? (
            <a
              href={mapHref(dropoff)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
            >
              Dropoff map
            </a>
          ) : null}

          {expanded && status !== "Completed" ? (
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

          {expanded && status !== "Completed" ? (
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

          {expanded && status !== "Cancelled" ? (
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
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                My Way Cars
              </h1>
              <p className="text-sm text-slate-600">Booking dashboard</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/add"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add booking
              </Link>

              <button
                onClick={() => void onRefresh()}
                disabled={refreshing}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60 active:scale-95 active:shadow-inner transition"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
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
                £{dashboardStats.revenue.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <div className="text-amber-700">Unpaid</div>
              <div className="text-lg font-bold text-amber-800">
                £{dashboardStats.unpaid.toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        {linkedBookings.length > 0 && (
          <section className="rounded-3xl border border-indigo-300 bg-indigo-50 p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold text-indigo-900">
                Linked return journey
              </div>

              <button
                onClick={() => setSelectedReturnGroupId(null)}
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

        {nextJob ? (
          <section id="next-job">
            <div className="mb-3 text-xl font-bold text-slate-900">
              {(nextJob?.status ?? "Scheduled").toString() === "POB"
                ? "Current Job"
                : "Next Job"}
            </div>
<BookingCard
  booking={nextJob}
  forceExpanded
  viewMode={viewMode}
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
                    clashSectionRef.current?.scrollIntoView({
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

                    <div className="flex gap-2">
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
              <div className="mb-6">
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
              Unpaid total: £{unpaidTotal.toFixed(2)}
            </div>
          ) : null}

          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="mb-1 font-semibold text-slate-800">Today</div>
            <div className="flex gap-4 text-slate-700">
              <span>Jobs: {todayStats.jobs}</span>
              <span>Revenue: £{todayStats.revenue.toFixed(2)}</span>
              <span>Unpaid: £{todayStats.unpaid.toFixed(2)}</span>
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
                placeholder="Search by name, phone, pickup, dropoff or notes"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-300 bg-white py-3 pl-10 pr-4 text-base shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-500"
              />
            </div>
          </div>

<div className="sticky top-0 z-20 mb-4 flex flex-wrap gap-2 bg-white py-2">
  <button
    onClick={() =>
      setViewMode((current) =>
        current === "normal" ? "compact" : "normal"
      )
    }
    className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
  >
    {viewMode === "normal" ? "Compact view" : "Normal view"}
  </button>

  {["All", "Upcoming", "Scheduled", "Completed", "Unpaid", "Cancelled"].map(
    (value) => (
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
    )
  )}
</div>

          {errorMessage ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="text-sm text-slate-600">Loading bookings…</div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-sm text-slate-600">No bookings found.</div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
<BookingCard
  key={booking.id}
  booking={booking}
  viewMode={viewMode}
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