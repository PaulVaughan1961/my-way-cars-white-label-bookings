import { NextResponse } from "next/server";
import { hashConfirmationToken, readWorkflowBody, requireSameOrigin, workflowError, workflowServiceClient } from "@/lib/server/bookingWorkflow";
import { notifyOperatorNewBookingRequest } from "@/lib/operatorPush";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
  try {
    requireSameOrigin(request);
    const body = await readWorkflowBody(request);
    if (!["view", "confirm", "recheck"].includes(String(body.action))) throw new Error("Invalid confirmation action.");
    const tokenHash = hashConfirmationToken(body.token);
    const client = workflowServiceClient();
    const { data, error } = await client.rpc("customer_booking_quote_action", {
      requested_token_hash: tokenHash, requested_action: body.action,
    });
    if (error) throw error;
    if (data.newAction) {
      const first = data.journeys?.[0] || {};
      try {
        await notifyOperatorNewBookingRequest({
          businessId: data.businessId, businessName: data.businessName,
          event: data.state === "confirmed" ? "confirmed" : data.state === "awaiting_operator" ? "accepted_quote" : "recheck",
          payload: { passengerName: first.passengerName, outward: {
            pickupAddress: first.pickup, dropoffAddress: first.dropoff, pickupDateTime: first.pickupDateTime,
          } },
        });
      } catch {
        // Confirmation has committed. A push failure must never reverse it or report failure.
        console.warn("Booking workflow notification delivery failed.");
      }
    }
    const { businessId: _businessId, newAction: _newAction, ...publicResult } = data;
    return NextResponse.json(publicResult, { headers });
  } catch (error) {
    return NextResponse.json({ error: workflowError(error) }, { status: 400, headers });
  }
}
