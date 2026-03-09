"use client";

import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

function isoFromDateTime(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}

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

export default function AddBookingPage() {
  const router = useRouter();

  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  const [pickupDate, setPickupDate] = useState(todayYYYYMMDD());
  const [pickupTime, setPickupTime] = useState(nowHHMM());

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [via, setVia] = useState("");

  const [pax, setPax] = useState<number>(1);
  const [bagsLarge, setBagsLarge] = useState<number>(0);
  const [bagsSmall, setBagsSmall] = useState<number>(0);

  const [estFare, setEstFare] = useState<string>("");
  const [distanceMiles, setDistanceMiles] = useState<string>("");

  const [notes, setNotes] = useState("");
  const [localAuthority, setLocalAuthority] = useState<string>("");

  const [isReturn, setIsReturn] = useState(false);
  const [reverseReturn, setReverseReturn] = useState(true);
  const [returnDate, setReturnDate] = useState(todayYYYYMMDD());
  const [returnTime, setReturnTime] = useState("17:30");

  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    return (
      passengerName.trim().length > 0 &&
      passengerPhone.trim().length > 0 &&
      pickupAddress.trim().length > 0 &&
      dropoffAddress.trim().length > 0 &&
      pickupDate.trim().length > 0 &&
      pickupTime.trim().length > 0 &&
      (!isReturn || (returnDate.trim().length > 0 && returnTime.trim().length > 0))
    );
  }, [
    passengerName,
    passengerPhone,
    pickupAddress,
    dropoffAddress,
    pickupDate,
    pickupTime,
    isReturn,
    returnDate,
    returnTime,
  ]);

  function onCancel() {
    router.push("/");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;

    setSaving(true);

    try {
      const estFareGBP =
        estFare.trim().length > 0
          ? Number(estFare.replace(/[^\d.]/g, ""))
          : null;

      const distanceMilesNumber =
        distanceMiles.trim().length > 0
          ? Number(distanceMiles.replace(/[^\d.]/g, ""))
          : null;

      const outboundInsert = await supabase.from("bookings").insert([
  {
    passenger_name: passengerName.trim(),
    passenger_phone: passengerPhone.trim(),
    pickup_address: pickupAddress.trim(),
    dropoff_address: dropoffAddress.trim(),
    pickup_datetime: isoFromDateTime(pickupDate, pickupTime),
    distance_miles: distanceMilesNumber,
    fare: estFareGBP,
    notes: notes.trim() || null,
    status: "Scheduled",
    payment_status: "Unpaid",
    created_at: new Date().toISOString(),
  },
]);

      if (outboundInsert.error) {
        console.error(outboundInsert.error);
        alert(`Could not save outbound booking: ${outboundInsert.error.message}`);
        setSaving(false);
        return;
      }

      if (isReturn) {
        const retPickup = reverseReturn
          ? dropoffAddress.trim()
          : pickupAddress.trim();
        const retDrop = reverseReturn
          ? pickupAddress.trim()
          : dropoffAddress.trim();

        const returnInsert = await supabase.from("bookings").insert([
  {
    passenger_name: passengerName.trim(),
    passenger_phone: passengerPhone.trim(),
    pickup_address: retPickup,
    dropoff_address: retDrop,
    pickup_datetime: isoFromDateTime(returnDate, returnTime),
    distance_miles: distanceMilesNumber,
    fare: null,
    notes: notes.trim() || null,
    status: "Scheduled",
    payment_status: "Unpaid",
    created_at: new Date().toISOString(),
  },
]);

        if (returnInsert.error) {
          console.error(returnInsert.error);
          alert(`Outbound saved, but return booking failed: ${returnInsert.error.message}`);
          setSaving(false);
          return;
        }
      }

      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Something went wrong while saving the booking.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Add booking</h1>
          <p className="text-sm text-gray-600">
            Create an outbound booking (and optional return).
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-white p-4 shadow border border-gray-200 space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Passenger name</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
              placeholder="e.g. Bridget"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Passenger phone</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={passengerPhone}
              onChange={(e) => setPassengerPhone(e.target.value)}
              placeholder="e.g. 07700 900000"
              autoComplete="tel"
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
              placeholder="e.g. 29 Culver Road, Winchester"
              autoComplete="street-address"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Dropoff address</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-blue-50 p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder="e.g. Heathrow Terminal 5"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Via (optional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={via}
              onChange={(e) => setVia(e.target.value)}
              placeholder="Comma-separated, e.g. Reading, Newbury"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Pax</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={pax}
                onChange={(e) => setPax(Number(e.target.value || 1))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Large bags</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={bagsLarge}
                onChange={(e) => setBagsLarge(Number(e.target.value || 0))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Small bags</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={bagsSmall}
                onChange={(e) => setBagsSmall(Number(e.target.value || 0))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Estimated fare (£)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={estFare}
              onChange={(e) => setEstFare(e.target.value)}
              placeholder="e.g. 85"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Distance (miles)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={distanceMiles}
              onChange={(e) => setDistanceMiles(e.target.value)}
              placeholder="e.g. 214"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything the driver needs to know..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Local authority (optional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={localAuthority}
              onChange={(e) => setLocalAuthority(e.target.value)}
              placeholder="e.g. West Berkshire"
            />
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={isReturn}
                onChange={(e) => setIsReturn(e.target.checked)}
              />
              Return journey?
            </label>

            {isReturn && (
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reverseReturn}
                    onChange={(e) => setReverseReturn(e.target.checked)}
                  />
                  Return pickup/dropoff is the reverse of outbound?
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Return date</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Return time</label>
                    <input
                      type="time"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSave || saving}
            className={`w-full rounded-xl py-3 font-semibold text-white ${
              canSave && !saving ? "bg-gray-900" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? "Saving..." : "Save booking"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl py-3 font-semibold border border-gray-200"
          >
            Cancel
          </button>
        </form>
      </div>
    </main>
  );
}