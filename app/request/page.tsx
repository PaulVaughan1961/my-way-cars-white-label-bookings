"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isoFromDateTime(dateStr: string, timeStr: string) {
  return `${dateStr}T${timeStr}:00`;
}

export default function BookingRequestPage() {
  const [saving, setSaving] = useState(false);

  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");

  const [pickupDate, setPickupDate] = useState(todayYYYYMMDD());
  const [pickupTime, setPickupTime] = useState(nowHHMM());

  const [notes, setNotes] = useState("");

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);

    const insert = await supabase.from("bookings").insert([
      {
        passenger_name: passengerName.trim(),
        passenger_phone: passengerPhone.trim(),

        pickup_address: pickupAddress.trim(),
        dropoff_address: dropoffAddress.trim(),

        pickup_datetime: isoFromDateTime(
          pickupDate,
          pickupTime
        ),

        status: "Pending Approval",

        payment_status: "Unpaid",

        notes: notes.trim() || null,
      } as never,
    ]);

    setSaving(false);

    if (insert.error) {
      alert(insert.error.message);
      return;
    }

    alert(
      "Booking request submitted successfully. We will contact you shortly."
    );

    setPassengerName("");
    setPassengerPhone("");
    setPickupAddress("");
    setDropoffAddress("");
    setNotes("");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">
            Booking Request
          </h1>

          <p className="text-sm text-gray-600">
            Submit a booking request and we will
            confirm availability shortly.
          </p>
        </div>

        <form
          onSubmit={submitRequest}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow"
        >
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Passenger name"
            value={passengerName}
            onChange={(e) =>
              setPassengerName(e.target.value)
            }
          />

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Phone number"
            value={passengerPhone}
            onChange={(e) =>
              setPassengerPhone(e.target.value)
            }
          />

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Pickup address"
            value={pickupAddress}
            onChange={(e) =>
              setPickupAddress(e.target.value)
            }
          />

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Dropoff address"
            value={dropoffAddress}
            onChange={(e) =>
              setDropoffAddress(e.target.value)
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              className="rounded-xl border p-3"
              value={pickupDate}
              onChange={(e) =>
                setPickupDate(e.target.value)
              }
            />

            <input
              type="time"
              className="rounded-xl border p-3"
              value={pickupTime}
              onChange={(e) =>
                setPickupTime(e.target.value)
              }
            />
          </div>

          <textarea
            className="w-full rounded-xl border p-3"
            placeholder="Notes (optional)"
            rows={4}
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-black py-3 font-semibold text-white"
          >
            {saving
              ? "Submitting..."
              : "Submit Booking Request"}
          </button>
        </form>
      </div>
    </main>
  );
}