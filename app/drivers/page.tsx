"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

const supabase = getSupabase();

type DriverRow = {
  id: string;
  name?: string | null;
  driver_phone?: string | null;
  default_vehicle?: string | null;
  default_authority?: string | null;
  current_vehicle?: string | null;
  current_authority?: string | null;
  active?: boolean | null;
};

type DriverDraft = {
  name: string;
  driver_phone: string;
  default_vehicle: string;
  default_authority: string;
  active: boolean;
};

const emptyDraft: DriverDraft = {
  name: "",
  driver_phone: "",
  default_vehicle: "",
  default_authority: "",
  active: true,
};

function draftFromDriver(driver: DriverRow): DriverDraft {
  return {
    name: driver.name ?? "",
    driver_phone: driver.driver_phone ?? "",
    default_vehicle: driver.default_vehicle ?? "",
    default_authority: driver.default_authority ?? "",
    active: driver.active !== false,
  };
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DriverDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  async function fetchDrivers() {
    return supabase
      .from("drivers")
      .select(
        "id, name, driver_phone, default_vehicle, default_authority, current_vehicle, current_authority, active"
      )
      .order("name", { ascending: true })
      .limit(500);
  }

  async function loadDrivers() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await fetchDrivers();

    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    setDrivers((data as DriverRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void fetchDrivers().then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
      } else {
        setDrivers((data as DriverRow[]) ?? []);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDrivers = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return drivers.filter((driver) => {
      if (!showInactive && driver.active === false) return false;

      if (!needle) return true;

      return [
        driver.name,
        driver.driver_phone,
        driver.default_vehicle,
        driver.default_authority,
        driver.current_vehicle,
        driver.current_authority,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [drivers, search, showInactive]);

  const inactiveCount = useMemo(
    () => drivers.filter((driver) => driver.active === false).length,
    [drivers]
  );

  function updateDraft(field: keyof DriverDraft, value: string | boolean) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSavedMessage("");
  }

  function beginAdd() {
    setEditingId(null);
    setDraft(emptyDraft);
    setSavedMessage("");
    setShowAddForm(true);
  }

  function beginEdit(driver: DriverRow) {
    setShowAddForm(false);
    setEditingId(driver.id);
    setDraft(draftFromDriver(driver));
    setSavedMessage("");
  }

  function cancelEditing() {
    setShowAddForm(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function saveDriver() {
    if (saving) return;

    const driverName = draft.name.trim();
    if (!driverName) {
      alert("Enter the driver's name before saving.");
      return;
    }

    const duplicate = drivers.find(
      (driver) =>
        driver.id !== editingId &&
        driver.name?.trim().toLowerCase() === driverName.toLowerCase()
    );

    if (duplicate) {
      alert(
        "A driver with this name already exists. Edit the existing driver instead."
      );
      return;
    }

    const payload = {
      name: driverName,
      driver_phone: draft.driver_phone.trim() || null,
      default_vehicle: draft.default_vehicle.trim() || null,
      default_authority: draft.default_authority.trim() || null,
      active: draft.active,
    };

    const existingDriver = editingId
      ? drivers.find((driver) => driver.id === editingId) ?? null
      : null;
    const previousName = existingDriver?.name?.trim() ?? "";

    setSaving(true);

    const result = editingId
      ? await supabase.from("drivers").update(payload as never).eq("id", editingId)
      : await supabase.from("drivers").insert(payload as never);

    if (result.error) {
      alert(`Could not save the driver: ${result.error.message}`);
      setSaving(false);
      return;
    }

    if (
      editingId &&
      previousName &&
      previousName.toLowerCase() !== driverName.toLowerCase()
    ) {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({ driver_name: driverName } as never)
        .eq("driver_name", previousName);

      if (bookingUpdateError) {
        alert(
          `The driver was saved, but existing bookings could not be renamed: ${bookingUpdateError.message}`
        );
      }
    }

    setSaving(false);
    cancelEditing();
    setSavedMessage(`${driverName} saved successfully.`);
    await loadDrivers();
  }

  function driverForm(title: string) {
    return (
      <section className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Driver name
            <input
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="Full name"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Driver phone
            <input
              value={draft.driver_phone}
              onChange={(event) =>
                updateDraft("driver_phone", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. 07700 900000"
              inputMode="tel"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Usual vehicle
            <input
              value={draft.default_vehicle}
              onChange={(event) =>
                updateDraft("default_vehicle", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. Skoda Superb"
            />
          </label>

          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Usual licensing authority
            <input
              value={draft.default_authority}
              onChange={(event) =>
                updateDraft("default_authority", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="e.g. West Berkshire"
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => updateDraft("active", event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Available for booking assignment
              </span>
              <span className="mt-1 block text-sm font-normal text-slate-600">
                Turn this off to hide the driver from new bookings without
                deleting their history.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveDriver()}
            disabled={saving}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save driver"}
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
              <h1 className="text-2xl font-bold text-slate-900">Drivers</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage the drivers offered when bookings are assigned.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={beginAdd}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add driver
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

        {showAddForm && driverForm("Add driver")}

        {savedMessage && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
            {savedMessage}
          </div>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-medium text-slate-700">
            Search drivers
          </label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
            placeholder="Name, phone, vehicle or licensing authority"
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Show inactive drivers ({inactiveCount})
          </label>
          <div className="mt-2 text-sm text-slate-500">
            Showing {filteredDrivers.length} driver
            {filteredDrivers.length === 1 ? "" : "s"}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
            Loading drivers…
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800">
            Could not load drivers: {loadError}
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-slate-600 shadow-sm">
            No matching drivers found.
          </div>
        ) : (
          <section className="space-y-3">
            {filteredDrivers.map((driver) =>
              editingId === driver.id ? (
                <div key={driver.id}>
                  {driverForm(`Edit ${driver.name || "driver"}`)}
                </div>
              ) : (
                <article
                  key={driver.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${
                    driver.active === false
                      ? "border-slate-300 opacity-70"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">
                          {driver.name || "Unnamed driver"}
                        </h2>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            driver.active === false
                              ? "bg-slate-200 text-slate-700"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {driver.active === false ? "Inactive" : "Active"}
                        </span>
                      </div>
                      {driver.driver_phone && (
                        <div className="mt-1 text-sm text-slate-600">
                          Phone: {driver.driver_phone}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                          <strong>Usual vehicle:</strong>{" "}
                          {driver.default_vehicle || "Not set"}
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                          <strong>Licensing authority:</strong>{" "}
                          {driver.default_authority || "Not set"}
                        </div>
                      </div>
                      {(driver.current_vehicle || driver.current_authority) && (
                        <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                          Current override: {driver.current_vehicle || "No vehicle"}
                          {driver.current_authority
                            ? ` · ${driver.current_authority}`
                            : ""}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => beginEdit(driver)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Edit driver
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
