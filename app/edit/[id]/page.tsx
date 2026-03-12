"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

type BookingRow = {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  lead_passenger?: string | null;
  customer_name?: string | null;
  name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  pickup?: string | null;
  pickup_address?: string | null;
  from_address?: string | null;
  dropoff?: string | null;
  dropoff_address?: string | null;
  to_address?: string | null;
  notes?: string | null;
  fare?: number | string | null;
  quoted_fare?: number | string | null;
  amount?: number | string | null;
  pickup_at?: string | null;
  journey_at?: string | null;
  date_time?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

function pickString(row: BookingRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNumber(row: BookingRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function getWhen(row: BookingRow): string {
  return pickString(row, ["pickup_at", "journey_at", "date_time", "created_at"]);
}

function getName(row: BookingRow): string {
  return pickString(row, ["lead_passenger", "customer_name", "name"]) || "Unnamed booking";
}

function getPhone(row: BookingRow): string {
  return pickString(row, ["phone", "mobile"]);
}

function getPickup(row: BookingRow): string {
  return pickString(row, ["pickup", "pickup_address", "from_address"]);
}

function getDropoff(row: BookingRow): string {
  return pickString(row, ["dropoff", "dropoff_address", "to_address"]);
}

function getFare(row: BookingRow): number | null {
  return pickNumber(row, ["fare", "quoted_fare", "amount"]);
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

export default function HomePage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadBookings() {
    try {
      setLoading(true);
      setErrorMessage("");

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("pickup_at", { ascending: true });

      if (error) throw error;
      setBookings((data as BookingRow[]) ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load bookings";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    const now = Date.now();

    const sorted = [...bookings].sort((a, b) => {
      const aTime = new Date(getWhen(a)).getTime();
      const bTime = new Date(getWhen(b)).getTime();
      const safeA = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
      const safeB = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
      return safeA - safeB;
    });

    if (statusFilter === "All") return sorted;

    if (statusFilter === "Upcoming") {
      return sorted.filter((row) => {
        const when = new Date(getWhen(row)).getTime();
        const status = (row.status ?? "Scheduled").toString();
        return !Number.isNaN(when) && when >= now && status !== "Cancelled" && status !== "Completed";
      });
    }

    return sorted.filter((row) => (row.status ?? "Scheduled") === statusFilter);
  }, [bookings, statusFilter]);

  const nextJob = useMemo(() => {
    const now = Date.now();
    return (
      [...bookings]
        .filter((row) => {
          const when = new Date(getWhen(row)).getTime();
          const status = (row.status ?? "Scheduled").toString();
          return !Number.isNaN(when) && when >= now && status !== "Cancelled" && status !== "Completed";
        })
        .sort((a, b) => new Date(getWhen(a)).getTime() - new Date(getWhen(b)).getTime())[0] ?? null
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
      const message = error instanceof Error ? error.message : "Failed to update booking";
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

  function BookingCard({ booking }: { booking: BookingRow }) {
    const when = getWhen(booking);
    const name = getName(booking);
    const phone = getPhone(booking);
    const pickup = getPickup(booking);
    const dropoff = getDropoff(booking);
    const fare = getFare(booking);
    const status = (booking.status ?? "Scheduled").toString();
    const paymentStatus = (booking.payment_status ?? "Unpaid").toString();
    const notes = pickString(booking, ["notes"]);
    const isBusy = busyId === booking.id;

    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{name}</div>
            <div className="text-sm text-slate-600">{fmtDateTime(when)}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">{status}</div>
            <div className="text-slate-500">{paymentStatus}</div>
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
          {notes ? (
            <div>
              <span className="font-medium">Notes:</span> {notes}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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

          {status !== "Completed" ? (
            <button
              onClick={() => void onMarkCompleted(booking.id)}
              disabled={isBusy}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Mark completed
            </button>
          ) : null}

          {paymentStatus !== "Paid" ? (
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
                onClick={() => void loadBookings()}
                className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {nextJob ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 text-lg font-semibold text-slate-900">Next job</div>
            <BookingCard booking={nextJob} />
          </section>
        ) : (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">You’re clear</div>
            <p className="mt-1 text-sm text-slate-600">No upcoming scheduled jobs found.</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {["All", "Upcoming", "Scheduled", "Completed", "Cancelled"].map((value) => (
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
    </main>
  );
}