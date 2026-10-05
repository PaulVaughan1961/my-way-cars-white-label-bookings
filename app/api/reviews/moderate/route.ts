import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ReviewAction = "approve" | "reject";

function env() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secretKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
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

async function operatorContext(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in", status: 401 as const };

  const { url, anonKey, secretKey } = env();
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

  const privileged = privilegedClient(url, secretKey);
  const { data: operator, error } = await privileged
    .from("operator_users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !operator) {
    return { error: "Operator access required", status: 403 as const };
  }

  const row = operator as Record<string, unknown>;
  const rawBusinessId = row.business_id ?? row.account_id ?? row.tenant_id;
  const businessId =
    typeof rawBusinessId === "string" && rawBusinessId.trim()
      ? rawBusinessId.trim()
      : "";

  if (!businessId) {
    return {
      error:
        "This operator account is not linked to a business for review moderation.",
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
    .select("id,reviewer_name,reviewer_area,journey_type,rating,review_text,status,created_at")
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