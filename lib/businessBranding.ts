import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_BUSINESS_NAME = "My Way Cars";

export function normaliseBusinessName(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_BUSINESS_NAME;
}

export async function loadBusinessName(
  supabase: SupabaseClient,
  fallback = DEFAULT_BUSINESS_NAME
) {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("display_name")
    .single();

  if (error) return fallback;
  return normaliseBusinessName(data?.display_name);
}

export function isMyWayCarsBusiness(displayName: string) {
  return displayName.trim().toLowerCase() === DEFAULT_BUSINESS_NAME.toLowerCase();
}
