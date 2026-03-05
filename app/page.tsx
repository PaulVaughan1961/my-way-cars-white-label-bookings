"use client";

import { useMemo, useState } from "react";

type BookingStatus = "Scheduled" | "POB" | "Completed" | "Cancelled" | "No Show";

type Booking = {
  id: string;
  pickupDateTimeISO: string;
  passengerName: string;
  passengerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: BookingStatus;
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

export default function Page() {
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: "MWC-1001",
      pickupDateTimeISO: "2026-03-16T12:30:00.000Z",
      passengerName: "Paul Vaughan",
      passengerPhone: "07792042081",
      pickupAddress: "East Grafton",
      dropoffAddress: "Southampton Docks",
      status: "Scheduled",
    },
    {
      id: "MWC-1002",
      pickupDateTimeISO: "2026-03-10T08:00:00.000Z",
      passengerName: "Bridget",
      passengerPhone: "07123456789",
      pickupAddress: "Hungerford",
      dropoffAddress: "Heathrow T5",
      status: "Scheduled",
    },
  ]);

  const sorted = useMemo(() => {
    return [...bookings].sort(
      (a, b) =>
        new Date(a.pickupDateTimeISO).getTime() -
        new Date(b.pickupDateTimeISO).getTime()
    );
  }, [bookings]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">

        <h1 className="text-xl font-bold mb-4">Bookings</h1>

        <button
          className="mb-4 w-full rounded-xl bg-blue-600 text-white py-2"
          onClick={() => {
            const name = prompt("Passenger name?");
            if (!name) return;

            const pickup = prompt("Pickup address?");
            const dropoff = prompt("Dropoff address?");

            if (!pickup || !dropoff) return;

            setBookings((prev) => [
              ...prev,
              {
                id: "MWC-" + Math.floor(Math.random() * 10000),
                pickupDateTimeISO: new Date().toISOString(),
                passengerName: name,
                passengerPhone: "",
                pickupAddress: pickup,
                dropoffAddress: dropoff,
                status: "Scheduled",
              },
            ]);
          }}
        >
          + Add Booking
        </button>

        <div className="space-y-3">
          {sorted.map((b) => (
            <div
              key={b.id}
              className="rounded-xl bg-white p-4 shadow border border-gray-200"
            >
              <div className="font-semibold">{b.passengerName}</div>
              <div className="text-sm text-gray-500">{fmt(b.pickupDateTimeISO)}</div>

              <div className="mt-2 text-sm">
                {b.pickupAddress} → {b.dropoffAddress}
              </div>

              <div className="mt-3 flex gap-2">
                <a
                  className="bg-gray-900 text-white px-3 py-1 rounded"
                  href={`tel:${b.passengerPhone}`}
                >
                  Call
                </a>

                <a
                  className="bg-gray-900 text-white px-3 py-1 rounded"
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                    b.pickupAddress
                  )}&destination=${encodeURIComponent(b.dropoffAddress)}`}
                  target="_blank"
                >
                  Navigate
                </a>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}