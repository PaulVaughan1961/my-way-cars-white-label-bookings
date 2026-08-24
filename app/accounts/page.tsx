"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

type AccountRow = {
  id: string;
  account_name?: string | null;
  invoice_email?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  address?: string | null;
};

type AccountDraft = {
  account_name: string;
  invoice_email: string;
  contact_name: string;
  phone: string;
  address: string;
};

const emptyDraft: AccountDraft = {
  account_name: "",
  invoice_email: "",
  contact_name: "",
  phone: "",
  address: "",
};

function draftFromAccount(account: AccountRow): AccountDraft {
  return {
    account_name: account.account_name ?? "",
    invoice_email: account.invoice_email ?? "",
    contact_name: account.contact_name ?? "",
    phone: account.phone ?? "",
    address: account.address ?? "",
  };
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  async function fetchAccounts() {
    return supabase
      .from("accounts")
      .select("id, account_name, invoice_email, contact_name, phone, address")
      .order("account_name", { ascending: true })
      .limit(500);
  }

  async function loadAccounts() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await fetchAccounts();

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    setAccounts((data as AccountRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void fetchAccounts().then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
      } else {
        setAccounts((data as AccountRow[]) ?? []);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return accounts;

    return accounts.filter((account) =>
      [
        account.account_name,
        account.invoice_email,
        account.contact_name,
        account.phone,
        account.address,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [accounts, search]);

  function updateDraft(field: keyof AccountDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
  }

  function beginAdd() {
    setEditingId(null);
    setDraft(emptyDraft);
    setSavedMessage("");
    setShowAddForm(true);
  }

  function beginEdit(account: AccountRow) {
    setShowAddForm(false);
    setEditingId(account.id);
    setDraft(draftFromAccount(account));
    setSavedMessage("");
  }

  function cancelEditing() {
    setShowAddForm(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function saveAccount() {
    if (saving) return;

    const accountName = draft.account_name.trim();
    if (!accountName) {
      alert("Enter the account name before saving.");
      return;
    }

    const duplicate = accounts.find(
      (account) =>
        account.id !== editingId &&
        account.account_name?.trim().toLowerCase() === accountName.toLowerCase()
    );

    if (duplicate) {
      alert(
        "An account with this name already exists. Edit the existing account instead."
      );
      return;
    }

    const payload = {
      account_name: accountName,
      invoice_email: draft.invoice_email.trim() || null,
      contact_name: draft.contact_name.trim() || null,
      phone: draft.phone.trim() || null,
      address: draft.address.trim() || null,
    };

    setSaving(true);

    const result = editingId
      ? await supabase.from("accounts").update(payload as never).eq("id", editingId)
      : await supabase.from("accounts").insert(payload as never);

    if (result.error) {
      alert(`Could not save the account: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    cancelEditing();
    setSavedMessage(`${accountName} saved successfully.`);
    await loadAccounts();
  }

  function accountForm(title: string) {
    return (
      <section className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Account name
            <input
              value={draft.account_name}
              onChange={(event) => updateDraft("account_name", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Kynetec"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              This exact name will be used on bookings and invoices.
            </span>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Contact name
            <input
              value={draft.contact_name}
              onChange={(event) => updateDraft("contact_name", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Optional"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Phone
            <input
              value={draft.phone}
              onChange={(event) => updateDraft("phone", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Optional"
              inputMode="tel"
            />
          </label>

          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Invoice email
            <input
              value={draft.invoice_email}
              onChange={(event) => updateDraft("invoice_email", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="accounts@example.com"
              type="email"
            />
          </label>

          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Billing address
            <textarea
              value={draft.address}
              onChange={(event) => updateDraft("address", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Full address used on invoices"
              rows={4}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveAccount()}
            disabled={saving}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save account"}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={saving}
            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage the billing information used on account invoices.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={beginAdd}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add account
              </button>
              <Link
                href="/business-setup"
                className="rounded-xl bg-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-900"
              >
                Business setup
              </Link>
              <Link
                href="/dashboard"
                className="rounded-xl bg-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-900"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        {showAddForm && accountForm("Add account")}

        {savedMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            {savedMessage}
          </div>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-slate-700">
            Search accounts
          </label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="Account, contact, email, phone or address"
          />
          <div className="mt-2 text-sm text-slate-500">
            Showing {filteredAccounts.length} account
            {filteredAccounts.length === 1 ? "" : "s"}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
            Loading accounts…
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
            Could not load accounts: {loadError}
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
            No matching accounts found.
          </div>
        ) : (
          <section className="space-y-3">
            {filteredAccounts.map((account) =>
              editingId === account.id ? (
                <div key={account.id}>
                  {accountForm(`Edit ${account.account_name || "account"}`)}
                </div>
              ) : (
                <article
                  key={account.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-900">
                        {account.account_name || "Unnamed account"}
                      </h2>
                      {account.contact_name && (
                        <div className="mt-1 text-sm text-slate-700">
                          Contact: {account.contact_name}
                        </div>
                      )}
                      {account.invoice_email && (
                        <div className="text-sm text-slate-600">
                          Invoice email: {account.invoice_email}
                        </div>
                      )}
                      {account.phone && (
                        <div className="text-sm text-slate-600">
                          Phone: {account.phone}
                        </div>
                      )}
                      {account.address ? (
                        <div className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                          {account.address}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          No billing address saved.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => beginEdit(account)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Edit account
                    </button>
                  </div>
                </article>
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}
