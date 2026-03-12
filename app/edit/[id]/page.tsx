"use client";

import { useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isoFromDateTime(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}

export default function EditBookingPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [fare, setFare] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");

  useEffect(() => {
    async function loadBooking() {
      if (!id) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        alert("Could not load booking.");
        router.push("/");
        return;
      }

      setPassengerName(data.passenger_name ?? "");
      setPassengerPhone(data.passenger_phone ?? "");
      setPickupDate(toDateInputValue(data.pickup_datetime ?? ""));
      setPickupTime(toTimeInputValue(data.pickup_datetime ?? ""));
      setPickupAddress(data.pickup_address ?? "");
      setDropoffAddress(data.dropoff_address ?? "");
      setDistanceMiles(
        data.distance_miles !== null && data.distance_miles !== undefined
          ? String(data.distance_miles)
          : ""
      );
      setFare(
        data.fare !== null && data.fare !== undefined ? String(data.fare) : ""
      );
      setNotes(data.notes ?? "");
      setStatus(data.status ?? "Scheduled");
      setPaymentStatus(data.payment_status ?? "Unpaid");

      setLoading(false);
    }

    void loadBooking();
  }, [id, router]);

  const canSave = useMemo(() => {
    return (
      passengerName.trim().length > 0 &&
      passengerPhone.trim().length > 0 &&
      pickupAddress.trim().length > 0 &&
      dropoffAddress.trim().length > 0 &&
      pickupDate.trim().length > 0 &&
      pickupTime.trim().length > 0
    );
  }, [
    passengerName,
    passengerPhone,
    pickupAddress,
    dropoffAddress,
    pickupDate,
    pickupTime,
  ]);

  function onCancel() {
    router.push("/");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);

    try {
      const fareNumber =
        fare.trim().length > 0 ? Number(fare.replace(/[^\d.]/g, "")) : null;

      const distanceMilesNumber =
        distanceMiles.trim().length > 0
          ? Number(distanceMiles.replace(/[^\d.]/g, ""))
          : null;

      const { error } = await supabase
        .from("bookings")
        .update({
          passenger_name: passengerName.trim(),
          passenger_phone: passengerPhone.trim(),
          pickup_address: pickupAddress.trim(),
          dropoff_address: dropoffAddress.trim(),
          pickup_datetime: isoFromDateTime(pickupDate, pickupTime),
          distance_miles: distanceMilesNumber,
          fare: fareNumber,
          notes: notes.trim() || null,
          status,
          payment_status: paymentStatus,
        })
        .eq("id", id);

      if (error) {
        console.error(error);
        alert(`Could not save booking: ${error.message}`);
        setSaving(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Something went wrong while saving the booking.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-md p-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow">
            Loading booking...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Edit booking</h1>
          <p className="text-sm text-gray-600">
            Update this booking and save changes.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow"
        >
          <div>
            <label className="text-sm font-medium">Passenger name</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Passenger phone</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={passengerPhone}
              onChange={(e) => setPassengerPhone(e.target.value)}
              inputMode="tel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Pickup date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Pickup time</label>
              <input
                type="time"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Pickup address</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-blue-50 p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Dropoff address</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-blue-50 p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Estimated fare (£)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={fare}
              onChange={(e) => setFare(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Distance (miles)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={distanceMiles}
              onChange={(e) => setDistanceMiles(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="POB">POB</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Payment status</label>
              <select
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSave || saving}
            className={`w-full rounded-xl py-3 font-semibold text-white ${
              canSave && !saving ? "bg-gray-900" : "cursor-not-allowed bg-gray-400"
            }`}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-gray-200 py-3 font-semibold"
          >
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}