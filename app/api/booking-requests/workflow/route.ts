import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { confirmationBaseUrl, hashConfirmationToken, readWorkflowBody, workflowError, workflowOperatorClient } from "@/lib/server/bookingWorkflow";

export async function POST(request: Request) {
  try {
    const client = await workflowOperatorClient(request);
    const body = await readWorkflowBody(request);
    if (typeof body.bookingId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.bookingId)) throw new Error("A booking is required.");
    let result;
    if (body.action === "hold") {
      result = await client.rpc("hold_customer_booking", { requested_booking_id: body.bookingId });
    } else if (body.action === "approve") {
      result = await client.rpc("approve_customer_booking_quote", { requested_booking_id: body.bookingId });
    } else if (body.action === "withdraw") {
      result = await client.rpc("withdraw_customer_booking_quote", { requested_booking_id: body.bookingId });
    } else if (body.action === "quote") {
      const origin = confirmationBaseUrl(request);
      const token = randomBytes(32).toString("base64url");
      result = await client.rpc("issue_customer_booking_quote", {
        requested_booking_id: body.bookingId,
        requested_fares: body.fares,
        requested_token_hash: hashConfirmationToken(token),
        requested_lifetime_hours: body.lifetimeHours,
        requested_notice_hours: body.noticeHours,
        requested_hold: body.holdAvailability,
      });
      if (result.error) throw result.error;
      return NextResponse.json({ ...result.data, confirmationUrl: `${origin}/confirm#token=${token}` },
        { headers: { "Cache-Control": "no-store" } });
    } else throw new Error("Invalid workflow action.");
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: workflowError(error) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
