"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "./lib/supabase";

/* -------------------- TYPES -------------------- */

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

/* -------------------- HELPERS -------------------- */

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
  return pickString(row, ["driver_name"]);
}

function getVehicle(row: BookingRow): string {
  return pickString(row, ["vehicle"]);
}

function getBookingType(row: BookingRow): string {
  return pickString(row, ["booking_type"]);
}

/* -------------------- COMPONENT -------------------- */

export default function HomePage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Upcoming");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadBookings() {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .order("pickup_datetime", { ascending: true });

      setBookings((data as BookingRow[]) ?? []);
      setLoading(false);
    }

    void loadBookings();
  }, []);

  /* -------------------- NEW LOGIC (ADDED) -------------------- */

  const schedulingAlerts = useMemo(() => {
    const upcoming = bookings
      .map((b) => ({
        id: b.id,
        when: new Date(getWhen(b)).getTime(),
        driver: getDriver(b),
      }))
      .filter((b) => !Number.isNaN(b.when))
      .sort((a, b) => a.when - b.when);

    let clusters: {
      start: number;
      end: number;
      count: number;
      unassigned: number;
    }[] = [];

    for (let i = 0; i < upcoming.length; i++) {
      let cluster = [upcoming[i]];

      for (let j = i + 1; j < upcoming.length; j++) {
        const diff = upcoming[j].when - cluster[0].when;

        if (diff <= 2 * 60 * 60 * 1000) {
          cluster.push(upcoming[j]);
        } else {
          break;
        }
      }

      if (cluster.length >= 3) {
        clusters.push({
          start: cluster[0].when,
          end: cluster[cluster.length - 1].when,
          count: cluster.length,
          unassigned: cluster.filter((c) => !c.driver).length,
        });
      }
    }

    return clusters;
  }, [bookings]);

  /* -------------------- RENDER -------------------- */

  return (
    <main className="p-6">

      {/* EXISTING BLOCK */}
      <div className="mb-4">
        <div className="font-bold">Bookings</div>
      </div>

      {/* NEW ALERT BLOCK (ADDED ONLY) */}
      {schedulingAlerts.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-800 mb-2">
            ⚠ Scheduling alerts
          </div>

          {schedulingAlerts.map((c, i) => (
            <div key={i} className="text-sm text-red-700">
              {c.count} jobs between{" "}
              {new Date(c.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              and{" "}
              {new Date(c.end).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {c.unassigned > 0 && (
                <span className="ml-2 font-semibold">
                  • {c.unassigned} unassigned
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {loading ? <div>Loading…</div> : null}
    </main>
  );
}