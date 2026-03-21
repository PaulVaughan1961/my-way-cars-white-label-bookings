"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function fmtDateTime(value: string): string {
  if (!value) return "No date set";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

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
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getCountdownLabel(value: string, nowMs: number): string {
  if (!value) return "No date set";

  const targetMs = new Date(value).getTime();
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

export default function HomePage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Upcoming");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [nowMs, setNowMs] = useState(Date.now());

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
  } finally {
    setRefreshing(false);
  }
}

  useEffect(() => {
    void loadBookings();


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
  const aTime = new Date(getWhen(a)).getTime();
  const bTime = new Date(getWhen(b)).getTime();

  const safeA = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
  const safeB = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;

  const aStatus = (a.status ?? "Scheduled").toString();
  const bStatus = (b.status ?? "Scheduled").toString();

  // Completed and Cancelled should show newest first
  if (aStatus === "Completed" || aStatus === "Cancelled") {
    return safeB - safeA;
  }

  // Scheduled / Upcoming show earliest first
  return safeA - safeB;
});

    let result = sorted;

    if (statusFilter === "Upcoming") {
      result = result.filter((row) => {
        const when = new Date(getWhen(row)).getTime();
        const status = (row.status ?? "Scheduled").toString();
        return (
          !Number.isNaN(when) &&
          when >= now &&
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

    if (!needle) return result;

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

  let jobs = 0;
  let revenue = 0;
  let unpaid = 0;

  bookings.forEach((row) => {
    const when = new Date(getWhen(row));
    const status = (row.status ?? "Scheduled").toString();
    const payment = (row.payment_status ?? "Unpaid").toString();
    const fare = getFare(row) ?? 0;

    if (!Number.isNaN(when.getTime()) && when >= today && status === "Completed") {
      jobs += 1;
      revenue += fare;

      if (payment === "Unpaid") {
        unpaid += fare;
      }
    }
  });

  return { jobs, revenue, unpaid };
}, [bookings]);

const dashboardStats = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let jobs = 0;
  let revenue = 0;
  let unpaid = 0;

  bookings.forEach((row) => {
    const when = new Date(getWhen(row));
    if (Number.isNaN(when.getTime()) || when < today) return;

    const status = (row.status ?? "Scheduled").toString();
    const payment = (row.payment_status ?? "Unpaid").toString();
    const fare = getFare(row) ?? 0;

    if (status === "Completed") {
      jobs += 1;
      revenue += fare;

      if (payment === "Unpaid") {
        unpaid += fare;
      }
    }
  });

  return { jobs, revenue, unpaid };
}, [bookings]);

