import { createClient } from "@supabase/supabase-js";

let supabase: any = null;

export function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;

    if (!url || !key) {
      throw new Error("Supabase env variables missing");
    }

    supabase = createClient(url, key);
  }

  return supabase;
}