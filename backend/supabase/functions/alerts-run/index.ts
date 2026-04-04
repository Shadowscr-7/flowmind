import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getServiceClient,
  jsonResponse,
  errorResponse,
  corsHeaders,
} from "../_shared/utils.ts";
import { sendPushToUser } from "../_shared/push.ts";

// This function runs on a cron schedule to evaluate alerts
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
    // Use service role for cron (no user auth)
    const supabase = getServiceClient();

    // Get all active alerts 
    const { data: alerts, error: alertError } = await supabase
      .from("alerts")
      .select("*, profiles(plan, currency_default, settings_json)")
      .eq("enabled", true);

    if (alertError || !alerts) {
      return errorResponse("Error fetching alerts");
    }

    const triggered: string[] = [];

    for (const alert of alerts) {
      let shouldTrigger = false;
      let message = "";

      if (alert.type === "low_balance") {
        // Check if any account has balance below threshold
        const threshold = alert.threshold_json?.amount ?? 1000;
        const { data: accounts } = await supabase
          .from("accounts")
          .select("name, current_balance, currency")
          .eq("user_id", alert.user_id)
          .eq("is_active", true);

        for (const account of accounts || []) {
          if (account.current_balance < threshold) {
            shouldTrigger = true;
            message = `Tu cuenta "${account.name}" tiene saldo bajo: ${account.current_balance} ${account.currency}`;
            break;
          }
        }
      }

      if (alert.type === "budget_near_limit" || alert.type === "budget_exceeded") {
        const { data: budgets } = await supabase
          .from("budgets")
          .select("*, categories(name)")
          .eq("user_id", alert.user_id)
          .eq("enabled", true);

        const now = new Date();
        for (const budget of budgets || []) {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const { data: spent } = await supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", alert.user_id)
            .eq("type", "expense")
            .eq("category_id", budget.category_id)
            .gte("date", startOfMonth.toISOString());

          const totalSpent = (spent || []).reduce(
            (sum: number, t: any) => sum + t.amount,
            0
          );
          const percentage = totalSpent / budget.limit_amount;

          if (alert.type === "budget_exceeded" && percentage >= 1) {
            shouldTrigger = true;
            message = `Excediste tu presupuesto de ${budget.categories?.name || "categoría"}: ${totalSpent.toFixed(0)} / ${budget.limit_amount}`;
          } else if (
            alert.type === "budget_near_limit" &&
            percentage >= 0.8 &&
            percentage < 1
          ) {
            shouldTrigger = true;
            message = `Estás al ${(percentage * 100).toFixed(0)}% de tu presupuesto de ${budget.categories?.name || "categoría"}`;
          }
        }
      }

      if (alert.type === "forecast_negative") {
        // Simple forecast: current balance - projected remaining expenses
        const { data: accounts } = await supabase
          .from("accounts")
          .select("current_balance")
          .eq("user_id", alert.user_id)
          .eq("is_active", true);

        const totalBalance = (accounts || []).reduce(
          (sum: number, a: any) => sum + a.current_balance,
          0
        );

        const now = new Date();
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();
        const startOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        ).toISOString();

        const { data: expenses } = await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", alert.user_id)
          .eq("type", "expense")
          .gte("date", startOfMonth);

        const totalExpenses = (expenses || []).reduce(
          (sum: number, t: any) => sum + t.amount,
          0
        );
        const dailyBurn = now.getDate() > 0 ? totalExpenses / now.getDate() : 0;
        const projectedRemaining = dailyBurn * (daysInMonth - now.getDate());

        if (totalBalance - projectedRemaining < 0) {
          shouldTrigger = true;
          message = `Alerta: a este ritmo de gastos, tu saldo podría ser negativo antes de fin de mes. Proyección: ${(totalBalance - projectedRemaining).toFixed(0)}`;
        }
      }

      if (shouldTrigger) {
        // Rate limit: don't trigger same alert more than once per day
        if (alert.last_triggered_at) {
          const lastTriggered = new Date(alert.last_triggered_at);
          const hoursSince =
            (Date.now() - lastTriggered.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) continue;
        }

        // Update last_triggered_at
        await supabase
          .from("alerts")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", alert.id);

        // Send FCM push notification
        await sendPushToUser(supabase, alert.user_id, {
          title: _titleForAlertType(alert.type),
          body: message,
          data: {
            type: alert.type,
            alert_id: alert.id,
            route: "/notifications",
          },
        });

        console.log(
          `Alert triggered for user ${alert.user_id}: ${message}`
        );

        triggered.push(alert.id);
      }
    }

    return jsonResponse({
      success: true,
      alerts_evaluated: alerts.length,
      alerts_triggered: triggered.length,
      triggered_ids: triggered,
    });
  } catch (error) {
    console.error("alerts-run error:", error);
    return errorResponse(`Error: ${error.message}`, 500);
  }
});

function _titleForAlertType(type: string): string {
  switch (type) {
    case "low_balance":
      return "💰 Saldo bajo";
    case "budget_near_limit":
      return "⚠️ Presupuesto al límite";
    case "budget_exceeded":
      return "🚨 Presupuesto excedido";
    case "forecast_negative":
      return "📉 Pronóstico negativo";
    case "anomaly":
      return "🔍 Anomalía detectada";
    default:
      return "🔔 Alerta Flowmind";
  }
}
