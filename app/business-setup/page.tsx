"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type BusinessProfile = {
  display_name: string;
  public_booking_slug: string;
};

export default function BusinessSetupPage() {
  const supabase = getSupabase();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const { data } = await supabase
        .from("business_profiles")
        .select("display_name,public_booking_slug")
        .single();
      if (active) {
        setOrigin(window.location.origin);
        if (data) setProfile(data as BusinessProfile);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [supabase]);

  const requestPath = profile?.public_booking_slug
    ? `/request?business=${encodeURIComponent(profile.public_booking_slug)}`
    : "";

  async function copyRequestLink() {
    if (!requestPath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${requestPath}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Business setup</h1>
              <p className="mt-1 text-sm text-slate-600">
                {profile?.display_name
                  ? `Finish preparing ${profile.display_name} for bookings.`
                  : "Manage the information used when bookings and invoices are created."}
              </p>
            </div>
            <Link href="/dashboard" className="rounded-xl bg-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-900">
              Back to dashboard
            </Link>
          </div>
        </header>

        {requestPath && (
          <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Your customer booking-request link is ready</h2>
            <p className="mt-1 break-all text-sm text-slate-700">
              {origin}{requestPath}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void copyRequestLink()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {copied ? "Link copied" : "Copy link"}
              </button>
              <Link href={requestPath} target="_blank" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-200">
                Test booking page
              </Link>
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Setup checklist</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="font-semibold text-green-900">✓ Secure business workspace</div>
              <p className="mt-1 text-sm text-green-800">Business, owner access and trial created.</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="font-semibold text-green-900">✓ Customer request link</div>
              <p className="mt-1 text-sm text-green-800">Unique link created for this business.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold text-amber-900">Next: accounts and customers</div>
              <p className="mt-1 text-sm text-amber-800">Add account billing details where required.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold text-amber-900">Next: drivers and vehicles</div>
              <p className="mt-1 text-sm text-amber-800">Add the people and vehicles used for bookings.</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/accounts" className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm transition hover:border-blue-400">
            <div className="text-xl font-bold text-slate-900">Accounts</div>
            <p className="mt-2 text-sm text-slate-600">Add and update account names, billing addresses, contacts and invoice email addresses.</p>
            <div className="mt-4 font-medium text-blue-700">Manage accounts →</div>
          </Link>
          <Link href="/drivers" className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm transition hover:border-blue-400">
            <div className="text-xl font-bold text-slate-900">Drivers</div>
            <p className="mt-2 text-sm text-slate-600">Add and update drivers, phone numbers, usual vehicles and licensing authorities.</p>
            <div className="mt-4 font-medium text-blue-700">Manage drivers →</div>
          </Link>
        </section>
      </div>
    </main>
  );
}
