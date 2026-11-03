"use client";

import Link from "next/link";
import { isTentative } from "@/lib/bookingWorkflow";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { PersonalCommitmentsPanel, usePersonalCommitments } from "@/app/components/PersonalCommitments";
import { commitmentTime, commitmentsForDay, moveDay } from "@/lib/personalCommitments";

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
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const dayDetails = useRef<HTMLDivElement>(null);

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

  const personalDiary = usePersonalCommitments(dateKey(days[0]), moveDay(dateKey(days[days.length - 1]), 1));

  useEffect(() => {
    if (selectedDate && personalDiary.enabled) dayDetails.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedDate, personalDiary.enabled]);

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
    status === "Rejected" || isTentative(status)
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

        {!selectedDate && <PersonalCommitmentsPanel diary={personalDiary} />}
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
    {monthBookingCount} confirmed booking
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
              const dayBookings = bookingsForDate(key);
              const count = dayBookings.filter(b => !isTentative(b.status)).length;
              const tentativeCount = dayBookings.length - count;
              const personalEntries = personalDiary.enabled ? commitmentsForDay(personalDiary.entries, key) : [];
              const isCurrentMonth =
                day.getMonth() === currentMonth.getMonth();
                const bgColour =
  count === 0
    ? "bg-emerald-50"
    : count <= 2
    ? "bg-yellow-50"
    : count <= 4
    ? "bg-orange-50"
    : "bg-red-50";

              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDate(key);
                    if (selectedDate === key && personalDiary.enabled) dayDetails.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
className={`min-h-24 rounded-2xl border p-2 text-left
  ${bgColour}
  ${
    selectedDate === key
      ? "border-slate-900"
      : "border-slate-200"
  }
  ${
    key === dateKey(new Date())
       ? "ring-4 ring-slate-400"
      : ""
  }
  ${!isCurrentMonth ? "opacity-40" : ""}
`}
                >
                  <div className="font-bold">{day.getDate()}</div>

                  <div className="mt-2 text-xs">
{count === 0 ? (
  <span className="font-semibold text-emerald-700">
    No confirmed jobs
  </span>
) : count <= 2 ? (
  <span className="font-semibold text-yellow-600">
    🟡 {count} booking{count === 1 ? "" : "s"}
  </span>
) : count <= 4 ? (
  <span className="font-semibold text-orange-600">
    🟠 {count} bookings
  </span>
) : (
  <span className="font-semibold text-red-600">
    🔴 {count} bookings
  </span>
)}
                  </div>
                  {tentativeCount > 0 && <div className="mt-1 rounded bg-purple-100 px-1 text-xs font-bold text-purple-900">{tentativeCount} TBC / pending</div>}
                  {personalEntries.slice(0, 2).map(entry => <div key={entry.id} className="mt-1 truncate rounded border-l-4 border-violet-700 bg-violet-100 px-1 py-0.5 text-xs font-semibold text-violet-950" title={`${commitmentTime(entry, key)} · ${entry.title}`}>
                    <span aria-hidden="true">● </span>{commitmentTime(entry, key)} · {entry.title}
                  </div>)}
                  {personalEntries.length > 2 && <div className="mt-1 text-xs font-semibold text-violet-900">+{personalEntries.length - 2} personal</div>}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div ref={dayDetails} className="scroll-mt-4 rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              {new Date(selectedDate).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </h2>
            {personalDiary.enabled && <div className="mb-4">
              <PersonalCommitmentsPanel diary={personalDiary} date={selectedDate} />
            </div>}
            <div className="mb-4">
  <Link
    href={`/add?date=${selectedDate}`}
    className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
  >
    + Add Booking
  </Link>
</div>

            {selectedBookings.length === 0 ? (
              <p className="text-sm text-slate-600">
                No bookings on this day.
              </p>
            ) : (
              <div className="space-y-3">
{selectedBookings.map((booking) => (
 <div
  key={booking.id}
  onClick={() =>
    setExpandedBookingId(
      expandedBookingId === booking.id ? null : booking.id
    )
  }
  className="cursor-pointer rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"
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
      {isTentative(booking.status) ? `${booking.status} — not confirmed` : booking.status || "No status"}
    </div>
    {expandedBookingId === booking.id && (
  <div className="mt-4 border-t pt-4 text-sm text-slate-700">
    <div>
      <strong>Passenger:</strong>{" "}
      {booking.passenger_name || "Unnamed passenger"}
    </div>

    <div>
      <strong>Pickup:</strong>{" "}
      {booking.pickup_address || "No pickup"}
    </div>

    <div>
      <strong>Dropoff:</strong>{" "}
      {booking.dropoff_address || "No dropoff"}
    </div>

    <div>
      <strong>Status:</strong>{" "}
      {isTentative(booking.status) ? `${booking.status} — not confirmed` : booking.status || "No status"}
    </div>

    <div className="mt-3">
      <Link
        href={`/edit/${booking.id}`}
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
      >
        Edit Booking
      </Link>
    </div>
  </div>
)}
  </div>
))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
