import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_REQUEST_BYTES = 12_000;

function cleanField(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number
) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < minimum || clean.length > maximum) {
    throw new Error(`${label} must contain between ${minimum} and ${maximum} characters.`);
  }
  return clean;
}

function serverClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "The setup details are too large." }, { status: 413 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !secretKey) {
    return NextResponse.json({ error: "Business setup is not configured." }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "The setup details are too large." }, { status: 413 });
    }
    const body = JSON.parse(rawBody) as Record<string, unknown>;

    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await authClient.auth.getUser(token);
    const user = userResult.user;
    if (userError || !user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }
    if (!user.email_confirmed_at || !user.email) {
      return NextResponse.json({ error: "Verify your email address before continuing." }, { status: 403 });
    }

    const details = {
      businessName: cleanField(body.businessName, "Business name", 2, 120),
      contactName: cleanField(body.contactName, "Contact name", 2, 120),
      contactPhone: cleanField(body.contactPhone, "Contact phone", 5, 40),
      address: cleanField(body.address, "Business address", 5, 500),
      licenceNumber: cleanField(body.licenceNumber, "Operator licence number", 2, 80),
      licensingAuthority: cleanField(body.licensingAuthority, "Licensing authority", 2, 120),
    };

    const privileged = serverClient(url, secretKey);
    const { data, error } = await privileged.rpc("provision_self_service_operator", {
      requested_user_id: user.id,
      requested_business_name: details.businessName,
      requested_contact_name: details.contactName,
      requested_contact_phone: details.contactPhone,
      requested_address: details.address,
      requested_licence_number: details.licenceNumber,
      requested_licensing_authority: details.licensingAuthority,
    });
    if (error) {
      console.error("Self-service operator provisioning failed:", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Your secure business workspace could not be created. Please try again." },
        { status: 500 }
      );
    }

    const provisioned = Array.isArray(data) ? data[0] : data;
    if (!provisioned?.business_id || !provisioned?.public_booking_slug) {
      return NextResponse.json({ error: "Business setup returned an incomplete result." }, { status: 500 });
    }

    return NextResponse.json({
      businessId: provisioned.business_id,
      displayName: provisioned.display_name,
      requestPath: `/request?business=${encodeURIComponent(provisioned.public_booking_slug)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid setup details.";
    const safeMessage = message.includes("must contain") || message.endsWith("is required.")
      ? message
      : "Invalid setup details.";
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }
}
