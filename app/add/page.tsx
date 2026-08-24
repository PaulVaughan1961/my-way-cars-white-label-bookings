"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { getNonResidentialReason } from "@/lib/addressClassification";
import { normalizePhoneForMatching } from "@/lib/customerMatching";
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

type CustomerRow = {
  id: string;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  home_address?: string | null;
  account_name?: string | null;
};

type HomeAddressChoice = "home" | "other";

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



  const [accountName, setAccountName] = useState("");

  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

const [pickupDate, setPickupDate] = useState(
  todayYYYYMMDD()
);
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

  const [customerDirectory, setCustomerDirectory] = useState<CustomerRow[]>([]);
  const [customerDirectoryError, setCustomerDirectoryError] = useState("");
  const [customerDirectoryLoaded, setCustomerDirectoryLoaded] = useState(false);
  const [showCustomerMatches, setShowCustomerMatches] = useState(false);
  const [customerSelected, setCustomerSelected] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [duplicatePhoneOverride, setDuplicatePhoneOverride] = useState(false);
  const [customerHomeAddress, setCustomerHomeAddress] = useState("");
  const [homeAddressChoiceOverride, setHomeAddressChoiceOverride] =
    useState<HomeAddressChoice | null>(null);

  const [hasReturn, setHasReturn] = useState(false);
  const [reverseReturn, setReverseReturn] = useState(true);
  const [returnDate, setReturnDate] = useState(todayYYYYMMDD());
  const [returnTime, setReturnTime] = useState("17:30");
  const [returnFlightNumber, setReturnFlightNumber] = useState("");
  const [returnPickupAddress, setReturnPickupAddress] = useState("");
