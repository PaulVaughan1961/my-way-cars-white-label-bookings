"use client";

export const dynamic = "force-dynamic";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import {
  isMyWayCarsBusiness,
  loadBusinessName,
} from "@/lib/businessBranding";

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
const [businessName, setBusinessName] = useState("Your operator");
const [billingDocument, setBillingDocument] = useState<any>(null);
const [documentError, setDocumentError] = useState("");
const [updatingDocument, setUpdatingDocument] = useState(false);
const [summaryReference] = useState(() => `BOOK-${Date.now()}`);

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

    const loadedBusinessName = await loadBusinessName(
      supabase,
      "Your operator"
    );
    setBusinessName(loadedBusinessName);
    setBookings(bookingsLoaded);

    if (type === "invoice" || type === "receipt") {
      setBillingDocument(null);
      setDocumentError("");

      const { data: documentData, error: documentRpcError } =
        await (supabase as any)
          .rpc("get_or_create_billing_document", {
            requested_type: type,
            requested_booking_ids: ids,
          })
          .maybeSingle();

      if (documentRpcError || !documentData) {
        setDocumentError(
          documentRpcError?.message ||
            "Unable to create or load this billing document."
        );
        return;
      }

      const { data: storedDocument, error: storedDocumentError } =
        await supabase
          .from("billing_documents")
          .select(
            "id, document_number, issue_date, status, payment_status, total_amount, sent_at, paid_at, payment_method, document_snapshot"
          )
          .eq("id", documentData.document_id)
          .single();

      if (storedDocumentError || !storedDocument) {
        setDocumentError(
          storedDocumentError?.message ||
            "Unable to load the saved billing document."
        );
        return;
      }

      const frozenDocumentSnapshot =
        storedDocument.document_snapshot &&
        typeof storedDocument.document_snapshot === "object"
          ? (storedDocument.document_snapshot as any)
          : null;

      if (storedDocument.status === "sent") {
        const { data: frozenRows, error: frozenRowsError } =
          await supabase
            .from("billing_document_bookings")
            .select("line_position, booking_snapshot")
            .eq("document_id", storedDocument.id)
            .order("line_position", { ascending: true });

        if (frozenRowsError) {
          setDocumentError(
            frozenRowsError.message ||
              "Unable to load the frozen billing document."
          );
          return;
        }

        const frozenBookings = (frozenRows || [])
          .map((row: any) => row.booking_snapshot)
          .filter(Boolean);

        if (frozenBookings.length === 0) {
          setDocumentError(
            "This sent billing document has no frozen booking snapshot."
          );
          return;
        }

        setBookings(frozenBookings);

        if (frozenDocumentSnapshot?.business_name) {
          setBusinessName(frozenDocumentSnapshot.business_name);
        }

        setAccount(
          frozenDocumentSnapshot?.bill_to_name ||
          frozenDocumentSnapshot?.bill_to_address
            ? {
                account_name:
                  frozenDocumentSnapshot?.bill_to_name || null,
                address:
                  frozenDocumentSnapshot?.bill_to_address || null,
              }
            : null
        );

        setCustomer(
          frozenDocumentSnapshot?.bill_to_address
            ? {
                home_address:
                  frozenDocumentSnapshot.bill_to_address,
              }
            : null
        );

        setBillingDocument({
          ...storedDocument,
          document_id: storedDocument.id,
          document_status: storedDocument.status,
        });

        return;
      }

      setBillingDocument({
        ...storedDocument,
        document_id: storedDocument.id,
        document_status: storedDocument.status,
      });
    }
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
}, [idsParam, type]);

if (bookings.length === 0) {
  return <div className="p-6">Loading...</div>;
}

const isReceipt = type === "receipt";
const isSummary = type === "summary";

if (!isSummary && documentError) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
        <div className="font-semibold">Document could not be loaded</div>
        <div className="mt-2 text-sm">{documentError}</div>
      </div>
    </div>
  );
}

if (!isSummary && !billingDocument) {
  return <div className="p-6">Loading document...</div>;
}

async function markDocumentSent() {
  if (!billingDocument?.document_id || updatingDocument) return;

  const ok = window.confirm(
    `Mark this ${isReceipt ? "receipt" : "invoice"} as sent?`
  );

  if (!ok) return;

  setUpdatingDocument(true);

  try {
    const documentSnapshot = {
      business_name: businessName,
      bill_to_name: account?.account_name || billTo,
      bill_to_address:
        account?.address || customer?.home_address || null,
      show_passengers: showPassengers,
      issuer: isMyWayCars
        ? {
            name: businessName,
            address: [
              "8 Kennet House",
              "19 The High Street",
              "Hungerford RG17 0NL",
            ],
            phone: "07792042081",
            email: "hello@mywaycars.co.uk",
            website: "www.mywaycars.co.uk",
          }
        : {
            name: businessName,
          },
      payment_details:
        !isReceipt && isMyWayCars
          ? {
              bank: "Monzo Business Account",
              account_name: "My Way Cars Ltd",
              account_number: "45791393",
              sort_code: "04-00-03",
            }
          : null,
    };

    const { data, error } = await supabase.rpc(
      "mark_billing_document_sent",
      {
        requested_document_id: billingDocument.document_id,
        requested_document_snapshot: documentSnapshot,
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      throw new Error("No document was returned after marking it sent.");
    }

    setBillingDocument((current: any) => ({
      ...current,
      document_status: result.document_status,
      status: result.document_status,
      sent_at: result.document_sent_at,
      total_amount: result.document_total_amount,
      document_snapshot: result.frozen_snapshot,
    }));
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : "Unable to mark this document as sent."
    );
  } finally {
    setUpdatingDocument(false);
  }
}

