"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function DriverLoginPage() {
const supabase = getSupabase();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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