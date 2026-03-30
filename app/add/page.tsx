"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

const supabase = getSupabase();

type DriverRow = {
  id: string;
  name: string;
  driver_phone?: string | null;
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

function isoFromDateTime(dateStr: string, timeStr: string) {
  if (!dateStr || !timeStr) return "";
  return `${dateStr}T${timeStr}:00`;
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

  const [pax, setPax] = useState("1");
  const [bagsLarge, setBagsLarge] = useState<number>(0);
  const [bagsSmall, setBagsSmall] = useState<number>(0);

  const [estFare, setEstFare] = useState<string>("");
  const [distanceMiles, setDistanceMiles] = useState<string>("");

  const [notes, setNotes] = useState("");
  const [localAuthority, setLocalAuthority] = useState<string>("");

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [driverName, setDriverName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [bookingType, setBookingType] = useState("");

  const [isReturn, setIsReturn] = useState(false);
  const [reverseReturn, setReverseReturn] = useState(true);
  const [returnDate, setReturnDate] = useState(todayYYYYMMDD());
  const [returnTime, setReturnTime] = useState("17:30");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
const { data: driverData, error: driverError } = await supabase
  .from("drivers")
  .select(
    "id, name, driver_phone, default_vehicle, default_authority, current_vehicle, current_authority, active"
  )
  .eq("active", true)
  .order("name", { ascending: true });

      if (!driverError) {
        setDrivers((driverData as DriverRow[]) ?? []);
      }

      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .select("*")
        .order("make", { ascending: true });

      if (!vehicleError) {
        setVehicles((vehicleData as VehicleRow[]) ?? []);
      }
    }

    void loadData();
  }, []);

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
  const returnGroupId = isReturn
    ? `RET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : null;

  const estFareGBP =
    estFare.trim().length > 0
      ? Number(estFare.replace(/[^\d.]/g, ""))
      : null;

  const distanceMilesNumber =
    distanceMiles.trim().length > 0
      ? Number(distanceMiles.replace(/[^\d.]/g, ""))
      : null;
        const selectedDriver = drivers.find(
    (d) => d.name?.trim().toLowerCase() === driverName.trim().toLowerCase()
  );

  const driverPhone = selectedDriver?.driver_phone?.trim() || null;

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
  passengers: pax === "" ? 1 : Number(pax),
  via: via.trim() || null,
  bags_large: bagsLarge,
  bags_small: bagsSmall,
  local_authority: localAuthority.trim() || null,
  driver_name: driverName.trim() || null,
  driver_phone: driverPhone,
  vehicle: vehicle.trim() || null,
  booking_type: bookingType.trim() || null,
  return_group_id: returnGroupId,
}
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
            fare: estFareGBP,
            notes: notes.trim() || null,
            status: "Scheduled",
            payment_status: "Unpaid",
            created_at: new Date().toISOString(),
            passengers: pax === "" ? 1 : Number(pax),
            via: via.trim() || null,
            bags_large: bagsLarge,
            bags_small: bagsSmall,
            local_authority: localAuthority.trim() || null,
            driver_name: driverName.trim() || null,
            driver_phone: driverPhone,
            vehicle: vehicle.trim() || null,
            booking_type: bookingType.trim() || null,
            return_group_id: returnGroupId,
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
                inputMode="numeric"
                min={1}
                step={1}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                value={pax}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "");
                  setPax(cleaned === "" ? "" : String(Math.max(1, Number(cleaned))));
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
              placeholder="e.g. West Berkshire"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Booking type (optional)</label>
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={bookingType}
              onChange={(e) => setBookingType(e.target.value)}
            >
              <option value="">Select type</option>
              <option value="Local">Local</option>
              <option value="Long Distance">Long Distance</option>
              <option value="Airport">Airport</option>
              <option value="Seaport">Seaport</option>
            </select>
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