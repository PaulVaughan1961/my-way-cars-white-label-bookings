"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getBookings,
  subscribe,
  updateBooking,
  type Booking,
  type BookingStatus,
  type PaymentStatus,
} from "./lib/store";

function bookingTimeValue(booking: Booking) {
  return new Date(booking.pickup_datetime).getTime();
}

function fmtDateTime(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;

  return dt.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCountdown(iso: string, nowMs: number) {
  const diff = new Date(iso).getTime() - nowMs;

  if (Number.isNaN(diff)) return "Time unavailable";

  if (diff <= 0) {
    const overdueMs = Math.abs(diff);
    const hours = Math.floor(overdueMs / 3600000);
    const minutes = Math.floor((overdueMs % 3600000) / 60000);
    return `Started ${hours > 0 ? `${hours}h ` : ""}${minutes}m ago`;
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `In ${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `In ${hours}h ${minutes}m`;
  return `In ${minutes}m`;
}

function telHref(phone?: string | null) {
  if (!phone) return "#";
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function smsHref(phone?: string | null) {
  if (!phone) return "#";
  return `sms:${phone.replace(/\s+/g, "")}`;
}

function mapHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function statusBadgeClass(status: BookingStatus) {
  switch (status) {
    case "Scheduled":
      return "bg-blue-100 text-blue-800";
    case "POB":
      return "bg-amber-100 text-amber-800";
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function paymentBadgeClass(payment: PaymentStatus) {
  switch (payment) {
    case "Paid":
      return "bg-green-100 text-green-800";
    case "Unpaid":
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

function BookingCard({
  booking,
  expanded,
  onToggle,
  onMarkPOB,
  onMarkCompleted,
  onMarkPaid,
  onCancel,
  nowMs,
  isNextJob = false,
}: {
  booking: Booking;
  expanded: boolean;
  onToggle: (id: string) => void;
  onMarkPOB: (id: string) => void;
  onMarkCompleted: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onCancel: (id: string) => void;
  nowMs: number;
  isNextJob?: boolean;
}) {
  return (
    <div
      onClick={() => onToggle(booking.id)}
      className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition ${
        isNextJob ? "border-slate-900" : "border-slate-200"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-slate-900">
            {booking.passenger_name}
          </div>
          <div className="text-sm text-slate-500">
            {fmtDateTime(booking.pickup_datetime)}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-700">
            {fmtCountdown(booking.pickup_datetime, nowMs)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(
              booking.status
            )}`}
          >
            {booking.status}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${paymentBadgeClass(
              booking.payment_status
            )}`}
          >
            {booking.payment_status}
          </span>
        </div>
      </div>

<div className="space-y-2 text-sm text-slate-700">
  <div>
    <span className="font-semibold">From:</span> {booking.pickup_address}
  </div>
  <div>
    <span className="font-semibold">To:</span> {booking.dropoff_address}
  </div>
  {booking.fare !== null && booking.fare !== undefined ? (
    <div>
      <span className="font-semibold">Fare:</span> £
      {Number(booking.fare).toFixed(2)}
    </div>
  ) : null}

{booking.notes && !expanded ? (
  <div className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 border border-amber-200">
    📝 Driver note
  </div>
) : null}
</div>

      {expanded ? (
        <>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {booking.passenger_phone ? (
              <div>
                <span className="font-semibold">Phone:</span> {booking.passenger_phone}
              </div>
            ) : null}

            {booking.distance_miles !== null && booking.distance_miles !== undefined ? (
              <div>
                <span className="font-semibold">Distance:</span> {booking.distance_miles} miles
              </div>
            ) : null}

          {booking.notes ? (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
             <span className="font-semibold">Driver note:</span> {booking.notes}
              </div>
               ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2" onClick={stopClick}>
            {booking.passenger_phone ? (
              <>
                <a
                  href={telHref(booking.passenger_phone)}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  Call
                </a>
                <a
                  href={smsHref(booking.passenger_phone)}
                  className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
                >
                  Text
                </a>
              </>
            ) : null}

            <a
              href={mapHref(booking.pickup_address)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
            >
              Navigate to pickup
            </a>

            <a
              href={mapHref(booking.dropoff_address)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
            >
              Navigate to dropoff
            </a>

          <Link
  href={`/edit/${booking.id}`}
  onClick={stopClick}
  className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
>
  Edit
</Link>

{booking.status === "Scheduled" ? (
  <button
    onClick={() => onMarkPOB(booking.id)}
    className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-medium text-white"
  >
    Mark POB
  </button>
) : null}

            {booking.status !== "Completed" && booking.status !== "Cancelled" ? (
              <button
                onClick={() => onMarkCompleted(booking.id)}
                className="rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white"
              >
                Mark completed
              </button>
            ) : null}

            {booking.payment_status !== "Paid" ? (
              <button
                onClick={() => onMarkPaid(booking.id)}
                className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white"
              >
                Mark paid
              </button>
            ) : null}

            {booking.status !== "Cancelled" && booking.status !== "Completed" ? (
              <button
                onClick={() => onCancel(booking.id)}
                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-3 text-xs text-slate-500">Tap card to open details</div>
      )}
    </div>
  );
}

export default function Page() {
  const bookings = useSyncExternalStore(subscribe, getBookings, getBookings);
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Scheduled" | "POB" | "Completed" | "Cancelled"
  >("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const sortedBookings = useMemo(() => {
    const safe = Array.isArray(bookings) ? bookings : [];
    return [...safe].sort((a, b) => bookingTimeValue(a) - bookingTimeValue(b));
  }, [bookings]);

  const nextJob = useMemo(() => {
    return sortedBookings.find((b) => {
      if (!(b.status === "Scheduled" || b.status === "POB")) return false;
      return bookingTimeValue(b) >= nowMs - 12 * 60 * 60 * 1000;
    });
  }, [sortedBookings, nowMs]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === "All") return sortedBookings;
    return sortedBookings.filter((b) => b.status === statusFilter);
  }, [sortedBookings, statusFilter]);

  const upcomingBookings = useMemo(() => {
    return filteredBookings.filter(
      (b) =>
        (b.status === "Scheduled" || b.status === "POB") &&
        (!nextJob || b.id !== nextJob.id)
    );
  }, [filteredBookings, nextJob]);

  const completedBookings = useMemo(() => {
    return filteredBookings.filter((b) => b.status === "Completed");
  }, [filteredBookings]);

  const cancelledBookings = useMemo(() => {
    return filteredBookings.filter((b) => b.status === "Cancelled");
  }, [filteredBookings]);

  async function handleMarkPOB(id: string) {
    await updateBooking(id, { status: "POB" });
  }

  async function handleMarkCompleted(id: string) {
    await updateBooking(id, { status: "Completed" });
  }

  async function handleMarkPaid(id: string) {
    await updateBooking(id, { payment_status: "Paid" });
  }

  async function handleCancel(id: string) {
    await updateBooking(id, { status: "Cancelled" });
  }

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Way Cars Dispatch</h1>
            <p className="mt-1 text-sm text-slate-600">Live bookings dashboard</p>
          </div>

          <Link
            href="/add"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            + New booking
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["All", "Scheduled", "POB", "Completed", "Cancelled"] as const).map(
            (filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  statusFilter === filter
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {filter}
              </button>
            )
          )}
        </div>

        {(statusFilter === "All" || statusFilter === "Scheduled" || statusFilter === "POB") && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Next job</h2>

            {nextJob ? (
              <BookingCard
                booking={nextJob}
                expanded={expandedId === nextJob.id}
                onToggle={toggleExpanded}
                onMarkPOB={handleMarkPOB}
                onMarkCompleted={handleMarkCompleted}
                onMarkPaid={handleMarkPaid}
                onCancel={handleCancel}
                nowMs={nowMs}
                isNextJob
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
                You&apos;re clear.
              </div>
            )}
          </section>
        )}

        {(statusFilter === "All" || statusFilter === "Scheduled" || statusFilter === "POB") && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Upcoming</h2>

            {upcomingBookings.length > 0 ? (
              <div className="grid gap-4">
                {upcomingBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    expanded={expandedId === booking.id}
                    onToggle={toggleExpanded}
                    onMarkPOB={handleMarkPOB}
                    onMarkCompleted={handleMarkCompleted}
                    onMarkPaid={handleMarkPaid}
                    onCancel={handleCancel}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
                No upcoming bookings.
              </div>
            )}
          </section>
        )}

        {(statusFilter === "All" || statusFilter === "Completed") && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Completed</h2>

            {completedBookings.length > 0 ? (
              <div className="grid gap-4">
                {completedBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    expanded={expandedId === booking.id}
                    onToggle={toggleExpanded}
                    onMarkPOB={handleMarkPOB}
                    onMarkCompleted={handleMarkCompleted}
                    onMarkPaid={handleMarkPaid}
                    onCancel={handleCancel}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
                No completed bookings.
              </div>
            )}
          </section>
        )}

        {(statusFilter === "All" || statusFilter === "Cancelled") && (
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-900">Cancelled</h2>

            {cancelledBookings.length > 0 ? (
              <div className="grid gap-4">
                {cancelledBookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    expanded={expandedId === booking.id}
                    onToggle={toggleExpanded}
                    onMarkPOB={handleMarkPOB}
                    onMarkCompleted={handleMarkCompleted}
                    onMarkPaid={handleMarkPaid}
                    onCancel={handleCancel}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
                No cancelled bookings.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}