"use client";

import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing Supabase environment variables");
  }

  supabaseInstance = createBrowserClient(url, anon);

  return supabaseInstance;
}
