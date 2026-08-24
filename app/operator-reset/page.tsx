"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function OperatorResetPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Checking the reset link...");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage(
          "This reset link is invalid or has expired. Return to operator login and request another one."
        );
        return;
      }

      setMessage("");
      setReady(true);
    }

    void checkSession();
  }, [supabase]);

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

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

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
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
            My Way Cars operator account
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
