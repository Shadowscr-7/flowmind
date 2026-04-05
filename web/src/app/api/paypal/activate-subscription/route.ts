import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_BASE = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

async function getPayPalSubscription(accessToken: string, subscriptionId: string) {
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`PayPal subscription fetch failed: ${await res.text()}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { userId, subscriptionId, planType } = await req.json();

    if (!userId || !subscriptionId || !planType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify subscription with PayPal
    const accessToken = await getPayPalAccessToken();
    const subscription = await getPayPalSubscription(accessToken, subscriptionId);

    const status: string = subscription.status ?? "";
    // ACTIVE or APPROVED are both valid at this stage
    if (!["ACTIVE", "APPROVED"].includes(status)) {
      return NextResponse.json(
        { error: `Subscription not active (status: ${status})` },
        { status: 400 }
      );
    }

    const supabase = createClient(SB_URL, SB_SERVICE_KEY);

    // Update user plan to pro
    await supabase.from("profiles").update({ plan: "pro" }).eq("id", userId);

    // Record subscription in DB
    const startDate = subscription.start_time ?? new Date().toISOString();
    const billing = subscription.billing_info;
    const nextBilling: string | null = billing?.next_billing_time ?? null;

    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        platform: "web",
        product_id: subscription.plan_id ?? planType,
        status: "active",
        receipt_json: {
          paypal_subscription_id: subscriptionId,
          plan_type: planType,
          paypal_status: status,
          subscriber: subscription.subscriber ?? null,
        },
        starts_at: startDate,
        expires_at: nextBilling,
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("activate-subscription error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
