"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import OperatorLogoutButton from "@/app/components/OperatorLogoutButton";
import { getSupabase } from "@/lib/supabase/client";

type SubscriptionStatus = {
  planKey: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  graceEndsAt: string | null;
  readOnlyEndsAt: string | null;
  accessMode: "full" | "read_only" | "blocked";
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
};

function displayDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function remainingDays(value: string | null) {
  if (!value) return null;
  return Math.max(
    0,
    Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
  );
}

function statusCopy(status: SubscriptionStatus) {
  const days = remainingDays(status.trialEndsAt);
  if (status.status === "trialing" && days !== null && days > 0) {
    return {
      heading: "Free trial active",
      detail: `${days} day${days === 1 ? "" : "s"} remaining. Your card will not be charged until the trial ends.`,
      colour: "border-green-200 bg-green-50 text-green-900",
    };
  }
  if (status.status === "active") {
    return {
      heading: "Subscription active",
      detail: status.cancelAtPeriodEnd
        ? `Your subscription will end on ${displayDate(status.currentPeriodEndsAt)}.`
        : `Your current billing period ends on ${displayDate(status.currentPeriodEndsAt)}.`,
      colour: "border-green-200 bg-green-50 text-green-900",
    };
  }
  if (status.status === "grace") {
    return {
      heading: "Payment needs attention",
      detail: `Update your payment method by ${displayDate(status.graceEndsAt)} to keep full access.`,
      colour: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  if (status.accessMode === "read_only") {
    return {
      heading: "Subscription inactive",
      detail: `Your data is temporarily retained until ${displayDate(status.readOnlyEndsAt)}. Restart the subscription to restore full access.`,
      colour: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  return {
    heading: "Trial ended",
    detail: "Choose the subscription to restore access to your business workspace.",
    colour: "border-red-200 bg-red-50 text-red-900",
  };
}

function SubscriptionPageContent() {
  const searchParams = useSearchParams();
  const supabase = getSupabase();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"checkout" | "portal" | "">("");
  const checkout = searchParams.get("checkout");
  const notice =
    checkout === "success"
      ? "Stripe accepted your details. Subscription status is updating now."
      : checkout === "cancelled"
        ? "Checkout was cancelled. Nothing was charged."
        : "";

  const accessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    return token;
  }, [supabase]);

  const loadStatus = useCallback(async () => {
    const token = await accessToken();
    const response = await fetch("/api/subscription/status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = (await response.json()) as SubscriptionStatus & {
      error?: string;
    };
    if (!response.ok) throw new Error(result.error || "Unable to load subscription.");
    setStatus(result);
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    let attempts = checkout === "success" ? 5 : 1;
    async function refresh() {
      try {
        await loadStatus();
        if (active) setError("");
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load subscription.");
        }
      } finally {
        if (active) setLoading(false);
      }
      attempts -= 1;
      if (active && attempts > 0) window.setTimeout(() => void refresh(), 2000);
    }
    void refresh();
    return () => {
      active = false;
    };
  }, [checkout, loadStatus]);

  async function openBilling(kind: "checkout" | "portal") {
    if (action) return;
    setAction(kind);
    setError("");
    try {
      const token = await accessToken();
      const response = await fetch(`/api/subscription/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open Stripe.");
      }
      window.location.assign(result.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open Stripe.");
      setAction("");
    }
  }

  const copy = status ? statusCopy(status) : null;
  const canStartCheckout =
    status &&
    (!status.hasStripeSubscription ||
      ["cancelled", "read_only", "unpaid"].includes(status.status));

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage your trial, payment method and Stripe subscription.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {status?.accessMode === "full" && (
                <Link href="/dashboard" className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900">
                  Back to dashboard
                </Link>
              )}
              <OperatorLogoutButton />
            </div>
          </div>
        </header>

        {notice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {loading && !status ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm">Loading subscription…</section>
        ) : status && copy ? (
          <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm">
            <div className={`rounded-2xl border p-5 ${copy.colour}`}>
              <h2 className="text-xl font-bold">{copy.heading}</h2>
              <p className="mt-2 text-sm">{copy.detail}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-sm text-slate-500">Plan</div>
                <div className="mt-1 font-semibold text-slate-900">My Way Cars monthly</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <div className="text-sm text-slate-500">Stripe status</div>
                <div className="mt-1 font-semibold capitalize text-slate-900">
                  {status.status.replaceAll("_", " ")}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!canStartCheckout ? (
                <button type="button" onClick={() => void openBilling("portal")} disabled={Boolean(action)} className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-60">
                  {action === "portal" ? "Opening Stripe…" : "Manage billing"}
                </button>
              ) : (
                <button type="button" onClick={() => void openBilling("checkout")} disabled={Boolean(action)} className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-60">
                  {action === "checkout"
                    ? "Opening Stripe…"
                    : status.hasStripeSubscription
                      ? "Restart subscription"
                      : "Set up subscription"}
                </button>
              )}
              <button type="button" onClick={() => void loadStatus()} disabled={Boolean(action)} className="rounded-xl bg-slate-200 px-5 py-3 font-medium text-slate-900 disabled:opacity-60">
                Refresh status
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Card details are entered on Stripe&apos;s secure checkout and are not stored by My Way Cars.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-6">Loading subscription…</main>}>
      <SubscriptionPageContent />
    </Suspense>
  );
}
