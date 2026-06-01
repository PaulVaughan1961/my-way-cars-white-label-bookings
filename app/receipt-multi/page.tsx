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

  useEffect(() => {
    async function load() {
      const ids = idsParam
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      if (ids.length === 0) return;

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .in("id", ids);

      setBookings(data || []);
    }

    load();
  }, [idsParam]);

  if (bookings.length === 0) {
    return <div className="p-6">Loading...</div>;
  }

  const isReceipt = type === "receipt";

  const documentNumber = `${isReceipt ? "R" : "INV"}-${Date.now()}`;

  const issueDate = new Date().toLocaleDateString("en-GB");

const accountName = bookings.find(
  (b) => b.account_name
)?.account_name;

const billTo =
  accountName ||
  bookings[0].passenger_name ||
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
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-5xl bg-white p-10">

        <div className="mb-10 flex items-start justify-between">
          <div>
            <Image
              src="/logo.png"
              alt="My Way Cars"
              width={300}
              height={100}
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

        <h2 className="mb-8 text-3xl font-semibold">
          {isReceipt ? "Receipt" : "Invoice"}
        </h2>

        <div className="mb-6">
          <div>
            <strong>
              {isReceipt ? "Receipt #" : "Invoice #"}
            </strong>{" "}
            {documentNumber}
          </div>

          <div>
            <strong>Date Issued:</strong> {issueDate}
          </div>
        </div>

        <div className="mb-8">
          <div className="mb-2 font-semibold">
            {isReceipt ? "Customer:" : "Bill To:"}
          </div>

          <div>{billTo}</div>
        </div>

        <div className="mb-8">
          <div className="mb-4 font-semibold">
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

    <th className="py-2 text-right w-28">
      Fare
    </th>
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
    {booking.passenger_name}
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

                    </div>
                  </td>

                  <td className="py-4 text-right align-top">
                    £{Number(
                      booking.fare || 0
                    ).toFixed(2)}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-10 text-xl font-bold">
          {isReceipt
            ? `Total Price Paid: £${total.toFixed(2)}`
            : `Total For This Invoice: £${total.toFixed(2)}`}
        </div>

        {!isReceipt && (
          <div className="mb-10 text-sm">
            <div>Please make payment to</div>
            <div>Monzo Business Account</div>
            <div>Account Name: My Way Cars Ltd</div>
            <div>Account Number: 45791393</div>
            <div>Sort Code: 04-00-03</div>
          </div>
        )}

        <div className="mb-10 italic">
          Thank you for choosing My Way Cars
        </div>

        <button
          onClick={() => window.print()}
          className="w-full rounded-xl bg-black py-3 text-white print:hidden"
        >
          Print
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