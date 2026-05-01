/**
 * POST /api/insights/generate
 * On-demand AI insights generation (called from the web Insights page)
 * Reuses the same analysis logic as the weekly cron
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

function serviceDb() { return createClient(SB_URL, SB_KEY); }

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

export async function POST(req: NextRequest) {
  // Auth
  const supabaseUser = await createServerClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { month } = await req.json().catch(() => ({}));
  const supabase = serviceDb();

  // Build period
  const today = new Date();
  let periodStart: string, periodEnd: string;
  if (month) {
    const [yr, mo] = month.split("-").map(Number);
    periodStart = `${yr}-${String(mo).padStart(2, "0")}-01`;
    const lastDay = new Date(yr, mo, 0).getDate();
    periodEnd = `${yr}-${String(mo).padStart(2, "0")}-${lastDay}`;
  } else {
    periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    periodEnd = today.toISOString().split("T")[0];
  }

  // Fetch data
  const [
    { data: profile },
    { data: txs },
    { data: accounts },
    { data: budgets },
    { data: goals },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, currency_default").eq("id", user.id).single(),
    supabase.from("transactions").select("type, amount, date, merchant, categories!category_id(name)")
      .eq("user_id", user.id).gte("date", periodStart).lte("date", periodEnd).order("date", { ascending: false }).limit(200),
    supabase.from("accounts").select("name, type, balance, currency").eq("user_id", user.id).eq("is_active", true),
    supabase.from("budgets").select("limit_amount, currency, categories(name)").eq("user_id", user.id),
    supabase.from("goals").select("name, target_amount, current_amount, currency, deadline").eq("user_id", user.id),
  ]);

  const currency = profile?.currency_default ?? "UYU";
  const userName = profile?.display_name ?? "Usuario";

  // Aggregate
  const catSpend: Record<string, number> = {};
  let totalIncome = 0, totalExpenses = 0;

  for (const tx of txs ?? []) {
    const catName = (tx.categories as unknown as { name: string } | null)?.name ?? "Sin categorÃ­a";
    if (tx.type === "expense") {
      catSpend[catName] = (catSpend[catName] ?? 0) + Number(tx.amount);
      totalExpenses += Number(tx.amount);
    } else if (tx.type === "income") {
      totalIncome += Number(tx.amount);
    }
  }

  const topCategories = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, amount]) => ({ name, amount }));

  const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0);
  const daysInPeriod = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000));
  const dailyBurn = totalExpenses / daysInPeriod;

  const budgetStatus = (budgets ?? []).map(b => {
    const catName = (b.categories as unknown as { name: string } | null)?.name ?? "?";
    const spent = catSpend[catName] ?? 0;
    return { category: catName, limit: Number(b.limit_amount), spent, pct: Math.round((spent / Number(b.limit_amount)) * 100) };
  });

  const goalStatus = (goals ?? []).map(g => ({
    name: g.name, target: Number(g.target_amount), current: Number(g.current_amount),
    pct: Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100),
    targetDate: g.deadline, currency: g.currency,
  }));

  // GPT analysis
  const system = `Sos un asesor financiero personal experto. AnalizÃ¡s los datos financieros del usuario y generÃ¡s insights accionables, personalizados y en espaÃ±ol rioplatense.

GenerÃ¡ entre 4 y 6 insights variados y especÃ­ficos. Tipos: spend_change, anomaly, suggestion, forecast, summary, trend.
Severidades: info (neutral/bueno), warn (atenciÃ³n), critical (problema urgente).
Tono: humano, directo y util; nada generico. Cada insight debe mencionar un dato real del contexto y una accion concreta.
No des asesoramiento financiero regulado ni prometas resultados. Si faltan datos, pedi el proximo dato util como recomendacion.
Usa metas, presupuestos, saldos y tendencia de gasto para sugerir ahorro realista, alertas o ajustes de habitos.

RespondÃ© SOLO JSON:
{
  "insights": [
    { "kind": "...", "title": "...", "detail": "...", "severity": "info|warn|critical" }
  ],
  "summary": {
    "total_income": number,
    "total_expenses": number,
    "net": number,
    "total_balance": number,
    "transaction_count": number,
    "daily_burn_rate": number,
    "days_left": number,
    "projected_month_total": number
  }
}`;

  const userMsg = `Usuario: ${userName} | PerÃ­odo: ${periodStart} al ${periodEnd}
Saldo total: ${currency} ${totalBalance.toLocaleString("es-UY")}
Ingresos: ${currency} ${totalIncome.toLocaleString("es-UY")}
Gastos: ${currency} ${totalExpenses.toLocaleString("es-UY")}
Neto: ${currency} ${(totalIncome - totalExpenses).toLocaleString("es-UY")}
Burn diario: ${currency} ${dailyBurn.toFixed(0)}
Transacciones: ${(txs ?? []).length}

Top categorÃ­as de gasto:
${topCategories.map(c => `- ${c.name}: ${currency} ${c.amount.toLocaleString("es-UY")}`).join("\n") || "Sin gastos registrados"}

Presupuestos:
${budgetStatus.length ? budgetStatus.map(b => `- ${b.category}: ${b.pct}% usado`).join("\n") : "Sin presupuestos"}

Metas de ahorro:
${goalStatus.length ? goalStatus.map(g => `- ${g.name}: ${g.pct}% completado`).join("\n") : "Sin metas"}`;

  let insights: Array<{ kind: string; title: string; detail: string; severity: string }> = [];
  let summaryData = {
    month: month ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net: totalIncome - totalExpenses,
    total_balance: totalBalance,
    transaction_count: (txs ?? []).length,
    daily_burn_rate: dailyBurn,
    days_left: Math.max(0, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()),
    projected_month_total: dailyBurn * new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
  };

  try {
    const raw = await gpt(system, userMsg);
    const parsed = JSON.parse(raw);
    insights = parsed.insights ?? [];
    if (parsed.summary) summaryData = { ...summaryData, ...parsed.summary };
  } catch {
    insights = [];
  }

  // Persist to DB
  if (insights.length > 0) {
    await supabase.from("ai_insights").insert(
      insights.map(ins => ({
        user_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        kind: ins.kind,
        title: ins.title,
        detail: ins.detail,
        severity: ins.severity,
        source: "on_demand",
        is_read: false,
        whatsapp_sent: false,
      }))
    );
  }

  return NextResponse.json({ insights, summary: summaryData });
}
