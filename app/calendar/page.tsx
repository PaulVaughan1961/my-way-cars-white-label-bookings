"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Booking = {
  id: string;
  passenger_name?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  pickup_datetime?: string | null;
  status?: string | null;
};

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    async function loadBookings() {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("bookings")
        .select("id, passenger_name, pickup_address, dropoff_address, pickup_datetime, status")
        .order("pickup_datetime", { ascending: true });

      if (!error && data) {
        setBookings(data);
      }
    }

    loadBookings();
  }, []);

  const monthStart = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );

  const monthEnd = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  );

  const days = useMemo(() => {
    const result: Date[] = [];

    const startPadding = (monthStart.getDay() + 6) % 7;

    for (let i = startPadding; i > 0; i--) {
      result.push(
        new Date(
          monthStart.getFullYear(),
          monthStart.getMonth(),
          1 - i
        )
      );
    }

    for (let day = 1; day <= monthEnd.getDate(); day++) {
      result.push(
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          day
        )
      );
    }

    while (result.length % 7 !== 0) {
      const last = result[result.length - 1];
      result.push(
        new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
      );
    }

    return result;
  }, [currentMonth]);

  function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function bookingsForDate(key: string) {
  return bookings.filter((booking) => {
    if (!booking.pickup_datetime) return false;

    const status = (booking.status ?? "Scheduled").toString();

    if (
      status === "Cancelled" ||
      status === "Rejected"
    ) {
      return false;
    }

    return booking.pickup_datetime.slice(0, 10) === key;
  });
}

const selectedBookings = selectedDate
  ? bookingsForDate(selectedDate)
  : [];

const monthBookingCount = bookings.filter((booking) => {
  if (!booking.pickup_datetime) return false;

  const status = (booking.status ?? "Scheduled").toString();

  if (
    status === "Cancelled" ||
    status === "Rejected"
  ) {
    return false;
  }

  const bookingDate = new Date(booking.pickup_datetime);

  return (
    bookingDate.getMonth() === currentMonth.getMonth() &&
    bookingDate.getFullYear() === currentMonth.getFullYear()
  );
}).length;

return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Calendar View
              </h1>
              <p className="text-sm text-slate-600">
                Check daily availability without changing the dashboard.
              </p>
            </div>

 <Link
  href="/dashboard"
  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
>
  Back to dashboard
</Link>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                    1
                  )
                )
              }
              className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium"
            >
              Previous
            </button>




<div className="text-center">
  <h2 className="text-xl font-bold">
    {currentMonth.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    })}
  </h2>

  <div className="text-sm text-slate-600">
    {monthBookingCount} booking
    {monthBookingCount !== 1 ? "s" : ""} this month
  </div>
</div>

            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                  )
                )
              }
              className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium"
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-slate-600">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = dateKey(day);
              const count = bookingsForDate(key).length;
              const isCurrentMonth =
                day.getMonth() === currentMonth.getMonth();

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  className={`min-h-24 rounded-2xl border p-2 text-left ${
                    selectedDate === key
                      ? "border-slate-900 bg-slate-100"
                      : "border-slate-200 bg-white"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                >
                  <div className="font-bold">{day.getDate()}</div>

                  <div className="mt-2 text-xs">
                    {count === 0 ? (
                      <span className="text-emerald-700">Free</span>
                    ) : count <= 2 ? (
                      <span className="text-amber-700">
                        {count} booking{count === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="font-semibold text-rose-700">
                        {count} bookings
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              {new Date(selectedDate).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </h2>

            {selectedBookings.length === 0 ? (
              <p className="text-sm text-slate-600">
                No bookings on this day.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedBookings.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/edit/${booking.id}`}
                    className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <div className="font-semibold">
                      {booking.pickup_datetime
                        ? new Date(booking.pickup_datetime).toLocaleTimeString(
                            "en-GB",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "No time"}{" "}
                      — {booking.passenger_name || "Unnamed passenger"}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {booking.pickup_address || "No pickup"} →{" "}
                      {booking.dropoff_address || "No dropoff"}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {booking.status || "No status"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}