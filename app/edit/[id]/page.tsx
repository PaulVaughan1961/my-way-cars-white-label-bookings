"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

const supabase = getSupabase();

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
  driver_name?: string | null;
  vehicle?: string | null;
  booking_type?: string | null;
  return_datetime?: string | null;
return_notes?: string | null;
};

type DriverRow = {
  id: string;
  name: string;
  default_vehicle?: string | null;
  default_authority?: string | null;
  current_vehicle?: string | null;
  current_authority?: string | null;
  active?: boolean | null;
};

type VehicleRow = {
  id: string;
  name?: string | null;
  make?: string | null;
  model?: string | null;
  registration?: string | null;
  plate_number?: string | null;
  council?: string | null;
  active?: boolean | null;
};

function buildVehicleDisplay(vehicle: VehicleRow): string {
  return [
    `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim(),
    vehicle.registration ? `Reg: ${vehicle.registration}` : null,
    vehicle.plate_number ? `Plate: ${vehicle.plate_number}` : null,
    vehicle.council ? `Authority: ${vehicle.council}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function getVehicleMatchName(vehicle: VehicleRow): string {
  return (
    vehicle.name?.trim() ||
    `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
  );
}

function localDateFromIso(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTimeFromIso(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isoFromDateTime(dateStr: string, timeStr: string) {
  if (!dateStr || !timeStr) return "";
  return `${dateStr}T${timeStr}:00`;
}

export default function EditBookingPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [hasReturn, setHasReturn] = useState(false);
const [returnDate, setReturnDate] = useState("");
const [returnTime, setReturnTime] = useState("");
const [returnNotes, setReturnNotes] = useState("");

  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [via, setVia] = useState("");
  const [pax, setPax] = useState("1");
  const [bagsLarge, setBagsLarge] = useState<number>(0);
  const [bagsSmall, setBagsSmall] = useState<number>(0);
  const [estFare, setEstFare] = useState<string>("");
  const [distanceMiles, setDistanceMiles] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [localAuthority, setLocalAuthority] = useState("");
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [driverName, setDriverName] = useState("");

  const [vehicle, setVehicle] = useState("");
  const [bookingType, setBookingType] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");

  useEffect(() => {
    if (!id) return;

    async function loadBooking() {
      try {
        setLoading(true);
        setErrorMessage("");

        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        const { data: driverData, error: driverError } = await supabase
          .from("drivers")
          .select(
            "id, name, default_vehicle, default_authority, current_vehicle, current_authority, active"
          )
          .eq("active", true)
          .order("name", { ascending: true });

        if (driverError) throw driverError;

        setDrivers((driverData as DriverRow[]) ?? []);

        const { data: vehicleData, error: vehicleError } = await supabase
          .from("vehicles")
          .select("*")
          .order("make", { ascending: true });

        if (vehicleError) throw vehicleError;

        setVehicles((vehicleData as VehicleRow[]) ?? []);

        const row = data as BookingRow;

        setPassengerName(row.passenger_name ?? "");
        setPassengerPhone(row.passenger_phone ?? "");
        setPickupDate(localDateFromIso(row.pickup_datetime));
        setPickupTime(localTimeFromIso(row.pickup_datetime));
        setPickupAddress(row.pickup_address ?? "");
        setDropoffAddress(row.dropoff_address ?? "");
        setVia(row.via ?? "");
        setPax(
          row.passengers === null || row.passengers === undefined
            ? "1"
            : String(row.passengers)
        );
        setBagsLarge(Number(row.bags_large ?? 0));
        setBagsSmall(Number(row.bags_small ?? 0));
        setEstFare(
          row.fare === null || row.fare === undefined ? "" : String(row.fare)
        );
        setDistanceMiles(
          row.distance_miles === null || row.distance_miles === undefined
            ? ""
            : String(row.distance_miles)
        );
        setNotes(row.notes ?? "");
        setLocalAuthority(row.local_authority ?? "");
        setDriverName(row.driver_name ?? "");
        setVehicle(row.vehicle ?? "");
        setBookingType(row.booking_type ?? "");
        setStatus((row.status ?? "Scheduled").toString());
        setPaymentStatus((row.payment_status ?? "Unpaid").toString());
setHasReturn(!!row.return_datetime);
setReturnDate(localDateFromIso(row.return_datetime));
setReturnTime(localTimeFromIso(row.return_datetime));
setReturnNotes(row.return_notes ?? "");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load booking"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBooking();
  }, [id]);

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
    if (!id || !canSave || saving) return;

    setSaving(true);
    setErrorMessage("");

    try {
      const fareValue =
        estFare.trim().length > 0
          ? Number(estFare.replace(/[^\d.]/g, ""))
          : null;

      const distanceValue =
        distanceMiles.trim().length > 0
          ? Number(distanceMiles.replace(/[^\d.]/g, ""))
          : null;

const payload = {
  passenger_name: passengerName.trim(),
  passenger_phone: passengerPhone.trim(),
  pickup_address: pickupAddress.trim(),
  dropoff_address: dropoffAddress.trim(),
  pickup_datetime: isoFromDateTime(pickupDate, pickupTime),
  distance_miles: distanceValue,
  fare: fareValue,
  driver_name: driverName.trim() || null,
  notes: notes.trim() || null,
  status,
  payment_status: paymentStatus,
  passengers: pax === "" ? 1 : Number(pax),
  via: via.trim() || null,
  bags_large: bagsLarge,
  bags_small: bagsSmall,
  local_authority: localAuthority.trim() || null,
  vehicle: vehicle.trim() || null,
  booking_type: bookingType.trim() || null,
  return_datetime: hasReturn
    ? isoFromDateTime(returnDate, returnTime)
    : null,
  return_notes: hasReturn ? returnNotes.trim() || null : null,
};

      const { error } = await supabase
        .from("bookings")
        .update(payload)
        .eq("id", id);

      if (error) throw error;

      router.push("/");
      router.refresh();
} catch (error: any) {
  console.error("Update booking error:", error);
  setErrorMessage(
    error?.message ||
      error?.error_description ||
      error?.details ||
      JSON.stringify(error) ||
      "Failed to update booking"
  );
} finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-md p-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow">
            Loading booking…
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
            Update the booking details and save changes.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow"
        >
          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

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
            <label className="text-sm font-medium">Via (optional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={via}
              onChange={(e) => setVia(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Pax</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={pax}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "");
                  setPax(
                    cleaned === "" ? "" : String(Math.max(1, Number(cleaned)))
                  );
                }}
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

          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Assignment & compliance
            </h2>
          </div>

          <div>
            <label className="text-sm font-medium">Driver</label>
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={driverName}
              onChange={(e) => {
                const selectedName = e.target.value;
                setDriverName(selectedName);

                const selectedDriver = drivers.find(
                  (d) =>
                    d.name?.trim().toLowerCase() ===
                    selectedName.trim().toLowerCase()
                );

                if (!selectedDriver) {
                  setVehicle("");
                  setLocalAuthority("");
                  return;
                }

                const preferredVehicleName =
                  selectedDriver.current_vehicle ||
                  selectedDriver.default_vehicle ||
                  "";

                const preferredAuthority =
                  selectedDriver.current_authority ||
                  selectedDriver.default_authority ||
                  "";

                const matchedVehicle = vehicles.find((v) => {
                  const matchName = getVehicleMatchName(v).toLowerCase();
                  return (
                    matchName === preferredVehicleName.trim().toLowerCase()
                  );
                });

                if (matchedVehicle) {
                  setVehicle(buildVehicleDisplay(matchedVehicle));
                  setLocalAuthority(
                    matchedVehicle.council || preferredAuthority || ""
                  );
                } else {
                  setVehicle(preferredVehicleName);
                  setLocalAuthority(preferredAuthority);
                }
              }}
            >
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.name}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              Vehicle (auto-filled, overrideable)
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={vehicle}
              onChange={(e) => {
                const selectedValue = e.target.value;
                setVehicle(selectedValue);

                const matchedVehicle = vehicles.find(
                  (v) => buildVehicleDisplay(v) === selectedValue
                );

                if (matchedVehicle) {
                  setLocalAuthority(matchedVehicle.council || "");
                }
              }}
            >
              <option value="">Select vehicle</option>
              {vehicles.map((v) => {
                const display = buildVehicleDisplay(v);
                return (
                  <option key={v.id} value={display}>
                    {display}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              Licensing authority (auto-filled, editable)
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={localAuthority}
              onChange={(e) => setLocalAuthority(e.target.value)}
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
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="POB">POB</option>
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

          <div className="border-t border-gray-200 pt-4">
  <label className="flex items-center gap-2 text-sm font-medium">
    <input
      type="checkbox"
      checked={hasReturn}
      onChange={(e) => setHasReturn(e.target.checked)}
    />
    Return journey
  </label>

  {hasReturn && (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Return date</label>
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </div>
        

        <div>
          <label className="text-sm font-medium">Return time</label>
          <input
            type="time"
            className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3"
            value={returnTime}
            onChange={(e) => setReturnTime(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Return notes</label>
        <textarea
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3"
          value={returnNotes}
          onChange={(e) => setReturnNotes(e.target.value)}
          rows={3}
          placeholder="Flight number / return info"
        />
      </div>
    </div>
  )}
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