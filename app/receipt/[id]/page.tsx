"use client";

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

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-xl border p-6 rounded-xl">

        <h1 className="text-xl font-bold mb-4">My Way Cars</h1>

        <h2 className="text-lg font-semibold mb-4">
          {booking.payment_status === "Paid" ? "Receipt" : "Invoice"}
        </h2>

        <div className="space-y-2 text-sm">
          <div><strong>Passenger:</strong> {booking.passenger_name}</div>
          <div><strong>Phone:</strong> {booking.passenger_phone}</div>

          <div className="mt-3"><strong>Journey</strong></div>

          <div>{booking.pickup_address} → {booking.dropoff_address}</div>
          <div>{booking.pickup_datetime}</div>

          <div className="mt-3">
            <strong>Driver:</strong> {booking.driver_name || "Unassigned"}
          </div>

          <div className="mt-4 text-lg font-bold">
            £{Number(booking.fare || 0).toFixed(2)}
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="mt-6 w-full bg-black text-white py-2 rounded-xl"
        >
          Print
        </button>

      </div>
    </main>
  );
}