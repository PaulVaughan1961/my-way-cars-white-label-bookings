"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function DriverLoginPage() {
const supabase = getSupabase();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    let redirecting = false;

    async function restoreExistingSession() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!active || error || !user?.email) return;

        const { data: driver, error: driverError } = await supabase
          .from("drivers")
          .select("*")
          .eq("email", user.email)
          .maybeSingle();
        if (!active || driverError || !driver) return;
        if (driver.is_active === false || driver.active === false) return;

        redirecting = true;
        router.replace("/driver-dashboard");
        router.refresh();
      } catch {
        // A temporary network error must not clear the existing session.
      } finally {
        if (active && !redirecting) setCheckingSession(false);
      }
    }

    void restoreExistingSession();
    return () => { active = false; };
  }, [router, supabase]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      router.push("/driver-dashboard");
      router.refresh();
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-700">Checking your sign-in...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-2xl shadow-sm w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold">Driver Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded-lg"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded-lg"
        />

        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded-lg"
        >
          Login
        </button>
      </form>
    </main>
  );
}
