import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getSupabaseClient,
  callLLM,
  jsonResponse,
  errorResponse,
  corsHeaders,
} from "../_shared/utils.ts";

const INSIGHTS_PROMPT = `Eres un analista financiero personal. Analiza los datos de transacciones del usuario y genera insights útiles.

Responde con un JSON array de insights:
[
  {
    "kind": "spend_change" | "anomaly" | "suggestion" | "forecast" | "summary" | "trend",
    "title": "Título corto del insight",
    "detail": "Explicación detallada y accionable",
    "severity": "info" | "warn" | "critical"
  }
]

Reglas:
- Máximo 5 insights
- Sé específico con números y porcentajes
- Da sugerencias accionables
- Si ves anomalías (gastos inusuales), marcar como "warn"
- Si el saldo tiende a negativo, "critical"
- Usar lenguaje amigable y directo
- Responder en español`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabase = getSupabaseClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    // Parse month from query params
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");

    // Check if user has Pro plan (free users get limited insights)
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const isPro = profile?.plan === "pro";

    const now = new Date();
    const year = monthParam
      ? parseInt(monthParam.split("-")[0])
      : now.getFullYear();
    const month = monthParam
      ? parseInt(monthParam.split("-")[1])
      : now.getMonth() + 1;

    // Get transactions for the month
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, amount, currency, date, merchant, category:categories(name)")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    // Get accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("name, current_balance, currency")
      .eq("user_id", user.id);

    // Get previous month for comparison
    const prevStartDate = new Date(year, month - 2, 1).toISOString();
    const prevEndDate = new Date(year, month - 1, 0, 23, 59, 59).toISOString();

    const { data: prevTransactions } = await supabase
      .from("transactions")
      .select("type, amount")
      .eq("user_id", user.id)
      .gte("date", prevStartDate)
      .lte("date", prevEndDate);

    // Calculate summary
    const totalExpenses = (transactions || [])
      .filter((t: any) => t.type === "expense")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalIncome = (transactions || [])
      .filter((t: any) => t.type === "income")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const prevExpenses = (prevTransactions || [])
      .filter((t: any) => t.type === "expense")
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const prevIncome = (prevTransactions || [])
      .filter((t: any) => t.type === "income")
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalBalance = (accounts || []).reduce(
      (sum: number, a: any) => sum + a.current_balance,
      0
    );

    // Days left in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = Math.min(now.getDate(), daysInMonth);
    const daysLeft = daysInMonth - currentDay;
    const dailyBurnRate = currentDay > 0 ? totalExpenses / currentDay : 0;
    const projectedTotal = totalExpenses + dailyBurnRate * daysLeft;

    const context = `
Resumen del mes ${month}/${year}:
- Gastos totales: ${totalExpenses}
- Ingresos totales: ${totalIncome}
- Neto: ${totalIncome - totalExpenses}
- Saldo total actual: ${totalBalance}
- Mes anterior gastos: ${prevExpenses}
- Mes anterior ingresos: ${prevIncome}
- Días restantes: ${daysLeft}
- Burn rate diario: ${dailyBurnRate.toFixed(0)}
- Proyección gasto total del mes: ${projectedTotal.toFixed(0)}
- Transacciones del mes: ${(transactions || []).length}

Top gastos por categoría:
${JSON.stringify(
  (transactions || [])
    .filter((t: any) => t.type === "expense")
    .reduce((acc: any, t: any) => {
      const cat = t.category?.name || "Sin categoría";
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {}),
  null,
  2
)}

Cuentas: ${JSON.stringify(accounts)}`;

    // Check for existing insights this period
    const { data: existingInsights } = await supabase
      .from("ai_insights")
      .select("id")
      .eq("user_id", user.id)
      .eq("period_start", startDate.split("T")[0])
      .eq("period_end", endDate.split("T")[0]);

    let insights;

    if (
      !existingInsights ||
      existingInsights.length === 0 ||
      url.searchParams.get("refresh") === "true"
    ) {
      // Generate new insights
      const llmResponse = await callLLM(INSIGHTS_PROMPT, context);
      const parsedInsights = JSON.parse(llmResponse);

      // Save insights
      const insightRecords = (
        Array.isArray(parsedInsights) ? parsedInsights : [parsedInsights]
      ).map((insight: any) => ({
        user_id: user.id,
        period_start: startDate.split("T")[0],
        period_end: endDate.split("T")[0],
        kind: insight.kind || "summary",
        title: insight.title,
        detail: insight.detail,
        severity: insight.severity || "info",
        payload_json: {},
      }));

      // Delete old insights for this period
      if (existingInsights && existingInsights.length > 0) {
        await supabase
          .from("ai_insights")
          .delete()
          .eq("user_id", user.id)
          .eq("period_start", startDate.split("T")[0]);
      }

      const { data: savedInsights } = await supabase
        .from("ai_insights")
        .insert(insightRecords)
        .select();

      insights = savedInsights;
    } else {
      // Return existing insights
      const { data: fetchedInsights } = await supabase
        .from("ai_insights")
        .select()
        .eq("user_id", user.id)
        .eq("period_start", startDate.split("T")[0])
        .order("created_at", { ascending: false });

      insights = fetchedInsights;
    }

    return jsonResponse({
      success: true,
      is_pro: isPro,
      summary: {
        month: `${year}-${String(month).padStart(2, "0")}`,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net: totalIncome - totalExpenses,
        total_balance: totalBalance,
        transaction_count: (transactions || []).length,
        daily_burn_rate: dailyBurnRate,
        projected_month_total: projectedTotal,
        days_left: daysLeft,
      },
      // Free users only get the first 2 insights; Pro users get all
      insights: isPro
        ? (insights || [])
        : (insights || []).slice(0, 2),
    });
  } catch (error) {
    console.error("insights-summary error:", error);
    return errorResponse(`Error: ${error.message}`, 500);
  }
});
