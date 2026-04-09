/**
 * Cron: Weekly AI Financial Insights
 * Runs every Monday at 9am (configured in vercel.json)
 * Analyzes each user's finances with GPT and sends WhatsApp summary
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const CRON_SECRET = process.env.CRON_SECRET!;

function db() { return createClient(SB_URL, SB_KEY); }

async function gpt(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

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

// ─── Build financial context for a user ──────────────────────────────────────
async function buildUserContext(userId: string, currency: string) {
  const supabase = db();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [
    { data: recentTxs },
    { data: accounts },
    { data: budgets },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, currency, merchant, date, categories!category_id(name)")
      .eq("user_id", userId)
      .gte("date", thirtyAgo)
      .order("date", { ascending: false })
      .limit(100),
    supabase.from("accounts").select("name, type, balance, currency").eq("user_id", userId).eq("is_active", true),
    supabase
      .from("budgets")
      .select("limit_amount, currency, categories(name)")
      .eq("user_id", userId),
    supabase.from("goals").select("name, target_amount, current_amount, currency, deadline").eq("user_id", userId),
  ]);

  // Aggregate spending by category (last 30 days)
  const catSpend: Record<string, number> = {};
  let monthIncome = 0, monthExpenses = 0, weekExpenses = 0;

  for (const tx of recentTxs ?? []) {
    const catName = (tx.categories as unknown as { name: string } | null)?.name ?? "Sin categoría";
    if (tx.type === "expense") {
      catSpend[catName] = (catSpend[catName] ?? 0) + Number(tx.amount);
      if (tx.date >= monthStart) monthExpenses += Number(tx.amount);
      if (tx.date >= weekAgo) weekExpenses += Number(tx.amount);
    } else if (tx.type === "income" && tx.date >= monthStart) {
      monthIncome += Number(tx.amount);
    }
  }

  const topCategories = Object.entries(catSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, amount]) => ({ name, amount }));

  const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);

  const budgetStatus = (budgets ?? []).map(b => {
    const catName = (b.categories as unknown as { name: string } | null)?.name ?? "?";
    const spent = catSpend[catName] ?? 0;
    return { category: catName, limit: Number(b.limit_amount), spent, pct: Math.round((spent / Number(b.limit_amount)) * 100) };
  });

  const goalStatus = (goals ?? []).map(g => ({
    name: g.name,
    target: Number(g.target_amount),
    current: Number(g.current_amount),
    pct: Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100),
    targetDate: g.deadline,
    currency: g.currency,
  }));

  return {
    currency,
    totalBalance,
    monthIncome,
    monthExpenses,
    weekExpenses,
    netMonth: monthIncome - monthExpenses,
    topCategories,
    budgetStatus,
    goalStatus,
    accountCount: (accounts ?? []).length,
  };
}

// ─── Generate insights via GPT ────────────────────────────────────────────────
type UserContext = Awaited<ReturnType<typeof buildUserContext>>;
async function generateInsights(ctx: UserContext, userName: string) {
  const system = `Sos un asesor financiero personal experto. Analizás los datos financieros del usuario y generás insights accionables, personalizados y en español rioplatense.

Generá entre 3 y 5 insights variados. Deben ser específicos, concretos y útiles.
Tipos disponibles: spend_change, anomaly, suggestion, forecast, summary, trend

Severidades: info (neutral/bueno), warn (atención), critical (problema real)

Respondé SOLO JSON:
{
  "insights": [
    {
      "kind": "suggestion|spend_change|anomaly|forecast|summary|trend",
      "title": "título corto (<60 chars)",
      "detail": "explicación accionable (2-3 oraciones max)",
      "severity": "info|warn|critical"
    }
  ],
  "whatsapp_summary": "mensaje conciso para WhatsApp (máx 400 chars, usa emojis, incluye los 2 insights más importantes)"
}`;

  const user = `Usuario: ${userName}
Saldo total: ${ctx.currency} ${ctx.totalBalance.toLocaleString("es-UY")}
Ingresos del mes: ${ctx.currency} ${ctx.monthIncome.toLocaleString("es-UY")}
Gastos del mes: ${ctx.currency} ${ctx.monthExpenses.toLocaleString("es-UY")}
Gastos esta semana: ${ctx.currency} ${ctx.weekExpenses.toLocaleString("es-UY")}
Neto del mes: ${ctx.currency} ${ctx.netMonth.toLocaleString("es-UY")}

Top categorías (30 días):
${ctx.topCategories.map(c => `- ${c.name}: ${ctx.currency} ${c.amount.toLocaleString("es-UY")}`).join("\n")}

Presupuestos:
${ctx.budgetStatus.length ? ctx.budgetStatus.map(b => `- ${b.category}: ${b.pct}% usado (${b.spent.toLocaleString("es-UY")} / ${b.limit.toLocaleString("es-UY")})`).join("\n") : "Sin presupuestos configurados"}

Metas de ahorro:
${ctx.goalStatus.length ? ctx.goalStatus.map(g => `- ${g.name}: ${g.pct}% (${g.current.toLocaleString("es-UY")} / ${g.target.toLocaleString("es-UY")}${g.targetDate ? `, meta: ${g.targetDate}` : ""})`).join("\n") : "Sin metas configuradas"}`;

  try {
    const raw = await gpt(system, user);
    const parsed = JSON.parse(raw);
    return {
      insights: (parsed.insights ?? []) as Array<{ kind: string; title: string; detail: string; severity: string }>,
      whatsappSummary: (parsed.whatsapp_summary ?? "") as string,
    };
  } catch {
    return { insights: [], whatsappSummary: "" };
  }
}

// ─── Process a single user ────────────────────────────────────────────────────
async function processUser(profile: {
  id: string;
  display_name: string | null;
  currency_default: string;
  whatsapp_phone: string | null;
}) {
  const supabase = db();
  try {
    const ctx = await buildUserContext(profile.id, profile.currency_default ?? "UYU");

    // Skip users with no transactions in the last 30 days
    if (ctx.topCategories.length === 0 && ctx.monthIncome === 0) return;

    const userName = profile.display_name ?? "Usuario";
    const { insights, whatsappSummary } = await generateInsights(ctx, userName);

    if (insights.length === 0) return;

    const today = new Date();
    const periodStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const periodEnd = today.toISOString().split("T")[0];

    // Store in ai_insights
    const rows = insights.map(ins => ({
      user_id: profile.id,
      period_start: periodStart,
      period_end: periodEnd,
      kind: ins.kind,
      title: ins.title,
      detail: ins.detail,
      severity: ins.severity,
      source: "cron_weekly",
      whatsapp_sent: false,
      is_read: false,
      payload_json: { generated_at: today.toISOString(), ctx_summary: { ...ctx, topCategories: ctx.topCategories.slice(0, 3) } },
    }));

    await supabase.from("ai_insights").insert(rows);

    // Send WhatsApp summary if user has phone linked
    if (profile.whatsapp_phone && whatsappSummary) {
      const fmt = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short" }).format(today);
      const msg = `📊 *Resumen semanal FlowMind* — ${fmt}\n\n${whatsappSummary}\n\n_Ver análisis completo en la app →_`;
      await sendWA(profile.whatsapp_phone, msg);
      await supabase.from("ai_insights").update({ whatsapp_sent: true })
        .eq("user_id", profile.id).eq("period_end", periodEnd).eq("source", "cron_weekly");
    }
  } catch (e) {
    console.error(`[cron:ai-insights] Error processing user ${profile.id}:`, e);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, currency_default, whatsapp_phone")
    .eq("plan", "pro"); // Only pro users get AI insights

  if (error || !profiles) {
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }

  // Process users in batches of 5 to avoid overwhelming GPT
  const results = { processed: 0, errors: 0 };
  for (let i = 0; i < profiles.length; i += 5) {
    const batch = profiles.slice(i, i + 5);
    await Promise.allSettled(batch.map(p => processUser(p).then(() => results.processed++).catch(() => results.errors++)));
  }

  return NextResponse.json({ ok: true, ...results });
}

// Also allow POST for manual triggers
export { GET as POST };
