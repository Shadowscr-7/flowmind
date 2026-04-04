import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient, jsonResponse, errorResponse, corsHeaders } from "../_shared/utils.ts";
import { sendPushToUser, type PushPayload } from "../_shared/push.ts";

/**
 * Weekly Summary — Cron edge function
 * Runs every Monday at 11:00 UTC (8:00 AM Uruguay)
 *
 * For each user with a valid FCM token:
 *   1. Fetches last 7 days of transactions
 *   2. Calculates total income, expenses, net, top category
 *   3. Sends a push notification with the summary
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // Guard: only allow cron (service_role) invocations
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const supabase = getServiceClient();

    // Get all active users with FCM tokens
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, display_name, currency_default, fcm_token, settings_json")
      .not("fcm_token", "is", null);

    if (profilesErr) {
      console.error("Failed to fetch profiles:", profilesErr.message);
      return errorResponse(`DB error: ${profilesErr.message}`, 500);
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoIso = weekAgo.toISOString();

    let sent = 0;
    let skipped = 0;

    for (const profile of profiles || []) {
      try {
        // Check if user has daily_summary enabled (opt-in for weekly too)
        const settings = profile.settings_json ?? {};
        if (settings.daily_summary === false && settings.weekly_summary === false) {
          skipped++;
          continue;
        }

        // Fetch transactions from the last 7 days
        const { data: transactions, error: txErr } = await supabase
          .from("transactions")
          .select("type, amount, category_id, categories(name)")
          .eq("user_id", profile.id)
          .gte("date", weekAgoIso)
          .eq("is_confirmed", true);

        if (txErr || !transactions || transactions.length === 0) {
          skipped++;
          continue;
        }

        // Calculate summary
        let totalIncome = 0;
        let totalExpenses = 0;
        const categoryTotals: Record<string, number> = {};

        for (const tx of transactions) {
          const amount = Number(tx.amount) || 0;
          if (tx.type === "income") {
            totalIncome += amount;
          } else if (tx.type === "expense") {
            totalExpenses += amount;
            const catName = tx.categories?.name ?? "Sin categoría";
            categoryTotals[catName] = (categoryTotals[catName] || 0) + amount;
          }
        }

        const net = totalIncome - totalExpenses;
        const currency = profile.currency_default || "UYU";

        // Find top spending category
        let topCategory = "";
        let topAmount = 0;
        for (const [cat, amount] of Object.entries(categoryTotals)) {
          if (amount > topAmount) {
            topCategory = cat;
            topAmount = amount;
          }
        }

        // Format amounts
        const fmt = (n: number) =>
          n.toLocaleString("es-UY", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          });

        const netEmoji = net >= 0 ? "📈" : "📉";
        const name = profile.display_name || "allí";

        const title = `📊 Resumen semanal`;
        const body =
          `Hola ${name}! Esta semana:\n` +
          `💚 Ingresos: ${currency} ${fmt(totalIncome)}\n` +
          `🔴 Gastos: ${currency} ${fmt(totalExpenses)}\n` +
          `${netEmoji} Neto: ${currency} ${fmt(net)}` +
          (topCategory
            ? `\n🏷️ Mayor gasto: ${topCategory} (${currency} ${fmt(topAmount)})`
            : "");

        const payload: PushPayload = {
          title,
          body,
          data: {
            type: "weekly_summary",
            income: totalIncome.toString(),
            expenses: totalExpenses.toString(),
            net: net.toString(),
          },
        };

        const ok = await sendPushToUser(supabase, profile.id, payload);
        if (ok) sent++;
        else skipped++;
      } catch (err) {
        console.error(`Error processing user ${profile.id}:`, err);
        skipped++;
      }
    }

    console.log(`Weekly summary: sent=${sent}, skipped=${skipped}`);
    return jsonResponse({ success: true, sent, skipped });
  } catch (error) {
    console.error("weekly-summary error:", error);
    return errorResponse(`Error: ${error.message}`, 500);
  }
});
