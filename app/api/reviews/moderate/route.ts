import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ReviewAction = "approve" | "reject";

function env() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secretKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    fallbackBusinessId: process.env.PUBLIC_BOOKING_BUSINESS_ID,
  };
}

function privilegedClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function operatorContext(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in", status: 401 as const };

  const { url, anonKey, secretKey, fallbackBusinessId } = env();
  if (!url || !anonKey || !secretKey) {
    return { error: "Supabase is not configured", status: 500 as const };
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser(token);

  if (!user) {
    return { error: "Your operator session has expired.", status: 401 as const };
  }

  // Verify operator access using the same authenticated/RLS-aware pattern
  // already used elsewhere in the application.
  const { data: operator, error: operatorError } = await authClient
    .from("operator_users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    return { error: "Operator access required", status: 403 as const };
  }

  // Resolve the operator's own business through business_profiles under RLS.
  // This avoids guessing that an operator_users account/tenant field is the
  // same identifier used by public booking/review business resolution.
  const { data: profile, error: profileError } = await authClient
    .from("business_profiles")
    .select("*")
    .single();

  if (profileError || !profile) {
    return {
      error: "Could not resolve this operator's business.",
      status: 500 as const,
    };
  }

  const privileged = privilegedClient(url, secretKey);
  const profileRow = profile as Record<string, unknown>;
  const operatorRow = operator as Record<string, unknown>;

  // If the business profile exposes a slug, use the same authoritative RPC
  // used by the public booking/review routes.
  const slug = cleanString(profileRow.slug);
  if (slug) {
    const { data: resolved, error: resolveError } = await privileged
      .rpc("resolve_public_booking_business", {
        requested_slug: slug,
        fallback_business_id: fallbackBusinessId || null,
      })
      .maybeSingle();

    const row = resolved as { business_id?: unknown } | null;
    const resolvedId = cleanString(row?.business_id);

    if (!resolveError && resolvedId) {
      return { privileged, userId: user.id, businessId: resolvedId };
    }
  }

  // Fall back to identifiers from the RLS-scoped business profile itself.
  const businessId =
    cleanString(profileRow.business_id) ||
    cleanString(profileRow.id) ||
    cleanString(profileRow.account_id) ||
    cleanString(profileRow.tenant_id) ||
    cleanString(operatorRow.business_id);

  if (!businessId) {
    return {
      error: "This operator account is not linked to a review business.",
      status: 500 as const,
    };
  }

  return { privileged, userId: user.id, businessId };
}

export async function GET(request: Request) {
  const context = await operatorContext(request);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { data, error } = await context.privileged
    .from("customer_reviews")
    .select(
      "id,reviewer_name,reviewer_area,journey_type,rating,review_text,status,created_at"
    )
    .eq("business_id", context.businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: "Could not load customer reviews." },
      { status: 500 }
    );
  }

  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(request: Request) {
  const context = await operatorContext(request);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      action?: ReviewAction;
    };

    const id = body.id?.trim();
    const action = body.action;

    if (!id || (action !== "approve" && action !== "reject")) {
      return NextResponse.json(
        { error: "A review and action are required." },
        { status: 400 }
      );
    }

    const status = action === "approve" ? "approved" : "rejected";

    const { error } = await context.privileged
      .from("customer_reviews")
      .update({
        status,
        moderated_at: new Date().toISOString(),
        moderated_by: context.userId,
      })
      .eq("id", id)
      .eq("business_id", context.businessId);

    if (error) {
      return NextResponse.json(
        { error: "Could not update the review." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json(
      { error: "Invalid moderation request." },
      { status: 400 }
    );
  }
}