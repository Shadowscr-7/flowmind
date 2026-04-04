import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getServiceClient,
  jsonResponse,
  errorResponse,
  corsHeaders,
} from "../_shared/utils.ts";
import { sendPush, sendPushToUser } from "../_shared/push.ts";

// Edge function to send push notifications
// Restricted to service-role or internal callers only
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // Security: require service_role key or a shared secret
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isServiceRole = authHeader === `Bearer ${serviceKey}`;

  // Also accept a dedicated PUSH_SECRET for cron/internal calls
  const pushSecret = Deno.env.get("PUSH_SECRET");
  const isPushSecret = pushSecret && authHeader === `Bearer ${pushSecret}`;

  if (!isServiceRole && !isPushSecret) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const supabase = getServiceClient();

    const body = await req.json();
    const { user_id, user_ids, topic, title, body: messageBody, data } = body;

    if (!title || !messageBody) {
      return errorResponse("title and body are required");
    }

    const payload = { title, body: messageBody, data };
    const results: { userId: string; sent: boolean }[] = [];

    if (user_id) {
      // Send to single user
      const sent = await sendPushToUser(supabase, user_id, payload);
      results.push({ userId: user_id, sent });
    } else if (user_ids && Array.isArray(user_ids)) {
      // Send to multiple users
      for (const uid of user_ids) {
        const sent = await sendPushToUser(supabase, uid, payload);
        results.push({ userId: uid, sent });
      }
    } else if (topic === "all") {
      // Send to all users with FCM tokens
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, fcm_token")
        .not("fcm_token", "is", null);

      for (const profile of profiles || []) {
        const sent = await sendPush(profile.fcm_token, payload);
        // Also store in-app notification
        await supabase.from("notifications").insert({
          user_id: profile.id,
          type: data?.type ?? "system",
          title,
          body: messageBody,
          data: data ?? {},
          is_read: false,
        });
        results.push({ userId: profile.id, sent });
      }
    } else {
      return errorResponse("Provide user_id, user_ids[], or topic='all'");
    }

    return jsonResponse({
      success: true,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent).length,
      results,
    });
  } catch (error) {
    console.error("send-push error:", error);
    return errorResponse(`Error: ${error.message}`, 500);
  }
});
