import { NextResponse } from "next/server";
import {
  authenticatedBillingContext,
  billingErrorResponse,
  privilegedSupabase,
} from "@/lib/server/operatorBilling";
import {
  applicationBaseUrl,
  getStripe,
  stripePriceId,
} from "@/lib/server/stripe";

export const runtime = "nodejs";

function futureTrialEnd(value: string | null) {
  if (!value) return null;
  const timestamp = Math.floor(new Date(value).getTime() / 1000);
  return Number.isFinite(timestamp) && timestamp > Math.floor(Date.now() / 1000) + 172800
    ? timestamp
    : null;
}

export async function POST(request: Request) {
  try {
    const context = await authenticatedBillingContext(request);
    const stripe = getStripe();
    const priceId = stripePriceId();
    const baseUrl = applicationBaseUrl();

    if (
      context.providerSubscriptionId &&
      ["trialing", "active", "grace"].includes(context.status)
    ) {
      return NextResponse.json(
        { error: "A subscription already exists. Use Manage billing instead." },
        { status: 409 }
      );
    }

    let customerId = context.providerCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: context.email,
        metadata: { business_id: context.business_id },
      });
      customerId = customer.id;

      const { error } = await privilegedSupabase().rpc(
        "record_stripe_customer",
        {
          requested_business_id: context.business_id,
          requested_user_id: context.userId,
          requested_customer_id: customerId,
        }
      );
      if (error) {
        console.error("Stripe customer mapping failed:", {
          code: error.code,
          message: error.message,
        });
        throw new Error("BILLING_UNAVAILABLE");
      }
    }

    const openSessions = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "open",
      limit: 10,
    });
    const reusable = openSessions.data.find(
      (session) =>
        session.mode === "subscription" &&
        session.metadata?.business_id === context.business_id &&
        Boolean(session.url)
    );
    if (reusable?.url) return NextResponse.json({ url: reusable.url });

    const trialEnd =
      context.status === "trialing"
        ? futureTrialEnd(context.trial_ends_at)
        : null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: context.business_id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/subscription?checkout=success`,
      cancel_url: `${baseUrl}/subscription?checkout=cancelled`,
      metadata: {
        business_id: context.business_id,
        user_id: context.userId,
      },
      subscription_data: {
        metadata: { business_id: context.business_id },
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
    });

    if (!session.url) throw new Error("BILLING_UNAVAILABLE");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    const response = billingErrorResponse(error);
    return NextResponse.json(
      { error: response.message },
      { status: response.status }
    );
  }
}
