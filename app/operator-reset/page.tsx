"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function OperatorResetPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Checking the reset link...");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);

  useEffect(() => {
    // React may re-run effects in development. Redeem each recovery link once.
    if (startedRef.current) return;
    startedRef.current = true;

    async function checkRecoveryLink() {
      // Capture the fragment before constructing the SSR browser client. The
      // fragment contains the recovery tokens and must not remain in the URL.
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const errorCode = fragment.get("error_code") ?? query.get("error_code");
      const oldCode = query.get("code");
      window.history.replaceState(window.history.state, "", window.location.pathname);

      if (errorCode) {
        setMessage(
          "The reset link was rejected or has expired. Request a fresh email and open its link once."
        );
        return;
      }
      if (oldCode) {
        setMessage(
          "This reset email uses the old link format. Request a fresh email from the operator login page."
        );
        return;
      }
      if (fragment.get("type") !== "recovery" || !accessToken || !refreshToken) {
        setMessage(
          "This page needs a fresh password-reset link. Return to operator login and request one."
        );
        return;
      }

      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data.session) throw error ?? new Error("Missing recovery session");

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user || userData.user.id !== data.session.user.id) {
          throw userError ?? new Error("Recovery identity could not be verified");
        }

        setRecoveryUserId(userData.user.id);
        setMessage("");
        setReady(true);
      } catch {
        setMessage(
          "This reset link could not be verified. Request a fresh email and open its link once."
        );
      }
    }

    void checkRecoveryLink();
  }, []);

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !ready || !recoveryUserId) return;

    if (password.length < 10) {
      setMessage("Use a password containing at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The two passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const supabase = getSupabase();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || userData.user?.id !== recoveryUserId) {
        setReady(false);
        setMessage("Your reset session ended. Request a fresh password-reset email.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("The password could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={savePassword}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Operator account
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {message}
          </div>
        )}

        {ready && (
          <>
            <label className="block text-sm font-medium text-slate-800">
              New password
              <input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
              />
            </label>

            <label className="block text-sm font-medium text-slate-800">
              Confirm new password
              <input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save new password"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => router.replace("/operator-login")}
          className="w-full text-sm font-medium text-blue-700 underline"
        >
          Return to operator login
        </button>
      </form>
    </main>
  );
}
