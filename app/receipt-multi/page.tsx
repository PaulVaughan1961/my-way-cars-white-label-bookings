"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

function MultiReceiptContent() {
  const searchParams = useSearchParams();

  const idsParam = searchParams.get("ids") || "";
  const type = searchParams.get("type") || "invoice";

const showPassengers =
  searchParams.get("showPassengers") !== "false";


  const [bookings, setBookings] = useState<any[]>([]);

const [account, setAccount] = useState<any>(null);
const [customer, setCustomer] = useState<any>(null);

useEffect(() => {
  async function load() {
    const ids = idsParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (ids.length === 0) return;

    const { data: bookingData } = await supabase
      .from("bookings")
      .select("*")
      .in("id", ids);

    const bookingsLoaded = (bookingData || []) as any[];

    setBookings(bookingsLoaded);
    const firstPassenger =
  bookingsLoaded[0]?.passenger_name;

if (firstPassenger) {
  const { data: customerData } = await supabase
    .from("customers")
    .select("*")
    .eq("passenger_name", firstPassenger)
    .maybeSingle();
setCustomer(customerData || null);
}

    const accountBooking = bookingsLoaded.find(
      (booking) =>
        typeof booking.account_name === "string" &&
        booking.account_name.trim() !== ""
    );

    const foundAccountName =
      accountBooking?.account_name?.trim();

    if (!foundAccountName) {
      setAccount(null);
      return;
    }

    const { data: accountData } = await supabase
      .from("accounts")
      .select("*")
      .eq("account_name", foundAccountName)
      .maybeSingle();

    setAccount(accountData || null);
  }

  load();
}, [idsParam]);

if (bookings.length === 0) {
  return <div className="p-6">Loading...</div>;
}

const isReceipt = type === "receipt";
const isSummary = type === "summary";

const documentNumber = `${isReceipt ? "R" : isSummary ? "BOOK" : "INV"}-${Date.now()}`;

const issueDate = new Date().toLocaleDateString("en-GB");

const bookingAccountName =
  bookings.find(
    (booking: any) =>
      typeof booking.account_name === "string" &&
      booking.account_name.trim() !== ""
  )?.account_name?.trim();

const billTo =
  account?.account_name ||
  bookingAccountName ||
  bookings[0]?.passenger_name ||
  "Customer";

const total = bookings.reduce(
  (sum, booking) => sum + Number(booking.fare || 0),
  0
);

  const sortedBookings = [...bookings].sort(
    (a, b) =>
      new Date(a.pickup_datetime).getTime() -
      new Date(b.pickup_datetime).getTime()
  );

  return (
   <main className="min-h-screen bg-white p-6 text-sm">
      <div className="mx-auto max-w-5xl bg-white p-10">

        <div className="mb-4 flex items-start justify-between">
          <div>
<Image
  src="/logo.png"
  alt="My Way Cars"
  width={180}
  height={60}
  priority
/>
          </div>

          <div className="text-right text-sm">
            <div>MY WAY CARS</div>
            <div>8 Kennet House</div>
            <div>19 The High Street</div>
            <div>Hungerford RG17 0NL</div>
            <div>07792042081</div>
            <div>hello@mywaycars.co.uk</div>
            <div>www.mywaycars.co.uk</div>
          </div>
        </div>

        <h2 className="mb-4 text-3xl font-semibold">
          {isReceipt ? "Receipt" : isSummary ? "Booking Summary" : "Invoice"}
        </h2>

        <div className="mb-3">
          <div>
            <strong>
              {isReceipt ? "Receipt #" : isSummary ? "Reference #" : "Invoice #"}
            </strong>{" "}
            {documentNumber}
          </div>

          <div>
            <strong>Date Issued:</strong> {issueDate}
          </div>
        </div>

<div className="mb-4">
  <div className="mb-2 font-semibold">
    {isReceipt || isSummary ? "Customer:" : "Bill To:"}
  </div>

  <div>
    {account?.account_name || billTo}
  </div>

{!isSummary && (account?.address || customer?.home_address) ? (
  <div className="mt-1 whitespace-pre-line">
    {account?.address || customer?.home_address}
  </div>
) : !isSummary ? (
  <div className="mt-1 text-red-600">
    No address found
  </div>
) : null}
</div>
        <div className="mb-4">
          <div className="mb-2 font-semibold">
            Journeys
          </div>

          <table className="w-full border-collapse">
<thead>
  <tr className="border-b">
    <th className="py-2 text-left w-40">
      Date / Time
    </th>

    {showPassengers && (
      <th className="py-2 text-left w-48">
        Passenger
      </th>
    )}

    <th className="py-2 text-left">
      Journey
    </th>

    {!isSummary && (
      <th className="py-2 text-right w-28">
        Fare
      </th>
    )}
  </tr>
</thead>

            <tbody>
              {sortedBookings.map((booking) => (
                <tr key={booking.id} className="border-b">

                  <td className="py-4 align-top">
                    {new Date(
                      booking.pickup_datetime
                    ).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>



{showPassengers && (
  <td className="py-4 align-top">
    <div>{booking.passenger_name}</div>
    {isSummary && (
      <div className="mt-2 text-xs text-gray-600">
        <div>Passengers: {booking.passengers ?? "—"}</div>
        <div>Large bags: {booking.bags_large ?? "—"}</div>
        <div>Small bags: {booking.bags_small ?? "—"}</div>
      </div>
    )}
  </td>
)}

<td className="py-4 align-top">
  <div className="space-y-2">

                      <div>
                        <div className="font-semibold">
                          FROM:
                        </div>

                        <div>
                          {booking.pickup_address}
                        </div>
                      </div>

                      <div>
                        <div className="font-semibold">
                          TO:
                        </div>

                        <div>
                          {booking.dropoff_address}
                        </div>
                      </div>

                      {isSummary && booking.return_flight_number ? (
                        <div>
                          <span className="font-semibold">FLIGHT:</span>{" "}
                          {booking.return_flight_number}
                        </div>
                      ) : null}

                      {isSummary && booking.notes ? (
                        <div>
                          <span className="font-semibold">NOTES:</span>{" "}
                          <span className="whitespace-pre-line">{booking.notes}</span>
                        </div>
                      ) : null}

                    </div>
                  </td>

                  {!isSummary && (
                    <td className="py-4 text-right align-top">
                      £{Number(booking.fare || 0).toFixed(2)}
                    </td>
                  )}

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isSummary && <div className="mb-10 text-xl font-bold">
          {isReceipt
            ? `Total Price Paid: £${total.toFixed(2)}`
            : `Total For This Invoice: £${total.toFixed(2)}`}
        </div>}

        {!isReceipt && !isSummary && (
          <div className="mb-10 text-sm">
            <div>Please make payment to</div>
            <div>Monzo Business Account</div>
            <div>Account Name: My Way Cars Ltd</div>
            <div>Account Number: 45791393</div>
            <div>Sort Code: 04-00-03</div>
          </div>
        )}

        <div className="mb-10 italic">
          {isSummary
            ? "Please check these journey details and contact My Way Cars if anything needs changing."
            : "Thank you for choosing My Way Cars"}
        </div>

        <button
          onClick={() => window.print()}
          className="w-full rounded-xl bg-black py-3 text-white print:hidden"
        >
          {isSummary ? "Print or Save as PDF" : "Print"}
        </button>

      </div>
    </main>
  );
}
export default function MultiReceiptPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MultiReceiptContent />
    </Suspense>
  );
}
