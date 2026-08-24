"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function OperatorLoginPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setErrorMessage("The email address or password is incorrect.");
      setLoading(false);
      return;
    }

    const { data: operator } = await supabase
      .from("operator_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!operator) {
      await supabase.auth.signOut();
      setErrorMessage("This account does not have operator access.");
      setLoading(false);
      return;
    }

    const requestedPath = new URLSearchParams(window.location.search).get(
      "next"
    );
    const safePath =
      requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/dashboard";

    router.replace(safePath);
    router.refresh();
  }

  async function sendPasswordReset() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Enter your email address first.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setNoticeMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/operator-reset`,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNoticeMessage("Password reset email sent. Check your inbox.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            My Way Cars
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Operator login
          </p>
        </div>

        <label className="block text-sm font-medium text-slate-800">
          Email address
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
          />
        </label>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {noticeMessage && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {noticeMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => void sendPasswordReset()}
          className="w-full text-sm font-medium text-blue-700 underline disabled:opacity-60"
        >
          Forgotten your password?
        </button>
      </form>
    </main>
  );
}
