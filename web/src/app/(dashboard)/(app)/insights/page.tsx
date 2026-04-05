"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Info, Zap, Target, BarChart2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SpendingByCategory } from "@/components/charts/SpendingByCategory";
import { BalanceTrend } from "@/components/charts/BalanceTrend";
import { formatCurrency, getMonthRange } from "@/lib/utils";

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

interface Insight {
  kind: string;
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
}

interface InsightSummary {
  month: string;
  total_income: number;
  total_expenses: number;
  net: number;
  total_balance: number;
  transaction_count: number;
  daily_burn_rate: number;
  projected_month_total: number;
  days_left: number;
}

interface CategoryData { name: string; value: number; color: string; }
interface TrendData { month: string; income: number; expenses: number; }

const KIND_ICONS: Record<string, typeof Info> = {
  spend_change: TrendingUp,
  anomaly: AlertTriangle,
  suggestion: Zap,
  forecast: Target,
  summary: BarChart2,
  trend: TrendingUp,
};

const SEVERITY_STYLES: Record<string, { card: string; icon: string; badge: string }> = {
  info: {
    card: "border-indigo-100 bg-indigo-50/50",
    icon: "text-indigo-500",
    badge: "bg-indigo-100 text-indigo-700",
  },
  warn: {
    card: "border-amber-100 bg-amber-50/50",
    icon: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
  critical: {
    card: "border-red-100 bg-red-50/50",
    icon: "text-red-500",
    badge: "bg-red-100 text-red-700",
  },
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function InsightsPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [currency, setCurrency] = useState("UYU");
  const [loadingCharts, setLoadingCharts] = useState(true);

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });

  useEffect(() => {
    loadCharts();
  }, []);

  async function loadCharts() {
    setLoadingCharts(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("currency_default, plan")
      .eq("id", user.id)
      .single();
    setCurrency(profile?.currency_default ?? "UYU");

const { start, end } = getMonthRange();
    const { data: txs } = await supabase
      .from("transactions")
      .select("amount, categories(id, name)")
      .eq("type", "expense")
      .gte("date", start)
      .lte("date", end);

    const catMap = new Map<string, { name: string; value: number }>();
    for (const tx of txs ?? []) {
      const cat = tx.categories as unknown as { id: string; name: string } | null;
      const key = cat?.id ?? "uncategorized";
      const name = cat?.name ?? "Sin categoría";
      catMap.set(key, { name, value: (catMap.get(key)?.value ?? 0) + (tx.amount as number) });
    }
    const catArr = Array.from(catMap.values())
      .sort((a, b) => b.value - a.value)
      .map((c, i) => ({ name: c.name, value: c.value, color: CHART_COLORS[i % CHART_COLORS.length] }));
    setCategoryData(catArr);

    const trend: TrendData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const { start: mStart, end: mEnd } = getMonthRange(d);
      const monthLabel = new Intl.DateTimeFormat("es-UY", { month: "short" }).format(d);
      const { data: monthTxs } = await supabase
        .from("transactions").select("type, amount").gte("date", mStart).lte("date", mEnd);
      const income = (monthTxs ?? []).filter(t => t.type === "income").reduce((s, t) => s + (t.amount as number), 0);
      const expenses = (monthTxs ?? []).filter(t => t.type === "expense").reduce((s, t) => s + (t.amount as number), 0);
      trend.push({ month: monthLabel, income, expenses });
    }
    setTrendData(trend);
    setLoadingCharts(false);
  }

  async function generateInsights(refresh = false) {
    setGenerating(true);
    setError(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/insights-summary`);
      url.searchParams.set("month", selectedMonth);
      if (refresh) url.searchParams.set("refresh", "true");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setInsights(json.insights ?? []);
      setSummary(json.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }

  const [month, year] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <>
      <Header title="Insights IA" />
      <main className="flex-1 p-6 space-y-6">

        {/* Generator */}
        <Card>
          <CardHeader
            title="Análisis inteligente"
            subtitle="La IA analiza tus finanzas y te da sugerencias accionables"
          />
          <div className="flex flex-wrap items-end gap-3 mb-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Período</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => generateInsights(false)}
              loading={generating}
              icon={<Sparkles className="h-4 w-4" />}
            >
              Generar análisis
            </Button>
            {insights.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => generateInsights(true)}
                loading={generating}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Regenerar
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
          )}

          {/* Summary strip */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Ingresos", value: formatCurrency(summary.total_income, currency), color: "text-emerald-600" },
                { label: "Gastos", value: formatCurrency(summary.total_expenses, currency), color: "text-red-500" },
                { label: "Neto", value: formatCurrency(summary.net, currency), color: summary.net >= 0 ? "text-emerald-600" : "text-red-500" },
                { label: "Burn diario", value: formatCurrency(summary.daily_burn_rate, currency), color: "text-slate-600" },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Insight cards */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-600">{monthLabel}</h3>
              {insights.map((insight, i) => {
                const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
                const Icon = KIND_ICONS[insight.kind] ?? Info;
                return (
                  <div key={i} className={`p-4 rounded-xl border ${styles.card}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${styles.icon}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{insight.title}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
                            {insight.severity === "critical" ? "Crítico" : insight.severity === "warn" ? "Atención" : "Info"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{insight.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!generating && insights.length === 0 && !error && (
            <div className="text-center py-10 text-slate-400">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Seleccioná un período y generá tu análisis</p>
            </div>
          )}
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Gastos por categoría" subtitle="Mes actual" />
            {loadingCharts ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Cargando...</div>
            ) : categoryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Sin gastos este mes</div>
            ) : (
              <>
                <SpendingByCategory data={categoryData} currency={currency} />
                <div className="mt-4 space-y-2">
                  {categoryData.slice(0, 5).map(cat => (
                    <div key={cat.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm" style={{ background: cat.color }} />
                        <span className="text-slate-600">{cat.name}</span>
                      </div>
                      <span className="font-medium text-slate-800">{formatCurrency(cat.value, currency)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Tendencia mensual" subtitle="Últimos 6 meses" />
            {loadingCharts ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Cargando...</div>
            ) : (
              <BalanceTrend data={trendData} currency={currency} />
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
