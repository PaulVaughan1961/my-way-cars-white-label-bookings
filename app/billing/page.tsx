"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

type BillingDocument = {
  id: string;
  document_type: "invoice" | "receipt";
  document_number: string;
  status: "created" | "sent" | "void" | "superseded";
  payment_status: "unpaid" | "part_paid" | "paid";
  issue_date: string;
  total_amount: number;
  sent_at: string | null;
  paid_at: string | null;
};

type DocumentBooking = {
  document_id: string;
  booking_id: string;
  line_position: number;
};

type Booking = {
  id: string;
  passenger_name: string | null;
  pickup_datetime: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  fare: number | string | null;
  status: string | null;
  payment_status: string | null;
};

type Filter =
  | "all"
  | "created"
  | "sent"
  | "unpaid"
  | "paid"
  | "receipts-needed";

export default function BillingPage() {
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [links, setLinks] = useState<DocumentBooking[]>([]);
  const [paidBookings, setPaidBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const [
          { data: documentData, error: documentError },
          { data: linkData, error: linkError },
          { data: bookingData, error: bookingError },
        ] = await Promise.all([
          supabase
            .from("billing_documents")
            .select(
              "id, document_type, document_number, status, payment_status, issue_date, total_amount, sent_at, paid_at"
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("billing_document_bookings")
            .select("document_id, booking_id, line_position"),

          supabase
            .from("bookings")
            .select(
              "id, passenger_name, pickup_datetime, pickup_address, dropoff_address, fare, status, payment_status"
            )
            .eq("payment_status", "Paid")
            .order("pickup_datetime", { ascending: false }),
        ]);

        if (documentError) throw documentError;
        if (linkError) throw linkError;
        if (bookingError) throw bookingError;

        setDocuments((documentData || []) as BillingDocument[]);
        setLinks((linkData || []) as DocumentBooking[]);
        setPaidBookings((bookingData || []) as Booking[]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load billing information."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const bookingIdsByDocument = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const row of [...links].sort(
      (a, b) => a.line_position - b.line_position
    )) {
      const existing = map.get(row.document_id) || [];
      existing.push(row.booking_id);
      map.set(row.document_id, existing);
    }

    return map;
  }, [links]);

  const activeReceiptBookingSets = useMemo(() => {
    const sets = new Set<string>();

    for (const document of documents) {
      if (
        document.document_type !== "receipt" ||
        document.status === "void" ||
        document.status === "superseded"
      ) {
        continue;
      }

      const ids = bookingIdsByDocument.get(document.id) || [];

      if (ids.length > 0) {
        sets.add([...ids].sort().join(","));
      }
    }

    return sets;
  }, [documents, bookingIdsByDocument]);

  const paidBookingsNeedingReceipt = useMemo(
    () =>
      documents.filter((document) => {
        if (
          document.document_type !== "invoice" ||
          document.payment_status !== "paid" ||
          document.status === "void" ||
          document.status === "superseded"
        ) {
          return false;
        }

        const ids = bookingIdsByDocument.get(document.id) || [];

        if (ids.length === 0) return false;

        return !activeReceiptBookingSets.has(
          [...ids].sort().join(",")
        );
      }),
    [documents, bookingIdsByDocument, activeReceiptBookingSets]
  );

  const activeDocuments = useMemo(
    () =>
      documents.filter(
        (doc) => doc.status !== "void" && doc.status !== "superseded"
      ),
    [documents]
  );

  const visibleDocuments = useMemo(() => {
    if (filter === "receipts-needed") return [];

    if (filter === "created") {
      return activeDocuments.filter((doc) => doc.status === "created");
    }

    if (filter === "sent") {
      return activeDocuments.filter((doc) => doc.status === "sent");
    }

    if (filter === "unpaid") {
      return activeDocuments.filter(
        (doc) =>
          doc.document_type === "invoice" &&
          doc.payment_status !== "paid"
      );
    }

    if (filter === "paid") {
      return activeDocuments.filter(
        (doc) =>
          doc.document_type === "invoice" &&
          doc.payment_status === "paid"
      );
    }

    return activeDocuments;
  }, [activeDocuments, filter]);

  const counts = {
    created: activeDocuments.filter((doc) => doc.status === "created").length,
    sent: activeDocuments.filter((doc) => doc.status === "sent").length,
    unpaid: activeDocuments.filter(
      (doc) =>
        doc.document_type === "invoice" &&
        doc.payment_status !== "paid"
    ).length,
    paid: activeDocuments.filter(
      (doc) =>
        doc.document_type === "invoice" &&
        doc.payment_status === "paid"
    ).length,
    receiptsNeeded: paidBookingsNeedingReceipt.length,
  };

  function documentUrl(document: BillingDocument) {
    const ids = bookingIdsByDocument.get(document.id) || [];

    return `/receipt-multi?ids=${encodeURIComponent(
      ids.join(",")
    )}&type=${document.document_type}`;
  }

  function money(value: number | string | null | undefined) {
    return `£${Number(value || 0).toFixed(2)}`;
  }

  if (loading) {
    return <main className="p-6">Loading billing...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
            <p className="mt-1 text-sm text-slate-600">
              Track invoices, receipts and payment status.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white"
          >
            Back to dashboard
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <button
            onClick={() => setFilter("created")}
            className="rounded-2xl border bg-white p-4 text-left shadow-sm"
          >
            <div className="text-sm text-slate-500">Created</div>
            <div className="mt-1 text-3xl font-bold">{counts.created}</div>
          </button>

          <button
            onClick={() => setFilter("sent")}
            className="rounded-2xl border bg-white p-4 text-left shadow-sm"
          >
            <div className="text-sm text-slate-500">Sent</div>
            <div className="mt-1 text-3xl font-bold">{counts.sent}</div>
          </button>

          <button
            onClick={() => setFilter("unpaid")}
            className="rounded-2xl border bg-white p-4 text-left shadow-sm"
          >
            <div className="text-sm text-slate-500">Unpaid invoices</div>
            <div className="mt-1 text-3xl font-bold">{counts.unpaid}</div>
          </button>

          <button
            onClick={() => setFilter("paid")}
            className="rounded-2xl border bg-white p-4 text-left shadow-sm"
          >
            <div className="text-sm text-slate-500">Paid invoices</div>
            <div className="mt-1 text-3xl font-bold">{counts.paid}</div>
          </button>

          <button
            onClick={() => setFilter("receipts-needed")}
            className="rounded-2xl border bg-white p-4 text-left shadow-sm"
          >
            <div className="text-sm text-slate-500">Receipts needed</div>
            <div className="mt-1 text-3xl font-bold">
              {counts.receiptsNeeded}
            </div>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              filter === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-800"
            }`}
          >
            All documents
          </button>
        </div>

        {filter === "receipts-needed" ? (
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">
              Paid invoices needing a receipt
            </h2>

            {paidBookingsNeedingReceipt.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                No paid invoices currently need a receipt.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {paidBookingsNeedingReceipt.map((invoice) => {
                  const ids = bookingIdsByDocument.get(invoice.id) || [];

                  return (
                    <div
                      key={invoice.id}
                      className="rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            {invoice.document_number}
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            Paid invoice
                            {" · "}
                            {ids.length} booking
                            {ids.length === 1 ? "" : "s"}
                          </div>

                          <div className="mt-2 font-semibold">
                            {money(invoice.total_amount)}
                          </div>
                        </div>

                        <Link
                          href={`/receipt-multi?ids=${encodeURIComponent(
                            ids.join(",")
                          )}&type=receipt`}
                          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white"
                        >
                          Create receipt
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                {filter === "all"
                  ? "Billing documents"
                  : filter === "created"
                  ? "Created documents"
                  : filter === "sent"
                  ? "Sent documents"
                  : filter === "unpaid"
                  ? "Unpaid invoices"
                  : "Paid invoices"}
              </h2>

              <div className="text-sm text-slate-500">
                {visibleDocuments.length} document
                {visibleDocuments.length === 1 ? "" : "s"}
              </div>
            </div>

            {visibleDocuments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                No billing documents in this category.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleDocuments.map((document) => {
                  const ids = bookingIdsByDocument.get(document.id) || [];

                  return (
                    <div
                      key={document.id}
                      className="rounded-2xl border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-lg font-bold">
                            {document.document_number}
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            {document.document_type === "invoice"
                              ? "Invoice"
                              : "Receipt"}
                            {" · "}
                            {new Date(
                              `${document.issue_date}T00:00:00`
                            ).toLocaleDateString("en-GB")}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {document.status === "sent"
                                ? "Sent"
                                : "Created"}
                            </span>

                            {document.document_type === "invoice" ? (
                              <span
                                className={`rounded-full px-3 py-1 ${
                                  document.payment_status === "paid"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {document.payment_status === "paid"
                                  ? "Paid"
                                  : document.payment_status === "part_paid"
                                  ? "Part paid"
                                  : "Unpaid"}
                              </span>
                            ) : null}

                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {ids.length} booking
                              {ids.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="mt-3 text-lg font-semibold">
                            {money(document.total_amount)}
                          </div>
                        </div>

                        {ids.length > 0 ? (
                          <Link
                            href={documentUrl(document)}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                          >
                            Open
                          </Link>
                        ) : (
                          <span className="text-sm text-red-600">
                            No linked booking
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