const nextJob = useMemo(() => {
  const now = Date.now();

  const pobJob =
    [...bookings]
      .filter((row) => (row.status ?? "Scheduled").toString() === "POB")
      .sort(
        (a, b) => new Date(getWhen(a)).getTime() - new Date(getWhen(b)).getTime()
      )[0] ?? null;

  if (pobJob) return pobJob;

  return (
    [...bookings]
      .filter((row) => {
        const when = new Date(getWhen(row)).getTime();
        const status = (row.status ?? "Scheduled").toString();

        return (
          !Number.isNaN(when) &&
          when >= now &&
          status !== "Cancelled" &&
          status !== "Completed" &&
          status !== "POB"
        );
      })
      .sort(
        (a, b) => new Date(getWhen(a)).getTime() - new Date(getWhen(b)).getTime()
      )[0] ?? null
  );
}, [bookings]);

  async function updateBooking(id: string, patch: Record<string, unknown>) {
    try {
      setBusyId(id);
      setErrorMessage("");

      const supabase = getSupabase();
      const { error } = await supabase.from("bookings").update(patch).eq("id", id);

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

  async function onMarkCompleted(id: string) {
    await updateBooking(id, { status: "Completed" });
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
}: {
  booking: BookingRow;
  forceExpanded?: boolean;
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
  const expanded = forceExpanded || !!expandedIds[booking.id];
  const countdown = getCountdownLabel(when, nowMs);

    return (
      <div
        onClick={() => toggleExpanded(booking.id)}
className={`cursor-pointer rounded-2xl border p-4 transition hover:shadow-md ${
  status === "POB"
    ? "border-amber-300 bg-amber-50 shadow-md"
    : (() => {
        const whenMs = new Date(when).getTime();
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
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{name}</div>
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
    <span className="font-medium">Vehicle:</span> {vehicle || "Unassigned"}
  </div>
  <div>
    <span className="font-medium">Type:</span> {bookingType || "—"}
  </div>

  {(() => {
    const hasDriver = !!driver;
    const whenMs = new Date(when).getTime();
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

{expanded ? (
<div className="mt-4 border-t pt-4">
  <div className="mb-3 text-sm font-semibold text-slate-900">
    Compliance / Job details
  </div>

  <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
    <div>
      <span className="font-medium">Status:</span> {booking.status || "—"}
    </div>
    <div>
      <span className="font-medium">Payment:</span> {booking.payment_status || "—"}
    </div>

    <div>
 <span className="font-medium">Driver:</span>{" "}
<span className="font-semibold text-blue-700">
  {driver || "—"}
</span>
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
) : notes ? (
  <div className="mt-3 text-sm text-slate-700">
    <span className="font-medium">Notes:</span> {notes}
  </div>
) : null}

        <div
          className="mt-4 flex flex-wrap gap-2"
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

          {phone ? (
            <a
              href={smsHref(phone)}
              className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
            >
              Text
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



{status === "Scheduled" ? (
  <button
    onClick={() => void updateBooking(booking.id, { status: "POB" })}
    disabled={isBusy}
    className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
  >
    Mark POB
  </button>
) : null}

{status !== "Completed" ? (
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

{status !== "Completed" ? (
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

{status === "Completed" && paymentStatus !== "Paid" ? (
  <button
    onClick={() => void onMarkPaid(booking.id)}
    disabled={isBusy}
    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
  >
    Mark paid
  </button>
) : null}

          {status !== "Cancelled" ? (
            <button
              onClick={() => void onCancel(booking.id)}
              disabled={isBusy}
              className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Cancel
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
              <h1 className="text-2xl font-bold text-slate-900">My Way Cars</h1>
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
  <div className="mb-2 text-lg font-semibold text-slate-900">Dashboard</div>
  <div className="flex flex-wrap gap-3 text-sm">
    <div className="rounded-xl bg-slate-100 px-4 py-3">
      <div className="text-slate-500">Jobs today</div>
      <div className="text-lg font-bold text-slate-900">{dashboardStats.jobs}</div>
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

   
{nextJob ? (
  <section
id="next-job"
  >
    <div className="mb-3 text-xl font-bold text-slate-900">
      {(nextJob?.status ?? "Scheduled").toString() === "POB" ? "Current Job" : "Next Job"}
    </div>
    <BookingCard booking={nextJob} forceExpanded />
  </section>
) : (
  <section className="rounded-3xl bg-slate-50 border border-slate-200 p-5 shadow-sm">
    <div className="text-lg font-semibold text-slate-900">You’re clear</div>
    <p className="mt-1 text-sm text-slate-600">
      No upcoming scheduled jobs found.
    </p>
  </section>
)}

<section className="rounded-3xl bg-white p-5 shadow-sm">

  {unpaidTotal > 0 ? (
    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm font-medium text-amber-800">
      Unpaid total: £{unpaidTotal.toFixed(2)}
    </div>
  ) : null}

  <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm">
    <div className="font-semibold text-slate-800 mb-1">Today</div>
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
        className="w-full rounded-2xl border-2 border-slate-300 bg-white pl-10 pr-4 py-3 text-base shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-500"
      />
    </div>
  </div>

  <div className="mb-4 flex flex-wrap gap-2 sticky top-0 z-20 bg-white py-2">
   {["All", "Upcoming", "Scheduled", "Completed", "Unpaid", "Cancelled"].map((value) => (
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
    <div className="text-sm text-slate-600">Loading bookings…</div>
  ) : filteredBookings.length === 0 ? (
    <div className="text-sm text-slate-600">No bookings found.</div>
  ) : (
    <div className="space-y-4">
      {filteredBookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
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