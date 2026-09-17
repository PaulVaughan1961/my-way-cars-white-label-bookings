"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  contactName: string;
  contactPhone: string;
  address: string;
  licenceNumber: string;
  licensingAuthority: string;
};

const initialForm: FormState = {
  email: "",
  password: "",
  confirmPassword: "",
  businessName: "",
  contactName: "",
  contactPhone: "",
  address: "",
  licenceNumber: "",
  licensingAuthority: "",
};

export default function OperatorRegisterPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setErrorMessage("");

    if (form.password.length < 10) {
      setErrorMessage("Use a password containing at least 10 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const result = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/operator-login?registered=1`,
          data: {
            pending_business_name: form.businessName.trim(),
            pending_contact_name: form.contactName.trim(),
            pending_contact_phone: form.contactPhone.trim(),
            pending_address: form.address.trim(),
            pending_licence_number: form.licenceNumber.trim(),
            pending_licensing_authority: form.licensingAuthority.trim(),
          },
        },
      });

      if (result.error) {
        setErrorMessage(
          result.error.message.toLowerCase().includes("already")
            ? "An account already exists for that email address. Sign in instead."
            : "Registration could not be completed. Please check the details and try again."
        );
        return;
      }

      if (result.data.session) {
        router.replace("/operator-onboarding");
        router.refresh();
        return;
      }
      setEmailSent(true);
    } catch {
      setErrorMessage("Registration is temporarily unavailable. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (emailSent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
          <p className="mt-3 text-slate-700">
            We sent a verification link to <strong>{form.email.trim()}</strong>.
            Open it, then sign in to finish creating your operator business.
          </p>
          <Link
            href="/operator-login"
            className="mt-5 inline-block font-medium text-blue-700 underline"
          >
            Go to operator sign in
          </Link>
        </div>
      </main>
    );
  }

  const fieldClass =
    "mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base";

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <form
        onSubmit={register}
        className="mx-auto w-full max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Create your operator account
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Start your secure 30-day trial. Your email must be verified before
            your business is created.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
            Business or trading name
            <input required maxLength={120} className={fieldClass} value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Your name
            <input required autoComplete="name" maxLength={120} className={fieldClass} value={form.contactName} onChange={(e) => update("contactName", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Contact phone
            <input required autoComplete="tel" maxLength={40} className={fieldClass} value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
            Business address
            <textarea required maxLength={500} rows={3} className={fieldClass} value={form.address} onChange={(e) => update("address", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Operator licence number
            <input required maxLength={80} className={fieldClass} value={form.licenceNumber} onChange={(e) => update("licenceNumber", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Licensing authority
            <input required maxLength={120} className={fieldClass} value={form.licensingAuthority} onChange={(e) => update("licensingAuthority", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
            Email address
            <input required type="email" autoComplete="email" maxLength={254} className={fieldClass} value={form.email} onChange={(e) => update("email", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Password
            <input required type="password" autoComplete="new-password" minLength={10} className={fieldClass} value={form.password} onChange={(e) => update("password", e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Confirm password
            <input required type="password" autoComplete="new-password" minLength={10} className={fieldClass} value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />
          </label>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <button type="submit" disabled={saving} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-60">
          {saving ? "Creating account…" : "Create account"}
        </button>
        <Link href="/operator-login" className="block text-center text-sm font-medium text-blue-700 underline">
          Already registered? Sign in
        </Link>
      </form>
    </main>
  );
}
