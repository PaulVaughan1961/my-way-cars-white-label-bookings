import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { confirmationBaseUrl } from "@/lib/server/bookingWorkflow";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Sign in to invite a driver." }, { status: 401 });
  }

  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Please reopen the driver page." }, { status: 403 });
    }
    const { driverId, email } = await request.json() as { driverId?: string; email?: string };
    const address = email?.trim().toLowerCase();
    if (!driverId || !/^[0-9a-f-]{36}$/i.test(driverId) ||
        !address || address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return NextResponse.json({ error: "Enter a valid driver email address." }, { status: 400 });
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: identityError } = await userClient.auth.getUser(token);
    if (identityError || !identity.user) {
      return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    }
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: driver, error: driverError } = await admin.from("drivers")
      .select("id,business_id,dispatch_method,active,is_active,email,auth_user_id")
      .eq("id", driverId).single();
    if (driverError || !driver || driver.dispatch_method !== "dashboard" ||
        driver.active === false || driver.is_active === false) {
      return NextResponse.json({ error: "Select an active regular driver." }, { status: 400 });
    }
    const { data: operator } = await admin.from("business_memberships")
      .select("id").eq("business_id", driver.business_id).eq("user_id", identity.user.id)
      .in("role", ["owner", "operator", "admin"]).eq("status", "active").maybeSingle();
    if (!operator) {
      return NextResponse.json({ error: "You cannot invite drivers for this business." }, { status: 403 });
    }
    if (driver.auth_user_id || driver.email) {
      return NextResponse.json({ error: "This driver already has an invitation or login. Contact support to change it." }, { status: 409 });
    }

    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(address, {
      redirectTo: `${confirmationBaseUrl(request)}/driver-setup`,
    });
    if (inviteError || !invitation.user) {
      return NextResponse.json({ error: inviteError?.message || "Could not email the invitation." }, { status: 400 });
    }
    const userId = invitation.user.id;
    const { data: existingMembership } = await admin.from("business_memberships")
      .select("id").eq("business_id", driver.business_id).eq("user_id", userId).maybeSingle();
    if (existingMembership) {
      return NextResponse.json({ error: "This email already has access to this business. Contact support." }, { status: 409 });
    }
    const { error: membershipError } = await admin.from("business_memberships").insert({
      business_id: driver.business_id,
      user_id: userId,
      role: "driver",
      status: "invited",
      driver_id: driver.id,
      invited_by_membership_id: operator.id,
      invited_at: new Date().toISOString(),
    });
    if (membershipError) {
      console.error("Driver membership creation failed", membershipError);
      return NextResponse.json({ error: "The email was sent, but access could not be linked. Contact support." }, { status: 500 });
    }
    const { data: updated, error: updateError } = await admin.from("drivers")
      .update({ email: address, auth_user_id: userId })
      .eq("id", driver.id).is("auth_user_id", null).select("id").maybeSingle();
    if (updateError || !updated) {
      console.error("Driver record linkage failed", updateError);
      return NextResponse.json({ error: "The email was sent, but the driver record could not be linked. Contact support." }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Driver invitation failed", error);
    return NextResponse.json({ error: "Could not invite the driver. Please try again." }, { status: 500 });
  }
}
