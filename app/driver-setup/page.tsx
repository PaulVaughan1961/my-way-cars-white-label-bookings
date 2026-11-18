"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function DriverSetupPage() {
  const router = useRouter();
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Checking your invitation...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function checkInvitation() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const code = query.get("code");
      window.history.replaceState(window.history.state, "", window.location.pathname);
      if (fragment.get("error_code") || query.get("error_code")) {
        setMessage("This invitation has expired. Ask the operator for help.");
        return;
      }
      const supabase = getSupabase();
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setMessage("This invitation could not be verified.");
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("This invitation could not be verified.");
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("Open the invitation link in your email to set your password.");
        return;
      }
      setReady(true);
      setMessage("");
    }
    void checkInvitation();
  }, []);

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || saving) return;
    if (password.length < 10) {
      setMessage("Use a password with at least 10 characters.");
      return;
    }
    setSaving(true);
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage("Your invitation session has ended. Open the email link again.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/driver-activate", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      const result = await response.json();
      setMessage(result.error || "Could not activate the driver account.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }
    router.replace("/driver-dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={finish} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Set up your driver login</h1>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        {ready && (
          <>
            <label className="block text-sm font-medium">
              Choose a password
              <input type="password" autoComplete="new-password" value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border p-3" required minLength={10} />
            </label>
            <button type="submit" disabled={saving}
              className="w-full rounded-lg bg-blue-700 p-3 font-bold text-white disabled:opacity-60">
              {saving ? "Setting up..." : "Open my driver dashboard"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
