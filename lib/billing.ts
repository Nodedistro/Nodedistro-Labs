import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { authenticate, HttpError } from "@/lib/db/server";
import { jsonBody } from "@/lib/http";
function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new HttpError(503, "Billing is not configured.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export async function billingRequest(route: string, request: Request) {
  const { db, user } = await authenticate(),
    stripe = stripeClient(),
    origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new HttpError(503, "Application URL is not configured.");
  const { data: subscription } = await db
    .from("pcb_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (route === "billing/portal") {
    if (!subscription?.customer_id)
      throw new HttpError(400, "No billing account exists yet.");
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.customer_id,
      return_url: origin + "/billing",
    });
    return Response.json({ url: session.url });
  }
  if (route !== "billing/checkout")
    throw new HttpError(404, "Billing endpoint not found.");
  const { plan } = z
    .object({ plan: z.enum(["pro", "team"]) })
    .parse(await jsonBody(request));
  const price =
    plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_TEAM_PRICE_ID;
  if (!price)
    throw new HttpError(503, "This subscription plan is not configured.");
  if (subscription?.status === "active" || subscription?.status === "trialing")
    throw new HttpError(
      400,
      "Manage your existing subscription in the billing portal.",
    );
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    ...(subscription?.customer_id
      ? { customer: subscription.customer_id }
      : { customer_email: user.email }),
    client_reference_id: user.id,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    success_url: origin + "/billing?checkout=complete",
    cancel_url: origin + "/pricing",
    integration_identifier: "nodedistro-labs-pcb-ncqpxrte",
  });
  return Response.json({ url: session.url });
}
export async function webhook(request: Request) {
  const stripe = stripeClient();
  if (
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    throw new HttpError(503, "Billing webhook is not configured.");
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new HttpError(400, "Missing webhook signature.");
  const body = await request.text();
  if (body.length > 1_000_000) throw new HttpError(413, "Webhook too large.");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new HttpError(400, "Invalid webhook signature.");
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let subscriptionId: string | undefined;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
  } else if (event.type.startsWith("customer.subscription."))
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  if (subscriptionId) {
    // Retrieve current Stripe state so late webhook delivery does not replay old entitlements.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata.user_id;
    if (!z.string().uuid().safeParse(userId).success)
      throw new HttpError(400, "Subscription has no recognized account.");
    const priceId = subscription.items.data[0]?.price.id;
    const plan =
      priceId === process.env.STRIPE_TEAM_PRICE_ID
        ? "team"
        : priceId === process.env.STRIPE_PRO_PRICE_ID
          ? "pro"
          : "free";
    const { error } = await admin
      .from("pcb_subscriptions")
      .upsert({
        user_id: userId,
        customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        subscription_id: subscription.id,
        plan,
        status: subscription.status,
        updated_at: new Date().toISOString(),
      });
    if (error)
      throw new HttpError(503, "Subscription state could not be saved.");
  }
  const { error } = await admin
    .from("pcb_webhook_events")
    .upsert({ id: event.id }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new HttpError(503, "Webhook audit could not be saved.");
  return Response.json({ received: true });
}
