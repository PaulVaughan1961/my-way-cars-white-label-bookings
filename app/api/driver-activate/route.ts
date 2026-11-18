import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: "Please open your invitation link again." }, { status: 401 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Please reopen your invitation link." }, { status: 403 });
  }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } = await userClient.auth.getUser(token);
  if (identityError || !identity.user?.email) {
    return NextResponse.json({ error: "Your invitation has expired. Contact the operator." }, { status: 401 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership } = await admin.from("business_memberships")
    .select("id,driver_id,status,business_id")
    .eq("user_id", identity.user.id).eq("role", "driver").in("status", ["invited", "active"])
    .maybeSingle();
  if (!membership?.driver_id) {
    return NextResponse.json({ error: "This account has no driver invitation." }, { status: 403 });
  }
  const { data: driver } = await admin.from("drivers").select("id,email,auth_user_id,active,dispatch_method")
    .eq("id", membership.driver_id).eq("business_id", membership.business_id).maybeSingle();
  if (!driver || driver.active === false || driver.dispatch_method !== "dashboard" ||
      driver.auth_user_id !== identity.user.id ||
      driver.email?.toLowerCase() !== identity.user.email.toLowerCase()) {
    return NextResponse.json({ error: "The driver invitation could not be verified." }, { status: 403 });
  }
  if (membership.status === "invited") {
    const { error } = await admin.from("business_memberships")
      .update({ status: "active", accepted_at: new Date().toISOString() })
      .eq("id", membership.id).eq("status", "invited");
    if (error) return NextResponse.json({ error: "Could not activate your driver account." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
