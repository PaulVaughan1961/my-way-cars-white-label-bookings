"use client";

import Image from "next/image";


import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

export default function ReceiptPage() {
  const params = useParams();
  const id = params?.id as string;

  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", id)
        .single();

      setBooking(data);
    }

    if (id) load();
  }, [id]);

  if (!booking) return <div className="p-6">Loading...</div>;

const isReceipt = booking.payment_status === "Paid";

const documentNumber = isReceipt
  ? `R-${booking.id.slice(0, 8)}`
  : `INV-${booking.id.slice(0, 8)}`;

const issueDate = new Date().toLocaleDateString("en-GB");

const journeyLine = `${booking.pickup_address} → ${booking.dropoff_address}`;

  return (
<main className="min-h-screen bg-white p-6">
  <div className="mx-auto max-w-3xl bg-white p-10">

    <div className="flex justify-between items-start mb-10">
      <div>
        <h1 className="text-4xl font-bold text-purple-700">
          MY WAY CARS
        </h1>
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

    <h2 className="text-3xl font-semibold mb-8">
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
      <div className="font-semibold mb-2">
        {isReceipt ? "Customer:" : "Bill To:"}
      </div>

      <div>{booking.passenger_name}</div>
    </div>

    <div className="mb-8">
      <div className="font-semibold mb-2">
        Journeys
      </div>

      <div>{journeyLine}</div>

      <div>{booking.pickup_datetime}</div>
    </div>

    <div className="mb-10 text-xl font-bold">
      {isReceipt
        ? `Total Price Paid: £${Number(
            booking.fare || 0
          ).toFixed(2)}`
        : `Total For This Invoice: £${Number(
            booking.fare || 0
          ).toFixed(2)}`}
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

    <div className="italic mb-10">
      Thank you for choosing My Way Cars
    </div>

    <button
      onClick={() => window.print()}
      className="w-full bg-black text-white py-3 rounded-xl print:hidden"
    >
      Print
    </button>

  </div>
</main>
  );
}