import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export function workflowServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Booking confirmation is temporarily unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function workflowOperatorClient(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) throw new Error("Please sign in again.");
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Please sign in again.");
  // The database RPC independently checks tenant, operator and subscription access.
  return client;
}

export function confirmationBaseUrl(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim();
  const candidate = configured || (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (candidate) {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
      throw new Error("Please configure APP_BASE_URL with the public HTTPS application address.");
    }
    if (url.username || url.password) throw new Error("Invalid application address.");
    return url.origin;
  }
  if (process.env.NODE_ENV !== "production") return new URL(request.url).origin;
  throw new Error("Please configure APP_BASE_URL before creating confirmation links.");
}

export function hashConfirmationToken(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("This confirmation link is unavailable. Please contact your operator.");
  }
  return createHash("sha256").update(token).digest("hex");
}

export async function readWorkflowBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid request.");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 12_000) throw new Error("Request is too large.");
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request.");
  return parsed as Record<string, unknown>;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new Error("Please reopen your confirmation link and try again.");
}

export function workflowError(error: unknown) {
  const message = error instanceof Error ? error.message :
    error && typeof error === "object" && "message" in error ? String(error.message) : "";
  // Never return SQL detail, table names or stack traces to a public client.
  return /^(Please |This |Only |A |The quote |One |Booking |Your |Invalid |Request is )/.test(message)
    ? message : "Booking confirmation is temporarily unavailable. Please contact your operator.";
}
