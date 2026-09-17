import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUSINESS_NAME,
  normaliseBusinessName,
} from "@/lib/businessBranding";

const MAX_REQUEST_BYTES = 20_000;

function clientSource(request: Request, secret: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const address = forwarded || realIp || "local-development";
  return createHmac("sha256", secret).update(address).digest("hex");
}

function publicError(message: string, businessName = DEFAULT_BUSINESS_NAME) {
  const allowed = [
    "Please ",
    "Invalid booking request",
    "Public booking requests are not available",
    "Too many booking requests",
    "The account name is too long",
    "The customer notes are too long",
    "The outward flight number is too long",
    "The return flight number is too long",
  ];
  return allowed.some((prefix) => message.startsWith(prefix))
    ? message
    : `Your request could not be sent. Please try again or contact ${businessName}.`;
}

function publicBookingConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    businessId: process.env.PUBLIC_BOOKING_BUSINESS_ID,
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
  if (error || !data) {
    if (error) {
      console.error("Public booking business lookup failed:", {
        code: error.code,
        message: error.message,
      });
    }
    return null;
  }
  const result = data as {
    business_id?: unknown;
    display_name?: unknown;
  };
  if (!result.business_id) return null;
  return {
    businessId: String(result.business_id),
    displayName: normaliseBusinessName(result.display_name),
  };
}

export async function GET(request: Request) {
  const { url, secretKey, businessId } = publicBookingConfig();

  if (!url || !secretKey || !businessId) {
    return NextResponse.json({ displayName: DEFAULT_BUSINESS_NAME });
  }

  const supabase = serverClient(url, secretKey);
  const requestedSlug = new URL(request.url).searchParams.get("business");
  const resolved = await resolvePublicBusiness(
    supabase,
    businessId,
    requestedSlug
  );
  if (!resolved) {
    return NextResponse.json(
      { error: "Public booking requests are not available." },
      { status: 404 }
    );
  }
  return NextResponse.json({ displayName: resolved.displayName });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Booking request is too large." }, { status: 413 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Invalid booking request." }, { status: 415 });
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Booking request is too large." }, { status: 413 });
    }

    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid booking request." }, { status: 400 });
    }
    const payload = parsed as Record<string, unknown>;

    // A filled honeypot is treated as a successful no-op so automated form
    // fillers do not learn how the protection works.
    if (typeof payload.website === "string" && payload.website.trim()) {
      return NextResponse.json({ received: true });
    }

    const { url, secretKey, businessId } = publicBookingConfig();

    if (!url || !secretKey || !businessId) {
      console.error("Public booking request server configuration is incomplete.");
      return NextResponse.json(
        { error: "Booking requests are temporarily unavailable." },
        { status: 503 }
      );
    }

    const supabase = serverClient(url, secretKey);
    const requestedSlug = payload.businessSlug;
    delete payload.businessSlug;
    const resolved = await resolvePublicBusiness(
      supabase,
      businessId,
      requestedSlug
    );
    if (!resolved) {
      return NextResponse.json(
        { error: "Public booking requests are not available." },
        { status: 404 }
      );
    }
    const businessName = resolved.displayName;

    const { error } = await supabase.rpc("submit_public_booking_request", {
      requested_business_id: resolved.businessId,
      request_source_key: clientSource(request, secretKey),
      request_payload: payload,
    });

    if (error) {
      const message = publicError(error.message, businessName);
      const status = message.startsWith("Too many booking requests") ? 429 : 400;
      if (status === 400 && message.startsWith("Your request could not")) {
        console.error("Public booking request failed:", error.message);
      }
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ received: true }, { status: 201 });
  } catch (error) {
    console.error("Public booking request route failed:", error);
    return NextResponse.json(
      {
        error: "Your request could not be sent. Please try again or contact your transport operator.",
      },
      { status: 400 }
    );
  }
}
