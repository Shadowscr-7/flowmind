/**
 * Cron: Daily Smart Alerts Check
 * Runs every day at 9am (configured in vercel.json)
 * Checks user-defined spending limits, low balances, and goals
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const CRON_SECRET = process.env.CRON_SECRET!;

function db() { return createClient(SB_URL, SB_KEY); }

async function sendWA(phone: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return;
  try {
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: phone, text }),
    });
  } catch { /* non-blocking */ }
}

function periodStart(period: string): string {
  const now = new Date();
  if (period === "daily") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split("T")[0];
  }
  if (period === "weekly") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).toISOString().split("T")[0];
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

async function checkAlertsForUser(
  userId: string,
  phone: string | null,
  currency: string,
  displayName: string | null
) {
  const supabase = db();
  const userName = displayName ?? "Usuario";

  const { data: alerts } = await supabase
    .from("smart_alerts")
    .select("*, categories(name), accounts(name, balance)")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!alerts || alerts.length === 0) return;

  const messages: string[] = [];

  for (const alert of alerts) {
    const now = new Date();

    // Cooldown: don't re-trigger same alert within same period
    if (alert.last_triggered_at) {
      const lastTriggered = new Date(alert.last_triggered_at);
      const start = periodStart(alert.period ?? "monthly");
      if (lastTriggered >= new Date(start)) continue;
    }

    switch (alert.type) {
      case "spending_limit": {
        if (!alert.threshold_amount || !alert.period) break;
        const pStart = periodStart(alert.period);

        let query = supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", userId)
          .eq("type", "expense")
          .gte("date", pStart);

        if (alert.category_id) query = query.eq("category_id", alert.category_id);

        const { data: txs } = await query;
        const total = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
        const pct = Math.round((total / alert.threshold_amount) * 100);

        if (pct >= 90) {
          const catName = (alert.categories as { name: string } | null)?.name;
          const periodLabel = alert.period === "monthly" ? "este mes" : alert.period === "weekly" ? "esta semana" : "hoy";
          const emoji = pct >= 100 ? "🚨" : "⚠️";
          messages.push(
            `${emoji} *Alerta de gasto${catName ? ` — ${catName}` : ""}*\n` +
            `Llevás ${currency} ${total.toLocaleString("es-UY")} de tu límite de ${currency} ${Number(alert.threshold_amount).toLocaleString("es-UY")} ${periodLabel} (${pct}%)`
          );
          await supabase.from("smart_alerts").update({ last_triggered_at: now.toISOString() }).eq("id", alert.id);
        }
        break;
      }

      case "low_balance": {
        if (!alert.threshold_amount) break;
        const acc = alert.account_id
          ? (alert.accounts as { name: string; balance: number } | null)
          : null;

        const balance = acc ? Number(acc.balance) : 0;
        if (balance < alert.threshold_amount) {
          const accName = acc?.name ?? "tu cuenta";
          messages.push(
            `💳 *Saldo bajo — ${accName}*\n` +
            `Tu saldo es ${currency} ${balance.toLocaleString("es-UY")}, por debajo del límite de ${currency} ${Number(alert.threshold_amount).toLocaleString("es-UY")}`
          );
          await supabase.from("smart_alerts").update({ last_triggered_at: now.toISOString() }).eq("id", alert.id);
        }
        break;
      }

      case "goal_milestone": {
        const { data: goals } = await supabase.from("goals").select("name, target_amount, current_amount").eq("user_id", userId);
        for (const goal of goals ?? []) {
          const pct = Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100);
          const milestones = [25, 50, 75, 90, 100];
          const threshold = alert.threshold_amount ?? 50;
          if (pct >= threshold && pct < threshold + 5) {
            messages.push(
              `🎯 *Meta: ${goal.name}*\n` +
              `¡Alcanzaste el ${pct}% de tu meta! (${currency} ${Number(goal.current_amount).toLocaleString("es-UY")} / ${Number(goal.target_amount).toLocaleString("es-UY")})`
            );
            await supabase.from("smart_alerts").update({ last_triggered_at: now.toISOString() }).eq("id", alert.id);
          }
        }
        break;
      }
    }
  }

  // Also create web notifications
  for (const msg of messages) {
    const lines = msg.split("\n");
    await supabase.from("notifications").insert({
      user_id: userId,
      title: lines[0].replace(/[*🚨⚠️💳🎯]/g, "").trim(),
      body: lines.slice(1).join(" ").trim(),
      type: "smart_alert",
    });
  }

  // Send WhatsApp if user has phone and there are messages
  if (phone && messages.length > 0) {
    const waMsg = `🔔 *FlowMind — Alertas del día*\n\n${messages.join("\n\n")}\n\n_Configurá tus alertas en la app_`;
    await sendWA(phone, waMsg);
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, currency_default, whatsapp_phone")
    .eq("plan", "pro");

  const results = { processed: 0, triggered: 0 };

  for (let i = 0; i < (profiles ?? []).length; i += 10) {
    const batch = (profiles ?? []).slice(i, i + 10);
    await Promise.allSettled(
      batch.map(p =>
        checkAlertsForUser(p.id, p.whatsapp_phone, p.currency_default ?? "UYU", p.display_name)
          .then(() => results.processed++)
          .catch(e => console.error(`Alert check error for ${p.id}:`, e))
      )
    );
  }

  return NextResponse.json({ ok: true, ...results });
}

export { GET as POST };
