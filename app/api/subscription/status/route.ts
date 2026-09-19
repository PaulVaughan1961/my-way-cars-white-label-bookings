import { NextResponse } from "next/server";
import {
  authenticatedBillingContext,
  billingErrorResponse,
} from "@/lib/server/operatorBilling";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await authenticatedBillingContext(request);
    return NextResponse.json(
      {
        planKey: context.plan_key,
        status: context.status,
        trialEndsAt: context.trial_ends_at,
        currentPeriodEndsAt: context.current_period_ends_at,
        cancelAtPeriodEnd: context.cancel_at_period_end,
        graceEndsAt: context.grace_ends_at,
        readOnlyEndsAt: context.read_only_ends_at,
        accessMode: context.access_mode,
        hasStripeCustomer: Boolean(context.providerCustomerId),
        hasStripeSubscription: Boolean(context.providerSubscriptionId),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const response = billingErrorResponse(error);
    return NextResponse.json(
      { error: response.message },
      { status: response.status }
    );
  }
}
