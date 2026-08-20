"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getNonResidentialReason } from "@/lib/addressClassification";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

type CustomerRow = {
  id: string;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  home_address?: string | null;
  account_name?: string | null;
  last_booking_at?: string | null;
};

type AddressFilter = "all" | "review" | "missing";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AddressFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAddress, setDraftAddress] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, passenger_name, passenger_phone, home_address, account_name, last_booking_at"
        )
        .order("passenger_name", { ascending: true })
        .limit(1000);

      if (error) {
        setLoadError(error.message);
        setLoading(false);
        return;
      }

      setCustomers((data as CustomerRow[]) ?? []);
      setLoading(false);
    }

    void loadCustomers();
  }, []);

  const reviewCount = useMemo(
    () =>
      customers.filter((customer) =>
        getNonResidentialReason(customer.home_address ?? "")
      ).length,
    [customers]
  );

  const missingCount = useMemo(
    () =>
      customers.filter((customer) => !customer.home_address?.trim()).length,
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const reason = getNonResidentialReason(customer.home_address ?? "");
      const missing = !customer.home_address?.trim();

      if (filter === "review" && !reason) return false;
      if (filter === "missing" && !missing) return false;

      if (!needle) return true;

      return [
        customer.passenger_name,
        customer.passenger_phone,
        customer.home_address,
        customer.account_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [customers, filter, search]);

  function beginEditing(customer: CustomerRow) {
    setEditingId(customer.id);
    setDraftAddress(customer.home_address ?? "");
    setSavedId(null);
  }

  async function saveAddress(customer: CustomerRow) {
    if (savingId) return;

    setSavingId(customer.id);
    setSavedId(null);

    const newAddress = draftAddress.trim();
    const { error } = await supabase
      .from("customers")
      .update({ home_address: newAddress || null } as never)
      .eq("id", customer.id);

    if (error) {
      alert(`Could not update the customer address: ${error.message}`);
      setSavingId(null);
      return;
    }

    setCustomers((current) =>
      current.map((item) =>
        item.id === customer.id
          ? { ...item, home_address: newAddress || null }
          : item
      )
    );
    setEditingId(null);
    setSavingId(null);
    setSavedId(customer.id);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Customer addresses
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Review and correct the saved home address used for future
                bookings and invoices.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-900"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              filter === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="text-sm opacity-75">All customers</div>
            <div className="text-2xl font-bold">{customers.length}</div>
          </button>
          <button
            type="button"
            onClick={() => setFilter("review")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              filter === "review"
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <div className="text-sm opacity-80">Possible wrong address</div>
            <div className="text-2xl font-bold">{reviewCount}</div>
          </button>
          <button
            type="button"
            onClick={() => setFilter("missing")}
            className={`rounded-2xl border p-4 text-left shadow-sm ${
              filter === "missing"
                ? "border-rose-600 bg-rose-600 text-white"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            <div className="text-sm opacity-80">No home address</div>
            <div className="text-2xl font-bold">{missingCount}</div>
          </button>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-slate-700">
            Search customers
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone number, account or address"
          />
          <div className="mt-2 text-sm text-slate-500">
            Showing {filteredCustomers.length} customer
            {filteredCustomers.length === 1 ? "" : "s"}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
            Loading customers…
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
            Could not load customers: {loadError}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
            No matching customers found.
          </div>
        ) : (
          <section className="space-y-3">
            {filteredCustomers.map((customer) => {
              const reason = getNonResidentialReason(
                customer.home_address ?? ""
              );
              const isEditing = editingId === customer.id;

              return (
                <article
                  key={customer.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${
                    reason ? "border-amber-300" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-900">
                        {customer.passenger_name || "Unnamed customer"}
                      </h2>
                      {customer.passenger_phone && (
                        <div className="text-sm text-slate-600">
                          {customer.passenger_phone}
                        </div>
                      )}
                      {customer.account_name && (
                        <div className="mt-1 text-sm font-medium text-blue-700">
                          Account: {customer.account_name}
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => beginEditing(customer)}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                      >
                        Correct address
                      </button>
                    )}
                  </div>

                  {reason && !isEditing && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>Check this address:</strong> it looks like {reason},
                      not a home address.
                    </div>
                  )}

                  {savedId === customer.id && !isEditing && (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                      Address saved successfully.
                    </div>
                  )}

                  {isEditing ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                      <label className="text-sm font-medium text-slate-700">
                        Correct home address
                      </label>
                      <textarea
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:ring-2 focus:ring-slate-300"
                        value={draftAddress}
                        onChange={(event) => setDraftAddress(event.target.value)}
                        rows={3}
                        placeholder="Enter the customer's actual home address"
                      />

                      {getNonResidentialReason(draftAddress) && (
                        <div className="mt-2 text-sm text-amber-700">
                          This still looks like{" "}
                          {getNonResidentialReason(draftAddress)}. Check it before
                          saving.
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveAddress(customer)}
                          disabled={savingId === customer.id}
                          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                        >
                          {savingId === customer.id
                            ? "Saving…"
                            : "Save home address"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setDraftAddress("");
                          }}
                          disabled={savingId === customer.id}
                          className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Saved home address
                      </div>
                      <div
                        className={`mt-1 whitespace-pre-line ${
                          customer.home_address?.trim()
                            ? "text-slate-900"
                            : "font-medium text-rose-700"
                        }`}
                      >
                        {customer.home_address?.trim() ||
                          "No home address saved"}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
