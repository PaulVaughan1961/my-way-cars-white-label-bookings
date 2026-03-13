import { createClient } from "@supabase/supabase-js";

let supabase: any = null;

export function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("SUPABASE URL:", url);
    console.log("SUPABASE KEY EXISTS:", !!key);

    if (!url || !key) {
      throw new Error("Supabase env variables missing");
    }

    supabase = createClient(url, key);
  }

  return supabase;
}