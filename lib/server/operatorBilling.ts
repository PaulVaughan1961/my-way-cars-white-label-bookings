import { createClient } from "@supabase/supabase-js";

type SubscriptionRow = {
  business_id: string;
  plan_key: string;
  status: string;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  grace_ends_at: string | null;
  read_only_ends_at: string | null;
  access_mode: "full" | "read_only" | "blocked";
  is_owner: boolean;
};

export type BillingContext = SubscriptionRow & {
  userId: string;
  email: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
};

function configuredSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !secretKey) {
    throw new Error("Billing is not configured.");
  }

  return { url, anonKey, secretKey };
}

export function privilegedSupabase() {
  const { url, secretKey } = configuredSupabase();
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function authenticatedBillingContext(
  request: Request
): Promise<BillingContext> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!token) throw new Error("AUTH_REQUIRED");

  const { url, anonKey } = configuredSupabase();
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } =
    await supabase.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user?.email) throw new Error("AUTH_REQUIRED");

  const { data: statusData, error: statusError } = await supabase
    .rpc("get_current_subscription_status")
    .maybeSingle();

  if (statusError) {
    console.error("Subscription status lookup failed:", {
      code: statusError.code,
      message: statusError.message,
    });
    throw new Error("BILLING_UNAVAILABLE");
  }

  const status = statusData as SubscriptionRow | null;
  if (!status?.business_id) throw new Error("OPERATOR_REQUIRED");
  if (!status.is_owner) throw new Error("OWNER_REQUIRED");

  const { data: providerData, error: providerError } = await supabase
    .from("business_subscriptions")
    .select("provider_customer_id,provider_subscription_id")
    .eq("business_id", status.business_id)
    .single();

  if (providerError) {
    console.error("Subscription provider lookup failed:", {
      code: providerError.code,
      message: providerError.message,
    });
    throw new Error("BILLING_UNAVAILABLE");
  }

  return {
    ...status,
    userId: user.id,
    email: user.email,
    providerCustomerId: providerData.provider_customer_id,
    providerSubscriptionId: providerData.provider_subscription_id,
  };
}

export function billingErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "BILLING_UNAVAILABLE";
  if (code === "AUTH_REQUIRED") {
    return { status: 401, message: "Please sign in again." };
  }
  if (code === "OPERATOR_REQUIRED") {
    return { status: 403, message: "Operator access is required." };
  }
  if (code === "OWNER_REQUIRED") {
    return {
      status: 403,
      message: "Only the business owner can manage the subscription.",
    };
  }
  return {
    status: 503,
    message: "Subscription management is temporarily unavailable.",
  };
}
