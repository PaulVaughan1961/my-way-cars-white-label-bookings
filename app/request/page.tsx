"use client";

import Link from "next/link";
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

function buildNotes({
  email,
  flightNumber,
  customerNotes,
}: {
  email: string;
  flightNumber: string;
  customerNotes: string;
}) {
  return [
    email.trim() ? `Customer email: ${email.trim()}` : "",
    flightNumber.trim() ? `Flight number: ${flightNumber.trim()}` : "",
    customerNotes.trim() ? `Customer notes: ${customerNotes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function BookingRequestPage() {
  const initialDate = todayYYYYMMDD();
  const initialTime = nowHHMM();

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [passengerEmail, setPassengerEmail] = useState("");
  const [accountName, setAccountName] = useState("");

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupDate, setPickupDate] = useState(initialDate);
  const [pickupTime, setPickupTime] = useState(initialTime);
  const [flightNumber, setFlightNumber] = useState("");

  const [passengers, setPassengers] = useState("1");
  const [largeBags, setLargeBags] = useState("0");
  const [smallBags, setSmallBags] = useState("0");

  const [hasReturn, setHasReturn] = useState(false);
  const [reverseReturn, setReverseReturn] = useState(true);
  const [returnPickupAddress, setReturnPickupAddress] = useState("");
  const [returnDropoffAddress, setReturnDropoffAddress] = useState("");
  const [returnDate, setReturnDate] = useState(initialDate);
  const [returnTime, setReturnTime] = useState(initialTime);
  const [returnFlightNumber, setReturnFlightNumber] = useState("");

  const [notes, setNotes] = useState("");

  function resetForm() {
    const freshDate = todayYYYYMMDD();
    const freshTime = nowHHMM();

    setPassengerName("");
    setPassengerPhone("");
    setPassengerEmail("");
    setAccountName("");
    setPickupAddress("");
    setDropoffAddress("");
    setPickupDate(freshDate);
    setPickupTime(freshTime);
    setFlightNumber("");
    setPassengers("1");
    setLargeBags("0");
    setSmallBags("0");
    setHasReturn(false);
    setReverseReturn(true);
    setReturnPickupAddress("");
    setReturnDropoffAddress("");
    setReturnDate(freshDate);
    setReturnTime(freshTime);
    setReturnFlightNumber("");
    setNotes("");
    setErrorMessage("");
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setErrorMessage("");

    const outwardDateTime = isoFromDateTime(pickupDate, pickupTime);
    const outwardMs = new Date(outwardDateTime).getTime();

    if (Number.isNaN(outwardMs) || outwardMs <= Date.now()) {
      setErrorMessage("Please choose a pickup date and time in the future.");
      return;
    }

    let returnDateTime: string | null = null;
    let resolvedReturnPickup = "";
    let resolvedReturnDropoff = "";

    if (hasReturn) {
      returnDateTime = isoFromDateTime(returnDate, returnTime);
      const returnMs = new Date(returnDateTime).getTime();

      resolvedReturnPickup = reverseReturn
        ? dropoffAddress.trim()
        : returnPickupAddress.trim();
      resolvedReturnDropoff = reverseReturn
        ? pickupAddress.trim()
        : returnDropoffAddress.trim();

      if (Number.isNaN(returnMs) || returnMs <= outwardMs) {
        setErrorMessage("The return journey must be after the outward journey.");
        return;
      }

      if (!resolvedReturnPickup || !resolvedReturnDropoff) {
        setErrorMessage(
          "Please enter both the return pickup address and return drop-off address."
        );
        return;
      }
    }

    setSaving(true);

    const returnGroupId = hasReturn
      ? `REQUEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : null;

    const sharedFields = {
      passenger_name: passengerName.trim(),
      passenger_phone: passengerPhone.trim(),
      passengers: Number(passengers || 1),
      bags_large: Number(largeBags || 0),
      bags_small: Number(smallBags || 0),
      account_name: accountName.trim() || null,
      status: "Pending Approval",
      payment_status: "Unpaid",
      driver_name: null,
      driver_phone: null,
      vehicle: null,
      return_group_id: returnGroupId,
    };

    const outwardNotes = buildNotes({
      email: passengerEmail,
      flightNumber,
      customerNotes: notes,
    });

    const rows: Record<string, unknown>[] = [
      {
        ...sharedFields,
        pickup_address: pickupAddress.trim(),
        dropoff_address: dropoffAddress.trim(),
        pickup_datetime: outwardDateTime,
        notes: outwardNotes || null,
      },
    ];

    if (hasReturn && returnDateTime) {
      const returnNotes = buildNotes({
        email: passengerEmail,
        flightNumber: returnFlightNumber,
        customerNotes: notes,
      });

      rows.push({
        ...sharedFields,
        pickup_address: resolvedReturnPickup,
        dropoff_address: resolvedReturnDropoff,
        pickup_datetime: returnDateTime,
        return_flight_number: returnFlightNumber.trim() || null,
        notes: returnNotes || null,
      });
    }

    const insert = await supabase.from("bookings").insert(rows as never);

    setSaving(false);

    if (insert.error) {
      setErrorMessage(
        "Your request could not be sent. Please try again or contact My Way Cars."
      );
      return;
    }

    resetForm();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-green-200 bg-white p-6 shadow">
          <div className="mb-3 text-4xl" aria-hidden="true">✓</div>
          <h1 className="text-2xl font-bold">Request received</h1>
          <p className="mt-3 text-gray-700">
            Thank you. My Way Cars will check availability and contact you
            shortly.
          </p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This is a booking request and is not confirmed until My Way Cars
            contacts you.
          </div>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-5 w-full rounded-xl bg-black py-3 font-semibold text-white"
          >
            Make another request
          </button>
          <Link
            href="/"
            className="mt-4 block text-center text-sm text-blue-700 underline"
          >
            Back to My Way Cars
          </Link>
        </div>
      </main>
    );
  }

  const fieldClass =
    "mt-1 w-full rounded-xl border border-gray-300 bg-white p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg p-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Request a journey</h1>
          <p className="mt-1 text-sm text-gray-600">
            Send your journey details and My Way Cars will confirm availability
            and price.
          </p>
          <p className="mt-2 text-sm font-medium text-amber-800">
            Your journey is not confirmed until we contact you.
          </p>
        </div>

        <form
          onSubmit={submitRequest}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow"
        >
          <section className="space-y-4">
            <h2 className="font-semibold">Your details</h2>

            <div>
              <label htmlFor="passenger-name" className="text-sm font-medium">
                Passenger name
              </label>
              <input
                id="passenger-name"
                required
                autoComplete="name"
                className={fieldClass}
                placeholder="e.g. Bridget Jones"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="passenger-phone" className="text-sm font-medium">
                Mobile phone
              </label>
              <input
                id="passenger-phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={fieldClass}
                placeholder="e.g. 07700 900000"
                value={passengerPhone}
                onChange={(e) => setPassengerPhone(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="passenger-email" className="text-sm font-medium">
                Email address <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="passenger-email"
                type="email"
                autoComplete="email"
                className={fieldClass}
                placeholder="name@example.com"
                value={passengerEmail}
                onChange={(e) => setPassengerEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="account-name" className="text-sm font-medium">
                Business or account name <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="account-name"
                className={fieldClass}
                placeholder="Leave blank for a private booking"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
          </section>

          <hr className="border-gray-200" />

          <section className="space-y-4">
            <h2 className="font-semibold">Outward journey</h2>

            <div>
              <label htmlFor="pickup-address" className="text-sm font-medium">
                Pickup address
              </label>
              <input
                id="pickup-address"
                required
                autoComplete="street-address"
                className={fieldClass}
                placeholder="Full pickup address"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="dropoff-address" className="text-sm font-medium">
                Drop-off address
              </label>
              <input
                id="dropoff-address"
                required
                className={fieldClass}
                placeholder="Full destination address"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pickup-date" className="text-sm font-medium">Pickup date</label>
                <input
                  id="pickup-date"
                  required
                  type="date"
                  min={todayYYYYMMDD()}
                  className={fieldClass}
                  value={pickupDate}
                  onChange={(e) => {
                    setPickupDate(e.target.value);
                    if (!hasReturn) setReturnDate(e.target.value);
                  }}
                />
              </div>

              <div>
                <label htmlFor="pickup-time" className="text-sm font-medium">Pickup time</label>
                <input
                  id="pickup-time"
                  required
                  type="time"
                  className={fieldClass}
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="flight-number" className="text-sm font-medium">
                Flight number <span className="font-normal text-gray-500">(if applicable)</span>
              </label>
              <input
                id="flight-number"
                className={fieldClass}
                placeholder="e.g. BA281"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
              />
            </div>
          </section>

          <section className="rounded-xl bg-gray-50 p-4">
            <h2 className="mb-3 font-semibold">Passengers and luggage</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="passengers" className="text-xs font-medium">Passengers</label>
                <input
                  id="passengers"
                  required
                  type="number"
                  min="1"
                  max="99"
                  className={fieldClass}
                  value={passengers}
                  onChange={(e) => setPassengers(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="large-bags" className="text-xs font-medium">Large bags</label>
                <input
                  id="large-bags"
                  required
                  type="number"
                  min="0"
                  max="99"
                  className={fieldClass}
                  value={largeBags}
                  onChange={(e) => setLargeBags(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="small-bags" className="text-xs font-medium">Small bags</label>
                <input
                  id="small-bags"
                  required
                  type="number"
                  min="0"
                  max="99"
                  className={fieldClass}
                  value={smallBags}
                  onChange={(e) => setSmallBags(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <label className="flex cursor-pointer items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={hasReturn}
                onChange={(e) => {
                  setHasReturn(e.target.checked);
                  if (e.target.checked) {
                    setReverseReturn(true);
                    setReturnDate(pickupDate);
                    setReturnTime(pickupTime);
                    setReturnPickupAddress("");
                    setReturnDropoffAddress("");
                  } else {
                    setReturnPickupAddress("");
                    setReturnDropoffAddress("");
                  }
                }}
                className="h-5 w-5"
              />
              I need a return journey
            </label>

            {hasReturn && (
              <div className="mt-4 space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-gray-50 p-3">
                  <input
                    type="checkbox"
                    checked={reverseReturn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setReverseReturn(checked);
                      // Custom-return fields must always start empty. The reversed
                      // addresses are resolved only when the form is submitted.
                      setReturnPickupAddress("");
                      setReturnDropoffAddress("");
                    }}
                    className="mt-0.5 h-5 w-5"
                  />
                  <span>
                    <span className="block font-semibold">
                      Return is the reverse of the outward journey
                    </span>
                    <span className="mt-1 block text-sm text-gray-600">
                      Untick this if the return pickup or destination is different.
                    </span>
                  </span>
                </label>

                {!reverseReturn && (
                  <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div>
                      <label htmlFor="return-pickup-address" className="text-sm font-medium">
                        Return pickup address
                      </label>
                      <input
                        id="return-pickup-address"
                        required
                        className={fieldClass}
                        placeholder="Full return pickup address"
                        value={returnPickupAddress}
                        autoComplete="off"
                        onChange={(e) => setReturnPickupAddress(e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor="return-dropoff-address" className="text-sm font-medium">
                        Return drop-off address
                      </label>
                      <input
                        id="return-dropoff-address"
                        required
                        className={fieldClass}
                        placeholder="Full return destination address"
                        value={returnDropoffAddress}
                        autoComplete="off"
                        onChange={(e) => setReturnDropoffAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="return-date" className="text-sm font-medium">Return date</label>
                    <input
                      id="return-date"
                      required
                      type="date"
                      min={pickupDate}
                      className={fieldClass}
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="return-time" className="text-sm font-medium">Return time</label>
                    <input
                      id="return-time"
                      required
                      type="time"
                      className={fieldClass}
                      value={returnTime}
                      onChange={(e) => setReturnTime(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="return-flight" className="text-sm font-medium">
                    Return flight number <span className="font-normal text-gray-500">(if applicable)</span>
                  </label>
                  <input
                    id="return-flight"
                    className={fieldClass}
                    placeholder="e.g. BA282"
                    value={returnFlightNumber}
                    onChange={(e) => setReturnFlightNumber(e.target.value)}
                  />
                </div>
              </div>
            )}
          </section>

          <div>
            <label htmlFor="notes" className="text-sm font-medium">
              Extra information <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              id="notes"
              className={fieldClass}
              placeholder="Child seats, accessibility needs, special pickup instructions…"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {errorMessage && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-black py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Sending request…" : "Send booking request"}
          </button>

          <p className="text-center text-xs text-gray-500">
            Your details are used only to respond to this booking request.
          </p>
        </form>
      </div>
    </main>
  );
}
