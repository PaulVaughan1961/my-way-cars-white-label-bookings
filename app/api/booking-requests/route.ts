import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_REQUEST_BYTES = 20_000;

function clientSource(request: Request, secret: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const address = forwarded || realIp || "local-development";
  return createHmac("sha256", secret).update(address).digest("hex");
}

function publicError(message: string) {
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
    : "Your request could not be sent. Please try again or contact My Way Cars.";
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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const businessId = process.env.PUBLIC_BOOKING_BUSINESS_ID;

    if (!url || !secretKey || !businessId) {
      console.error("Public booking request server configuration is incomplete.");
      return NextResponse.json(
        { error: "Booking requests are temporarily unavailable." },
        { status: 503 }
      );
    }

    const supabase = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error } = await supabase.rpc("submit_public_booking_request", {
      requested_business_id: businessId,
      request_source_key: clientSource(request, secretKey),
      request_payload: payload,
    });

    if (error) {
      const message = publicError(error.message);
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
      { error: "Your request could not be sent. Please try again or contact My Way Cars." },
      { status: 400 }
    );
  }
}
