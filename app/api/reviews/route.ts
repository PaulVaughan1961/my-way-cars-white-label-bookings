import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUSINESS_NAME,
  normaliseBusinessName,
} from "@/lib/businessBranding";

const MAX_REQUEST_BYTES = 12_000;
const MAX_REVIEW_LENGTH = 1200;
const MAX_NAME_LENGTH = 80;
const MAX_AREA_LENGTH = 100;
const MAX_JOURNEY_LENGTH = 80;

function config() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    fallbackBusinessId: process.env.PUBLIC_BOOKING_BUSINESS_ID,
  };
}

function serverClient(url: string, secretKey: string) {
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function validBusinessSlug(value: unknown) {
  if (typeof value !== "string") return "";
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/.test(slug)
    ? slug
    : "";
}

async function resolvePublicBusiness(
  supabase: ReturnType<typeof serverClient>,
  fallbackBusinessId: string | undefined,
  requestedSlug: unknown
) {
  const slug = validBusinessSlug(requestedSlug);
  if (requestedSlug && !slug) return null;

  const { data, error } = await supabase
    .rpc("resolve_public_booking_business", {
      requested_slug: slug || null,
      fallback_business_id: fallbackBusinessId || null,
    })
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { business_id?: unknown; display_name?: unknown };
  if (!row.business_id) return null;

  return {
    businessId: String(row.business_id),
    displayName: normaliseBusinessName(row.display_name),
  };
}

function sourceKey(request: Request, secret: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const source = forwarded || realIp || "local-development";
  return createHmac("sha256", secret).update(source).digest("hex");
}

export async function GET(request: Request) {
  const { url, secretKey, fallbackBusinessId } = config();
  if (!url || !secretKey || !fallbackBusinessId) {
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable." },
      { status: 503 }
    );
  }

  const supabase = serverClient(url, secretKey);
  const requestedSlug = new URL(request.url).searchParams.get("business");
  const resolved = await resolvePublicBusiness(
    supabase,
    fallbackBusinessId,
    requestedSlug
  );

  if (!resolved) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("customer_reviews")
    .select("id,reviewer_name,reviewer_area,journey_type,rating,review_text,created_at")
    .eq("business_id", resolved.businessId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    businessName: resolved.displayName || DEFAULT_BUSINESS_NAME,
    reviews: data ?? [],
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Review is too large." }, { status: 413 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Invalid review request." }, { status: 415 });
  }

  const { url, secretKey, fallbackBusinessId } = config();
  if (!url || !secretKey || !fallbackBusinessId) {
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Review is too large." }, { status: 413 });
    }

    const body = JSON.parse(raw) as Record<string, unknown>;

    if (typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ received: true }, { status: 201 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const area = typeof body.area === "string" ? body.area.trim() : "";
    const journeyType =
      typeof body.journeyType === "string" ? body.journeyType.trim() : "";
    const review =
      typeof body.review === "string" ? body.review.trim() : "";
    const rating = Number(body.rating);

    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: "Please enter your name." },
        { status: 400 }
      );
    }
    if (area.length > MAX_AREA_LENGTH) {
      return NextResponse.json(
        { error: "Area is too long." },
        { status: 400 }
      );
    }
    if (journeyType.length > MAX_JOURNEY_LENGTH) {
      return NextResponse.json(
        { error: "Journey type is too long." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Please choose a rating from 1 to 5." },
        { status: 400 }
      );
    }
    if (!review || review.length > MAX_REVIEW_LENGTH) {
      return NextResponse.json(
        { error: "Please enter a review of up to 1,200 characters." },
        { status: 400 }
      );
    }

    const supabase = serverClient(url, secretKey);
    const resolved = await resolvePublicBusiness(
      supabase,
      fallbackBusinessId,
      body.businessSlug
    );

    if (!resolved) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const key = sourceKey(request, secretKey);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const recent = await supabase
      .from("customer_reviews")
      .select("id")
      .eq("business_id", resolved.businessId)
      .eq("reviewer_area", `source:${key}`)
      .gte("created_at", fiveMinutesAgo)
      .limit(1);

    if (!recent.error && (recent.data?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: "Please wait a few minutes before sending another review." },
        { status: 429 }
      );
    }

    const safeArea = area || "";
    const insert = await supabase.from("customer_reviews").insert({
      business_id: resolved.businessId,
      reviewer_name: name,
      reviewer_area: safeArea,
      journey_type: journeyType || null,
      rating,
      review_text: review,
      status: "pending",
    });

    if (insert.error) {
      console.error("Review submission failed:", insert.error.message);
      return NextResponse.json(
        { error: "Your review could not be sent. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        received: true,
        message:
          "Thank you. Your review has been received and will appear after approval.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Review route failed:", error);
    return NextResponse.json(
      { error: "Your review could not be sent. Please try again." },
      { status: 400 }
    );
  }
}