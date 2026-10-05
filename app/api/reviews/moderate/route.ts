import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadBusinessName } from "@/lib/businessBranding";

type ReviewAction = "approve" | "reject";

function config() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secretKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    fallbackBusinessId: process.env.PUBLIC_BOOKING_BUSINESS_ID,
  };
}

function normalise(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function context(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in", status: 401 as const };

  const { url, anonKey, secretKey, fallbackBusinessId } = config();
  if (!url || !anonKey || !secretKey) {
    return { error: "Supabase is not configured", status: 500 as const };
  }

  const operatorClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
  } = await operatorClient.auth.getUser(token);

  if (!user) {
    return { error: "Your operator session has expired.", status: 401 as const };
  }

  const { data: operator } = await operatorClient
    .from("operator_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!operator) {
    return { error: "Operator access required", status: 403 as const };
  }

  // Use the existing RLS-scoped branding lookup to identify which business
  // the signed-in operator belongs to. This avoids guessing at hidden IDs.
  const operatorBusinessName = await loadBusinessName(operatorClient, "");

  if (!operatorBusinessName) {
    return {
      error: "Could not identify this operator's business.",
      status: 500 as const,
    };
  }

  const admin = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Resolve the exact same public business used by the customer review page.
  const { data: resolved, error: resolveError } = await admin
    .rpc("resolve_public_booking_business", {
      requested_slug: "my-way-cars",
      fallback_business_id: fallbackBusinessId || null,
    })
    .maybeSingle();

  const row = resolved as
    | { business_id?: unknown; display_name?: unknown }
    | null;

  if (resolveError || !row?.business_id) {
    return {
      error: "Could not resolve the My Way Cars review business.",
      status: 500 as const,
    };
  }

  // Safety check: the signed-in operator's RLS-scoped business name must
  // match the public business before moderation is allowed.
  if (normalise(operatorBusinessName) !== normalise(row.display_name)) {
    return {
      error: "This operator account does not match the review business.",
      status: 403 as const,
    };
  }

  return {
    admin,
    userId: user.id,
    businessId: String(row.business_id),
  };
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { data, error } = await ctx.admin
    .from("customer_reviews")
    .select(
      "id,reviewer_name,reviewer_area,journey_type,rating,review_text,status,created_at"
    )
    .eq("business_id", ctx.businessId)
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
  const ctx = await context(request);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
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

    const { error } = await ctx.admin
      .from("customer_reviews")
      .update({
        status,
        moderated_at: new Date().toISOString(),
        moderated_by: ctx.userId,
      })
      .eq("id", id)
      .eq("business_id", ctx.businessId);

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