const [returnDropoffAddress, setReturnDropoffAddress] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

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

    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select(
        "id, passenger_name, passenger_phone, home_address, account_name"
      )
      .order("passenger_name", { ascending: true })
      .limit(1000);

    if (customerError) {
      setCustomerDirectoryError(customerError.message);
    } else {
      setCustomerDirectory((customerData as CustomerRow[]) ?? []);
      setCustomerDirectoryError("");
    }
    setCustomerDirectoryLoaded(true);
  }

  void loadData();
}, []);

  const customerMatches = useMemo(() => {
    if (!showCustomerMatches) return [];

    const needle = passengerName.trim().toLowerCase();
    if (needle.length < 2) return [];

    return customerDirectory
      .filter((customer) =>
        (customer.passenger_name ?? "").toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [customerDirectory, passengerName, showCustomerMatches]);

  const normalizedPassengerPhone = useMemo(
    () => normalizePhoneForMatching(passengerPhone),
    [passengerPhone]
  );

  const phoneMatches = useMemo(() => {
    if (normalizedPassengerPhone.length < 6) return [];

    return customerDirectory.filter(
      (customer) =>
        normalizePhoneForMatching(customer.passenger_phone) ===
        normalizedPassengerPhone
    );
  }, [customerDirectory, normalizedPassengerPhone]);

  const selectedCustomer = useMemo(
    () =>
      selectedCustomerId
        ? customerDirectory.find(
            (customer) => customer.id === selectedCustomerId
          ) ?? null
        : null,
    [customerDirectory, selectedCustomerId]
  );

  const nonResidentialReason = useMemo(
    () => getNonResidentialReason(pickupAddress),
    [pickupAddress]
  );
  const homeAddressChoice =
    homeAddressChoiceOverride ?? (nonResidentialReason ? "other" : "home");
  const homeAddressChoiceOverridden = homeAddressChoiceOverride !== null;

  const canSave = useMemo(() => {
    return (
      passengerName.trim().length > 0 &&
      passengerPhone.trim().length > 0 &&
      pickupAddress.trim().length > 0 &&
      dropoffAddress.trim().length > 0 &&
      pickupDate.trim().length > 0 &&
      pickupTime.trim().length > 0 &&
      (!hasReturn ||
        (returnDate.trim().length > 0 && returnTime.trim().length > 0))
    );
  }, [
    passengerName,
    passengerPhone,
    pickupAddress,
    dropoffAddress,
    pickupDate,
    pickupTime,
    hasReturn,
    returnDate,
    returnTime,
  ]);

  function onCancel() {
    router.push("/");
  }

  function selectCustomer(customer: CustomerRow) {
    setPassengerName(customer.passenger_name || "");
    setPassengerPhone(customer.passenger_phone || "");
    setPickupAddress(customer.home_address || "");
    setCustomerHomeAddress(customer.home_address || "");
    setAccountName(customer.account_name || "");
    setHomeAddressChoiceOverride(null);
    setSelectedCustomerId(customer.id);
    setDuplicatePhoneOverride(false);
    setCustomerSelected(true);
    setShowCustomerMatches(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || saving) return;

    if (!customerDirectoryLoaded) {
      alert(
        "The customer list is still loading. Wait a moment, then save the booking again."
      );
      return;
    }

    if (customerDirectoryError) {
      alert(
        "Could not check the customer list for duplicates. Please refresh the page and try again before saving this booking."
      );
      return;
    }

    if (
      phoneMatches.length > 0 &&
      !selectedCustomerId &&
      !duplicatePhoneOverride
    ) {
      alert(
        "This phone number already belongs to an existing customer. Select the correct customer shown under the phone number, or confirm that this is a different customer."
      );
      return;
    }

    if (hasReturn) {
      const outwardDateTime = isoFromDateTime(pickupDate, pickupTime);
      const returnDateTime = isoFromDateTime(returnDate, returnTime);

      const outwardMs = new Date(outwardDateTime).getTime();
      const returnMs = new Date(returnDateTime).getTime();

      if (
        !Number.isNaN(outwardMs) &&
        !Number.isNaN(returnMs) &&
        returnMs <= outwardMs
      ) {
        alert("Return journey must be after the outward journey.");
        return;
      }
    }

    setSaving(true);

    try {
      const returnGroupId = hasReturn
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
fare: Number(estFare || 0),
payment_status: "Unpaid",
status: "Scheduled",
notes: notes.trim(),

passengers: Number(pax || 1),
via: via.trim(),
bags_large: Number(bagsLarge || 0),
bags_small: Number(bagsSmall || 0),

local_authority: localAuthority || null,
    driver_name: driverName || null,
    driver_phone: driverPhone || null,
    vehicle: vehicle || null,
    booking_type: bookingType || null,
    account_name: accountName.trim() || null,
  } as never,
]);

      if (outboundInsert.error) {
        console.error(outboundInsert.error);
        alert(`Could not save outbound booking: ${outboundInsert.error.message}`);
        setSaving(false);
        return;
      }
      const confirmedHomeAddress =
        homeAddressChoice === "home"
          ? pickupAddress.trim()
          : customerHomeAddress.trim();

      const customerRecord: Record<string, string | null> = {
        passenger_name: passengerName.trim(),
        passenger_phone: passengerPhone.trim(),
        account_name: accountName.trim() || null,
        last_booking_at: new Date().toISOString(),
      };

      // Omitting home_address preserves an existing customer's confirmed address
      // and leaves a new customer blank instead of guessing from a one-off pickup.
      if (confirmedHomeAddress) {
        customerRecord.home_address = confirmedHomeAddress;
      }

      let customerWriteError = null;

      if (selectedCustomerId) {
          const customerUpdates = { ...customerRecord };
          delete customerUpdates.passenger_name;

          const customerUpdate = await supabase
            .from("customers")
            .update(customerUpdates as never)
            .eq("id", selectedCustomerId);

          customerWriteError = customerUpdate.error;
      } else {
          const customerInsert = await supabase
            .from("customers")
            .insert(customerRecord as never);

          customerWriteError = customerInsert.error;
      }

      if (customerWriteError) {
        console.error(customerWriteError);
        alert(
          `Booking saved, but the customer record could not be updated: ${customerWriteError.message}`
        );
      }


      

      if (hasReturn) {
const retPickup = reverseReturn
  ? dropoffAddress.trim()
  : returnPickupAddress.trim();

const retDrop = reverseReturn
  ? pickupAddress.trim()
  : returnDropoffAddress.trim();

const returnInsert = await supabase.from("bookings").insert([
  {
    passenger_name: passengerName.trim(),
    passenger_phone: passengerPhone.trim(),
    pickup_address: retPickup,
    dropoff_address: retDrop,
    pickup_datetime: isoFromDateTime(returnDate, returnTime),

    distance_miles: distanceMilesNumber,
    fare: estFareGBP,

    notes: returnNotes.trim() || null,

    status: "Scheduled",
    payment_status: "Unpaid",
    created_at: new Date().toISOString(),

    passengers: pax === "" ? 1 : Number(pax),

    via: via.trim() || null,

    bags_large: bagsLarge,
    bags_small: bagsSmall,

    local_authority: localAuthority.trim() || null,

    driver_name: driverName.trim() || null,
    driver_phone: driverPhone || null,

    vehicle: vehicle.trim() || null,
    booking_type: bookingType.trim() || null,

    return_group_id: returnGroupId,
    return_flight_number: returnFlightNumber.trim() || null,

    account_name: accountName.trim() || null,
  } as never,
]);



if (returnInsert.error) {
  console.error(returnInsert.error);
  alert(
    `Outbound saved, but return booking failed: ${returnInsert.error.message}`
  );
  setSaving(false);
  return;
}

}



router.push("/");
setSaving(false);

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
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow space-y-4"
        >
          <div>
            <label className="text-sm font-medium">Passenger name</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
value={passengerName}
onChange={(e) => {
  setPassengerName(e.target.value);
  setShowCustomerMatches(true);
  setCustomerSelected(false);
  setSelectedCustomerId(null);
  setDuplicatePhoneOverride(false);
  setCustomerHomeAddress("");
  setHomeAddressChoiceOverride(null);
}}
placeholder="e.g. Bridget"
autoComplete="name"
/>
{showCustomerMatches && customerMatches.length > 0 && (
  <div
    className="mt-1 rounded-xl border border-gray-200 bg-white shadow"
  >
    {customerMatches.map((customer) => (
      <button
        type="button"
key={customer.id}
onClick={() => selectCustomer(customer)}
        className="block w-full border-b border-gray-100 p-3 text-left hover:bg-gray-50"
      >
        <div className="font-medium">
          {customer.passenger_name}
        </div>

        <div className="text-sm text-gray-500">
          {customer.passenger_phone}
        </div>
        {customer.home_address && (
          <div className="text-xs text-gray-500">
            {customer.home_address}
          </div>
        )}
      </button>
    ))}
  </div>
)}
          </div>
          <input
  type="text"
  placeholder="Account / Business (optional)"
  value={accountName}
  onChange={(e) => setAccountName(e.target.value)}
  className="w-full rounded-xl border px-3 py-2"
/>

          <div>
            <label className="text-sm font-medium">Passenger phone</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={passengerPhone}
              onChange={(e) => {
                setPassengerPhone(e.target.value);
                setDuplicatePhoneOverride(false);
              }}
              placeholder="e.g. 07700 900000"
              autoComplete="tel"
              inputMode="tel"
            />

            {!customerDirectoryLoaded && (
              <p className="mt-2 text-sm text-gray-500">
                Checking the customer list for duplicates…
              </p>
            )}

            {customerDirectoryError && (
              <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                The customer list could not be checked for duplicates. Refresh
                this page before saving a booking.
              </div>
            )}

            {selectedCustomer && (
              <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                Using the existing customer record for{" "}
                <strong>{selectedCustomer.passenger_name}</strong>. A duplicate
                customer will not be created.
              </div>
            )}

            {!selectedCustomer &&
              phoneMatches.length > 0 &&
              !duplicatePhoneOverride && (
                <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="font-semibold">
                    This phone number is already saved.
                  </div>
                  <p className="mt-1">
                    Select the correct existing customer to prevent a duplicate.
                  </p>
                  <div className="mt-2 space-y-2">
                    {phoneMatches.map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className="block w-full rounded-lg border border-amber-300 bg-white p-2 text-left hover:bg-amber-100"
                      >
                        <span className="block font-medium">
                          {customer.passenger_name || "Unnamed customer"}
                        </span>
                        <span className="block text-xs text-amber-900">
                          {customer.passenger_phone || "No phone number"}
                          {customer.home_address
                            ? ` · ${customer.home_address}`
                            : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDuplicatePhoneOverride(true)}
                    className="mt-3 text-sm font-medium underline"
                  >
                    This is a different customer using the same phone number
                  </button>
                </div>
              )}

            {!selectedCustomer &&
              phoneMatches.length > 0 &&
              duplicatePhoneOverride && (
                <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Confirmed as a different customer using the same phone number.
                  <button
                    type="button"
                    onClick={() => setDuplicatePhoneOverride(false)}
                    className="ml-2 font-medium underline"
                  >
                    Review existing customers
                  </button>
                </div>
              )}
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

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <label className="text-sm font-medium">
              Is this the customer&apos;s home address?
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
              value={homeAddressChoice}
              onChange={(e) => {
                setHomeAddressChoiceOverride(
                  e.target.value as HomeAddressChoice
                );
              }}
            >
              <option value="home">Yes — save it as their home address</option>
              <option value="other">No — this is a one-off pickup</option>
            </select>

            {nonResidentialReason &&
              homeAddressChoice === "other" &&
              !homeAddressChoiceOverridden && (
                <p className="mt-2 text-sm text-amber-700">
                  Automatically set to No because this looks like{" "}
                  {nonResidentialReason}. You can override this if necessary.
                </p>
              )}

            {homeAddressChoice === "home" ? (
              <p className="mt-2 text-sm text-gray-600">
                This address will be saved for this customer and used as their
                address on invoices.
              </p>
            ) : (
              <div className="mt-3">
                <label className="text-sm font-medium">
                  Customer home address (optional)
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
                  value={customerHomeAddress}
                  onChange={(e) => setCustomerHomeAddress(e.target.value)}
                  placeholder="Enter it if known; otherwise leave blank"
                  autoComplete="off"
                />
                <p className="mt-2 text-sm text-gray-600">
                  {customerSelected
                    ? "Leave this unchanged to keep the customer's existing home address."
                    : "The pickup address will not be saved as the customer's home address."}
                </p>
              </div>
            )}
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
                  return matchName === preferredVehicleName.trim().toLowerCase();
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
            <label className="text-sm font-medium">
              Booking type (optional)
            </label>
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
                checked={hasReturn}
                onChange={(e) => setHasReturn(e.target.checked)}
              />
              Return journey?
            </label>

            {hasReturn && (
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm">
<input
  type="checkbox"
  checked={reverseReturn}
  onChange={(e) => {
    const checked = e.target.checked;
    setReverseReturn(checked);

    if (checked) {
      setReturnPickupAddress("");
      setReturnDropoffAddress("");
    }
  }}
/>
Reverse pickup/dropoff for return
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

{!reverseReturn && (
  <>
    <div>
      <label className="text-sm font-medium">
        Return pickup address
      </label>

      <input
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
        value={returnPickupAddress}
        onChange={(e) => setReturnPickupAddress(e.target.value)}
        placeholder="e.g. Gatwick Airport South Terminal"
      />
    </div>

    <div>
      <label className="text-sm font-medium">
        Return dropoff address
      </label>

      <input
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
        value={returnDropoffAddress}
        onChange={(e) => setReturnDropoffAddress(e.target.value)}
        placeholder="e.g. 29 Culver Road, Winchester"
      />
    </div>
  </>
)}

<div>
  <label className="text-sm font-medium">
    Return flight number
  </label>
  <input
    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
    value={returnFlightNumber}
    onChange={(e) => setReturnFlightNumber(e.target.value)}
    placeholder="e.g. BA123"
  />
</div>

<div>
  <label className="text-sm font-medium">
    Driver notes (return)
  </label>
  <textarea
    className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-gray-200"
    value={returnNotes}
    onChange={(e) => setReturnNotes(e.target.value)}
    rows={3}
    placeholder="Terminal, delays, pickup instructions..."
  />
</div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSave || saving}
            className={`w-full rounded-xl py-3 font-semibold text-white ${
              canSave && !saving
                ? "bg-gray-900"
                : "cursor-not-allowed bg-gray-400"
            }`}
          >
            {saving ? "Saving..." : "Save booking"}
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
