"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

type FormState = {
  businessName: string;
  contactName: string;
  contactPhone: string;
  address: string;
  licenceNumber: string;
  licensingAuthority: string;
};

const emptyForm: FormState = {
  businessName: "",
  contactName: "",
  contactPhone: "",
  address: "",
  licenceNumber: "",
  licensingAuthority: "",
};

export default function OperatorOnboardingPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [form, setForm] = useState(emptyForm);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        router.replace("/operator-login?next=/operator-onboarding");
        return;
      }
      const metadata = data.user.user_metadata ?? {};
      setForm({
        businessName: String(metadata.pending_business_name ?? ""),
        contactName: String(metadata.pending_contact_name ?? ""),
        contactPhone: String(metadata.pending_contact_phone ?? ""),
        address: String(metadata.pending_address ?? ""),
        licenceNumber: String(metadata.pending_licence_number ?? ""),
        licensingAuthority: String(metadata.pending_licensing_authority ?? ""),
      });
      setReady(true);
    }
    void load();
    return () => { active = false; };
  }, [router, supabase]);

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function provision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/operator-login?next=/operator-onboarding");
        return;
      }

      const response = await fetch("/api/operator-onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.error || "Business setup could not be completed.");
        return;
      }

      router.replace("/business-setup?welcome=1");
      router.refresh();
    } catch {
      setErrorMessage("Business setup is temporarily unavailable. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
          Checking your verified account…
        </div>
      </main>
    );
  }

  const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base";
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <form onSubmit={provision} className="mx-auto w-full max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finish business setup</h1>
          <p className="mt-1 text-sm text-slate-600">
            Check these details carefully. Your secure business workspace and 30-day trial will be created together.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">Business or trading name<input required maxLength={120} className={fieldClass} value={form.businessName} onChange={(e) => update("businessName", e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-800">Your name<input required maxLength={120} className={fieldClass} value={form.contactName} onChange={(e) => update("contactName", e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-800">Contact phone<input required maxLength={40} className={fieldClass} value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">Business address<textarea required maxLength={500} rows={3} className={fieldClass} value={form.address} onChange={(e) => update("address", e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-800">Operator licence number<input required maxLength={80} className={fieldClass} value={form.licenceNumber} onChange={(e) => update("licenceNumber", e.target.value)} /></label>
          <label className="block text-sm font-medium text-slate-800">Licensing authority<input required maxLength={120} className={fieldClass} value={form.licensingAuthority} onChange={(e) => update("licensingAuthority", e.target.value)} /></label>
        </div>
        {errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>}
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-60">
          {saving ? "Creating secure workspace…" : "Create my business workspace"}
        </button>
      </form>
    </main>
  );
}
