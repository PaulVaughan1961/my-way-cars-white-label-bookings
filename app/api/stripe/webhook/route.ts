import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { privilegedSupabase } from "@/lib/server/operatorBilling";
import {
  getStripe,
  stripePriceId,
  stripeWebhookSecret,
} from "@/lib/server/stripe";

export const runtime = "nodejs";

function unixDate(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function customerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

function periodEnd(subscription: Stripe.Subscription) {
  const direct = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  const itemEnds = subscription.items.data
    .map(
      (item) =>
        (item as unknown as { current_period_end?: number })
          .current_period_end
    )
    .filter((value): value is number => typeof value === "number");
  return direct ?? (itemEnds.length ? Math.max(...itemEnds) : null);
}

function databaseStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "grace";
    case "unpaid":
      return "unpaid";
    case "canceled":
      return "cancelled";
    default:
      return "read_only";
  }
}

async function syncSubscription(
  event: Stripe.Event,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId || priceId !== stripePriceId()) {
    console.error("Ignored Stripe subscription with an unexpected price:", {
      eventId: event.id,
      subscriptionId: subscription.id,
      priceId,
    });
    return;
  }

  const status = databaseStatus(subscription.status);
  const isGrace = status === "grace";
  const isReadOnly = ["read_only", "cancelled", "unpaid"].includes(status);
  const now = Date.now();
  const metadataBusinessId = subscription.metadata.business_id || "";
  const businessId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      metadataBusinessId
    )
      ? metadataBusinessId
      : null;

  const { error } = await privilegedSupabase().rpc(
    "apply_stripe_subscription_event",
    {
      requested_event_id: event.id,
      requested_event_type: event.type,
      requested_event_created_at: new Date(event.created * 1000).toISOString(),
      requested_business_id: businessId,
      requested_customer_id: customerId(subscription),
      requested_subscription_id: subscription.id,
      requested_price_id: priceId,
      requested_plan_key: "commercial_monthly",
      requested_status: status,
      requested_trial_ends_at: unixDate(subscription.trial_end),
      requested_current_period_ends_at: unixDate(periodEnd(subscription)),
      requested_cancel_at_period_end: subscription.cancel_at_period_end,
      requested_grace_ends_at: isGrace
        ? new Date(now + 7 * 86400000).toISOString()
        : null,
      requested_read_only_ends_at: isReadOnly
        ? new Date(now + 30 * 86400000).toISOString()
        : null,
    }
  );

  if (error) {
    console.error("Stripe subscription database sync failed:", {
      eventId: event.id,
      code: error.code,
      message: error.message,
    });
    throw new Error("Stripe subscription sync failed.");
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const loose = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id?: string } | null;
      } | null;
    } | null;
  };
  const candidate =
    loose.subscription ??
    loose.parent?.subscription_details?.subscription ??
    null;
  return typeof candidate === "string" ? candidate : candidate?.id ?? null;
}

async function subscriptionForEvent(event: Stripe.Event) {
  const stripe = getStripe();

  if (event.type.startsWith("customer.subscription.")) {
    return event.data.object as Stripe.Subscription;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscription = session.subscription;
    const id =
      typeof subscription === "string" ? subscription : subscription?.id;
    return id ? stripe.subscriptions.retrieve(id) : null;
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const id = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
    return id ? stripe.subscriptions.retrieve(id) : null;
  }

  return null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      stripeWebhookSecret()
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", {
      name: error instanceof Error ? error.name : "WebhookError",
    });
    return NextResponse.json(
      { error: "Invalid Stripe webhook." },
      { status: 400 }
    );
  }

  try {
    const subscription = await subscriptionForEvent(event);
    if (subscription) await syncSubscription(event, subscription);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", {
      eventId: event.id,
      name: error instanceof Error ? error.name : "WebhookError",
    });
    return NextResponse.json(
      { error: "Stripe webhook processing failed." },
      { status: 500 }
    );
  }
}
