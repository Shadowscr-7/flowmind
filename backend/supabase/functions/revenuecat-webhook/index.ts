import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient, jsonResponse, errorResponse, corsHeaders } from "../_shared/utils.ts";

/**
 * RevenueCat Webhook Handler
 *
 * Setup:
 * 1. In RevenueCat Dashboard → Project Settings → Integrations → Webhooks
 * 2. Set webhook URL to: https://<your-project>.supabase.co/functions/v1/revenuecat-webhook
 * 3. Set Authorization header to: Bearer <REVENUECAT_WEBHOOK_SECRET>
 * 4. Add REVENUECAT_WEBHOOK_SECRET to Supabase Edge Function secrets
 *
 * Events handled:
 * - INITIAL_PURCHASE: New subscription purchased
 * - RENEWAL: Subscription renewed
 * - CANCELLATION: User cancelled (still active until period ends)
 * - EXPIRATION: Subscription expired
 * - BILLING_ISSUE: Payment failed (grace period)
 * - PRODUCT_CHANGE: User changed plan (monthly ↔ yearly)
 * - SUBSCRIBER_ALIAS: Subscriber alias created
 * - UNCANCELLATION: User re-enabled auto-renew
 */

// Map RevenueCat event types to our subscription status
const EVENT_STATUS_MAP: Record<string, string> = {
  INITIAL_PURCHASE: "active",
  RENEWAL: "active",
  UNCANCELLATION: "active",
  PRODUCT_CHANGE: "active",
  CANCELLATION: "cancelled",
  EXPIRATION: "expired",
  BILLING_ISSUE: "grace_period",
};

// Events that mean the user should have Pro
const PRO_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // Verify webhook secret (fail-closed: deny if secret not configured)
  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

  if (!webhookSecret) {
    console.error("REVENUECAT_WEBHOOK_SECRET not configured — rejecting all webhooks");
    return errorResponse("Server misconfiguration", 500);
  }

  if (authHeader !== `Bearer ${webhookSecret}`) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const body = await req.json();
    const event = body.event;

    if (!event) {
      return errorResponse("Missing event payload");
    }

    const eventType: string = event.type;
    const appUserId: string = event.app_user_id;
    const productId: string = event.product_id ?? "";
    const expirationAtMs: number | null = event.expiration_at_ms;
    const purchasedAtMs: number | null = event.purchased_at_ms;
    const store: string = event.store ?? "PLAY_STORE";
    const environment: string = event.environment ?? "PRODUCTION";

    console.log(`RevenueCat webhook: ${eventType} for user ${appUserId}, product ${productId}`);

    // Skip events for anonymous users
    if (!appUserId || appUserId.startsWith("$RCAnonymous")) {
      return jsonResponse({ success: true, skipped: true, reason: "anonymous user" });
    }

    const supabase = getServiceClient();
    const newStatus = EVENT_STATUS_MAP[eventType];

    if (!newStatus) {
      console.log(`Unhandled event type: ${eventType}`);
      return jsonResponse({ success: true, skipped: true, reason: `unhandled event: ${eventType}` });
    }

    // Determine the plan for the profiles table
    const plan = PRO_EVENTS.has(eventType) ? "pro" : "free";

    // 1. Update the user's plan in profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ plan })
      .eq("id", appUserId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // 2. Upsert subscription record
    const subscriptionData: Record<string, unknown> = {
      user_id: appUserId,
      platform: store === "PLAY_STORE" ? "android" : store === "APP_STORE" ? "ios" : "web",
      product_id: productId,
      status: newStatus,
      receipt_json: {
        event_type: eventType,
        store,
        environment,
        original_event: event,
      },
    };

    if (purchasedAtMs) {
      subscriptionData.starts_at = new Date(purchasedAtMs).toISOString();
    }
    if (expirationAtMs) {
      subscriptionData.expires_at = new Date(expirationAtMs).toISOString();
    }

    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert(subscriptionData, { onConflict: "user_id" });

    if (subError) {
      console.error("Error upserting subscription:", subError);
      // If upsert fails because no unique constraint on user_id, try insert
      if (subError.code === "42P10") {
        const { error: insertError } = await supabase
          .from("subscriptions")
          .insert(subscriptionData);
        if (insertError) {
          console.error("Error inserting subscription:", insertError);
        }
      }
    }

    // 3. Log analytics event
    try {
      await supabase.from("analytics_events").insert({
        user_id: appUserId,
        event_name: `subscription_${eventType.toLowerCase()}`,
        event_data: {
          product_id: productId,
          store,
          environment,
          new_status: newStatus,
          plan,
        },
      });
    } catch (e) {
      console.error("Error logging analytics:", e);
    }

    return jsonResponse({
      success: true,
      event_type: eventType,
      user_id: appUserId,
      new_plan: plan,
      new_status: newStatus,
    });
  } catch (e) {
    console.error("Webhook processing error:", e);
    return errorResponse(`Webhook error: ${e}`, 500);
  }
});
