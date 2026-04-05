/**
 * PayPal Webhook Handler
 *
 * Handles subscription lifecycle events from PayPal:
 * - BILLING.SUBSCRIPTION.ACTIVATED    → plan = pro
 * - BILLING.SUBSCRIPTION.CANCELLED    → plan = free, status = cancelled
 * - BILLING.SUBSCRIPTION.EXPIRED      → plan = free, status = expired
 * - BILLING.SUBSCRIPTION.SUSPENDED    → status = suspended (payment failed)
 * - PAYMENT.SALE.COMPLETED            → renew expires_at
 *
 * Configure in PayPal dashboard → Webhooks → add your endpoint:
 *   https://yourdomain.com/api/paypal/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID!;
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
  if (!res.ok) throw new Error(`PayPal auth failed`);
  const data = await res.json();
  return data.access_token as string;
}

async function verifyWebhookSignature(
  accessToken: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const verifyBody = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(rawBody),
  };

  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(verifyBody),
  });

  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    // Verify webhook signature
    if (PAYPAL_WEBHOOK_ID) {
      const accessToken = await getPayPalAccessToken();
      const isValid = await verifyWebhookSignature(accessToken, req.headers, rawBody);
      if (!isValid) {
        console.error("PayPal webhook: invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event_type ?? "";
    const resource = event.resource ?? {};

    const supabase = createClient(SB_URL, SB_SERVICE_KEY);

    // Helper: find user by PayPal subscription ID stored in receipt_json
    async function findUserBySubscription(subscriptionId: string) {
      const { data } = await supabase
        .from("subscriptions")
        .select("user_id")
        .contains("receipt_json", { paypal_subscription_id: subscriptionId })
        .maybeSingle();
      return data?.user_id ?? null;
    }

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subscriptionId: string = resource.id ?? "";
        const userId = await findUserBySubscription(subscriptionId);
        if (userId) {
          await supabase.from("profiles").update({ plan: "pro" }).eq("id", userId);
          await supabase
            .from("subscriptions")
            .update({ status: "active" })
            .contains("receipt_json", { paypal_subscription_id: subscriptionId });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subscriptionId: string = resource.id ?? "";
        const userId = await findUserBySubscription(subscriptionId);
        const newStatus = eventType.includes("CANCELLED") ? "cancelled" : "expired";
        if (userId) {
          await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
          await supabase
            .from("subscriptions")
            .update({ status: newStatus })
            .contains("receipt_json", { paypal_subscription_id: subscriptionId });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        // Payment failed — keep plan active for now, mark as suspended
        const subscriptionId: string = resource.id ?? "";
        await supabase
          .from("subscriptions")
          .update({ status: "suspended" })
          .contains("receipt_json", { paypal_subscription_id: subscriptionId });
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        // Successful renewal — update expires_at
        const subscriptionId: string = resource.billing_agreement_id ?? "";
        const nextBilling: string | null = resource.create_time ?? null;
        if (subscriptionId) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              expires_at: nextBilling,
            })
            .contains("receipt_json", { paypal_subscription_id: subscriptionId });
        }
        break;
      }

      default:
        // Unhandled event — ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("PayPal webhook error:", err);
    // Always return 200 so PayPal doesn't retry
    return NextResponse.json({ received: true });
  }
}
