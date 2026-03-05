"use client";

import { useMemo, useState } from "react";

type BookingStatus = "Scheduled" | "POB" | "Completed" | "Cancelled" | "No Show";
type PaymentStatus =
  | "Unpaid"
  | "Paid cash"
  | "Paid card"
  | "Invoice"
  | "Account"
  | "Part-paid";

type Booking = {
  id: string;
  pickupDateTimeISO: string;
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  via?: string[];
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  estFareGBP?: number;
  notes?: string;
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapsTrip(pickup: string, dropoff: string, via?: string[]) {
  const base = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    pickup
  )}&destination=${encodeURIComponent(dropoff)}`;
  if (via && via.length) {
    return `${base}&waypoints=${encodeURIComponent(via.join("|"))}`;
  }
  return base;
}

function pill(active: boolean) {
  return [
    "rounded-full px-3 py-1 text-xs font-medium border",
    active
      ? "bg-gray-900 text-white border-gray-900"
      : "bg-white text-gray-700 border-gray-200",
  ].join(" ");
}

function BookingCard({
  title,
  booking,
  onSetStatus,
  onSetPayment,
}: {
  title?: string;
  booking: Booking;
  onSetStatus: (s: BookingStatus) => void;
  onSetPayment: (p: PaymentStatus) => void;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {title ?? booking.passengerName}
        </h2>
        <span className="text-xs text-gray-500">{booking.id}</span>
      </div>

      <div className="text-sm text-gray-700">
        <div className="font-medium">{booking.passengerName}</div>
        <div className="text-gray-500">{fmt(booking.pickupDateTimeISO)}</div>

        <div className="mt-2">
          <div className="text-xs text-gray-500">Pickup</div>
          <div>{booking.pickupAddress}</div>
        </div>

        <div className="mt-2">
          <div className="text-xs text-gray-500">Dropoff</div>
          <div>{booking.dropoffAddress}</div>
        </div>

        {booking.via?.length ? (
          <div className="mt-2">
            <div className="text-xs text-gray-500">Via</div>
            <div>{booking.via.join(" • ")}</div>
          </div>
        ) : null}

        {booking.notes ? (
          <div className="mt-3 text-xs text-gray-600">
            <span className="font-semibold">Notes:</span> {booking.notes}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
            Status: {booking.status}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
            Payment: {booking.paymentStatus}
          </span>
          {typeof booking.estFareGBP === "number" ? (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
              Est: £{booking.estFareGBP.toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Call/Text/Navigate */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <a
          className="rounded-xl bg-gray-900 text-white text-sm py-2 text-center"
          href={`tel:${booking.passengerPhone}`}
        >
          Call
        </a>
        <a
          className="rounded-xl bg-gray-900 text-white text-sm py-2 text-center"
          href={`sms:${booking.passengerPhone}?body=${encodeURIComponent(
            `Hi ${booking.passengerName}, this is your driver. I'm on my way.`
          )}`}
        >
          Text
        </a>
        <a
          className="rounded-xl bg-gray-900 text-white text-sm py-2 text-center"
          href={mapsTrip(booking.pickupAddress, booking.dropoffAddress, booking.via)}
          target="_blank"
          rel="noreferrer"
        >
          Navigate
        </a>
      </div>

      {/* Status */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        {(["Scheduled", "POB", "Completed", "Cancelled", "No Show"] as const).map(
          (s) => (
            <button
              key={s}
              className={pill(booking.status === s)}
              onClick={() => onSetStatus(s)}
            >
              {s === "No Show" ? "NoShow" : s}
            </button>
          )
        )}
      </div>

      {/* Payment */}
      <div className="mt-3">
        <label className="text-xs text-gray-500">Payment status</label>
        <select
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          value={booking.paymentStatus}
          onChange={(e) => onSetPayment(e.target.value as PaymentStatus)}
        >
          {(
            [
              "Unpaid",
              "Paid cash",
              "Paid card",
              "Invoice",
              "Account",
              "Part-paid",
            ] as const
          ).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function Page() {
  const [all, setAll] = useState<Booking[]>([
    {
      id: "MWC-0001",
      pickupDateTimeISO: "2026-03-16T12:30:00.000Z",
      passengerName: "Paul Vaughan",
      passengerPhone: "07792042081",
      pickupAddress: "274A East Grafton, SN8 3DB",
      dropoffAddress: "Ocean Terminal, Southampton Docks",
      via: ["M3 Services (quick stop)"],
      status: "Scheduled",
      paymentStatus: "Unpaid",
      estFareGBP: 160,
      notes: "Large bags",
    },
    {
      id: "MWC-0002",
      pickupDateTimeISO: "2026-03-10T08:15:00.000Z",
      passengerName: "Bridget",
      passengerPhone: "07123456789",
      pickupAddress: "Hungerford, Berkshire",
      dropoffAddress: "Heathrow Terminal 5",
      status: "Scheduled",
      paymentStatus: "Invoice",
      estFareGBP: 120,
    },
    {
      id: "MWC-0003",
      pickupDateTimeISO: "2026-03-06T18:40:00.000Z",
      passengerName: "Ellie",
      passengerPhone: "07000000000",
      pickupAddress: "Newbury Station",
      dropoffAddress: "Hungerford High Street",
      status: "Completed",
      paymentStatus: "Paid card",
      estFareGBP: 28,
    },
  ]);

  const [statusFilter, setStatusFilter] = useState<"All" | BookingStatus>("All");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    return [...all].sort(
      (a, b) =>
        new Date(a.pickupDateTimeISO).getTime() -
        new Date(b.pickupDateTimeISO).getTime()
    );
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((b) => {
      if (statusFilter !== "All" && b.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        b.id,
        b.passengerName,
        b.passengerPhone,
        b.pickupAddress,
        b.dropoffAddress,
        ...(b.via ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sorted, statusFilter, search]);

  const nextJob = useMemo(() => {
    const now = Date.now();
    return filtered.find(
      (b) =>
        b.status === "Scheduled" &&
        new Date(b.pickupDateTimeISO).getTime() >= now
    );
  }, [filtered]);

  const upcoming = useMemo(() => {
    if (!nextJob) return filtered;
    return filtered.filter((b) => b.id !== nextJob.id);
  }, [filtered, nextJob]);

  function setStatus(id: string, s: BookingStatus) {
    setAll((prev) => prev.map((b) => (b.id === id ? { ...b, status: s } : b)));
  }

  function setPayment(id: string, p: PaymentStatus) {
    setAll((prev) =>
      prev.map((b) => (b.id === id ? { ...b, paymentStatus: p } : b))
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500">Next job pinned • Search • Filter</p>
        </div>

        {/* Controls */}
        <div className="mb-4 flex gap-2">
          <select
            className="w-40 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "All" | BookingStatus)
            }
          >
            <option value="All">All statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="POB">POB</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="No Show">No Show</option>
          </select>

          <input
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Search name, phone, pickup…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Next job */}
        {nextJob ? (
          <BookingCard
            title="Next Job"
            booking={nextJob}
            onSetStatus={(s) => setStatus(nextJob.id, s)}
            onSetPayment={(p) => setPayment(nextJob.id, p)}
          />
        ) : (
          <div className="rounded-2xl bg-white border border-gray-100 p-4 text-sm text-gray-600">
            No upcoming scheduled jobs found.
          </div>
        )}

        {/* Upcoming */}
        <div className="mt-4 space-y-3">
          {upcoming.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onSetStatus={(s) => setStatus(b.id, s)}
              onSetPayment={(p) => setPayment(b.id, p)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}