async function markDocumentPaid() {
  if (!billingDocument?.document_id || updatingDocument) return;

  const ok = window.confirm(
    "Mark this invoice and its linked booking(s) as paid?"
  );

  if (!ok) return;

  setUpdatingDocument(true);

  try {
    const { data, error } = await (supabase as any)
      .rpc("mark_billing_document_paid", {
        requested_document_id: billingDocument.document_id,
      })
      .maybeSingle();

    if (error || !data) {
      throw error || new Error("Unable to mark invoice as paid.");
    }

    setBillingDocument((current: any) => ({
      ...current,
      payment_status: data.payment_status,
      paid_at: data.paid_at,
    }));
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : "Unable to mark invoice as paid."
    );
  } finally {
    setUpdatingDocument(false);
  }
}

const documentNumber = isSummary
  ? summaryReference
  : billingDocument.document_number;

const issueDate = isSummary
  ? new Date().toLocaleDateString("en-GB")
  : new Date(
      `${billingDocument.issue_date}T00:00:00`
    ).toLocaleDateString("en-GB");

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
const isMyWayCars = isMyWayCarsBusiness(businessName);

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
{isMyWayCars ? (
  <Image
    src="/logo.png"
    alt={businessName}
    width={180}
    height={60}
    priority
  />
) : null}
          </div>

          <div className="text-right text-sm">
            <div>{businessName.toUpperCase()}</div>
            {isMyWayCars ? (
              <>
                <div>8 Kennet House</div>
                <div>19 The High Street</div>
                <div>Hungerford RG17 0NL</div>
                <div>07792042081</div>
                <div>hello@mywaycars.co.uk</div>
                <div>www.mywaycars.co.uk</div>
              </>
            ) : null}
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

          {!isSummary ? (
            <div className="mt-2 print:hidden">
              <strong>Status:</strong>{" "}
              <span
                className={
                  billingDocument.document_status === "sent"
                    ? "font-semibold text-green-700"
                    : "font-semibold text-amber-700"
                }
              >
                {billingDocument.document_status === "sent"
                  ? "Sent"
                  : "Created"}
              </span>

              {billingDocument.sent_at ? (
                <span className="ml-2 text-gray-600">
                  {new Date(billingDocument.sent_at).toLocaleString("en-GB")}
                </span>
              ) : null}
            </div>
          ) : null}

          {!isSummary ? (
            <div className="mt-2 print:hidden">
              <strong>Payment:</strong>{" "}
              <span
                className={
                  billingDocument.payment_status === "paid"
                    ? "font-semibold text-green-700"
                    : "font-semibold text-red-700"
                }
              >
                {billingDocument.payment_status === "paid"
                  ? "Paid"
                  : "Unpaid"}
              </span>
            </div>
          ) : null}
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
        <div>Passengers: {booking.passengers ?? "â€”"}</div>
        <div>Large bags: {booking.bags_large ?? "â€”"}</div>
        <div>Small bags: {booking.bags_small ?? "â€”"}</div>
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
            {isMyWayCars ? (
              <>
                <div>Monzo Business Account</div>
                <div>Account Name: My Way Cars Ltd</div>
                <div>Account Number: 45791393</div>
                <div>Sort Code: 04-00-03</div>
              </>
            ) : (
              <div>Please contact {businessName} for payment details.</div>
            )}
          </div>
        )}

        <div className="mb-10 italic">
          {isSummary
            ? `Please check these journey details and contact ${businessName} if anything needs changing.`
            : `Thank you for choosing ${businessName}`}
        </div>

        <div className="flex gap-3 print:hidden">
          {!isSummary &&
          !isReceipt &&
          billingDocument.payment_status !== "paid" ? (
            <button
              onClick={markDocumentPaid}
              disabled={updatingDocument}
              className="flex-1 rounded-xl bg-blue-700 py-3 text-white disabled:opacity-50"
            >
              {updatingDocument ? "Saving..." : "Mark as Paid"}
            </button>
          ) : null}
          {!isSummary && billingDocument.document_status !== "sent" ? (
            <button
              onClick={markDocumentSent}
              disabled={updatingDocument}
              className="flex-1 rounded-xl bg-green-700 py-3 text-white disabled:opacity-50"
            >
              {updatingDocument ? "Saving..." : "Mark as Sent"}
            </button>
          ) : null}

          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl bg-black py-3 text-white"
          >
            {isSummary ? "Print or Save as PDF" : "Print"}
          </button>
        </div>

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
