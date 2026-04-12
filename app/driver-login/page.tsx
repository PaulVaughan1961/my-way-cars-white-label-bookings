"use client";

import { useState } from "react";
<<<<<<< HEAD
import { getSupabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function DriverLoginPage() {
  const supabase = getSupabase();
=======
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DriverLoginPage() {
  const supabase = createClient();
>>>>>>> 8736079 (Merge working version + fix next job persistence)
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
<<<<<<< HEAD
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
=======

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
>>>>>>> 8736079 (Merge working version + fix next job persistence)
      email,
      password,
    });

    if (error) {
      alert(error.message);
<<<<<<< HEAD
      setLoading(false);
      return;
    }

    // SUCCESS → go to driver dashboard (we’ll build next)
    router.push("/driver");
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold text-center">
          Driver Login
        </h1>
=======
    } else {
      router.push("/driver-dashboard");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-2xl shadow-sm w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-bold">Driver Login</h1>
>>>>>>> 8736079 (Merge working version + fix next job persistence)

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
<<<<<<< HEAD
          className="w-full border rounded-xl p-3"
=======
          className="w-full border px-3 py-2 rounded-lg"
>>>>>>> 8736079 (Merge working version + fix next job persistence)
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
<<<<<<< HEAD
          className="w-full border rounded-xl p-3"
=======
          className="w-full border px-3 py-2 rounded-lg"
>>>>>>> 8736079 (Merge working version + fix next job persistence)
        />

        <button
          type="submit"
<<<<<<< HEAD
          disabled={loading}
          className="w-full bg-slate-900 text-white rounded-xl py-3"
        >
          {loading ? "Logging in..." : "Login"}
=======
          className="w-full bg-black text-white py-2 rounded-lg"
        >
          Login
>>>>>>> 8736079 (Merge working version + fix next job persistence)
        </button>
      </form>
    </main>
  );
}