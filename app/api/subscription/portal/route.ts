import { NextResponse } from "next/server";
import {
  authenticatedBillingContext,
  billingErrorResponse,
} from "@/lib/server/operatorBilling";
import { applicationBaseUrl, getStripe } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await authenticatedBillingContext(request);
    if (!context.providerCustomerId) {
      return NextResponse.json(
        { error: "No billing account exists yet." },
        { status: 409 }
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: context.providerCustomerId,
      return_url: `${applicationBaseUrl()}/subscription`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const response = billingErrorResponse(error);
    return NextResponse.json(
      { error: response.message },
      { status: response.status }
    );
  }
}
