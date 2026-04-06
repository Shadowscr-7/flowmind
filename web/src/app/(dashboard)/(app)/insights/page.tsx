"use client";

import { useState, useEffect, useMemo } from "react";
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Info, Zap, Target, BarChart2, Bell, Check } from "lucide-react";
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
  id?: string;
  kind: string;
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
  created_at?: string;
  source?: string;
  is_read?: boolean;
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
  info:     { card: "border-indigo-100 bg-indigo-50/50",  icon: "text-indigo-500",  badge: "bg-indigo-100 text-indigo-700" },
  warn:     { card: "border-amber-100 bg-amber-50/50",    icon: "text-amber-500",   badge: "bg-amber-100 text-amber-700" },
  critical: { card: "border-red-100 bg-red-50/50",        icon: "text-red-500",     badge: "bg-red-100 text-red-700" },
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function InsightsPage() {
  const supabase = useMemo(() => createClient(), []);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [savedInsights, setSavedInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [currency, setCurrency] = useState("UYU");
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });

  useEffect(() => { loadCharts(); loadSavedInsights(); }, []);

  // Load previously generated insights from DB
  async function loadSavedInsights() {
    setLoadingSaved(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("ai_insights")
      .select("id, kind, title, detail, severity, created_at, source, is_read")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setSavedInsights((data as Insight[]) ?? []);
    setLoadingSaved(false);
  }

  async function markRead(id: string) {
    await supabase.from("ai_insights").update({ is_read: true }).eq("id", id);
    setSavedInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
  }

  async function loadCharts() {
    setLoadingCharts(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("currency_default").eq("id", user.id).single();
    setCurrency(profile?.currency_default ?? "UYU");

    const { start, end } = getMonthRange();
    const { data: txs } = await supabase
      .from("transactions").select("amount, categories!category_id(name)")
      .eq("user_id", user.id).eq("type", "expense").gte("date", start).lte("date", end);

    const catMap = new Map<string, { name: string; value: number }>();
    for (const tx of txs ?? []) {
      const cat = tx.categories as unknown as { name: string } | null;
      const key = cat?.name ?? "Sin categoría";
      catMap.set(key, { name: key, value: (catMap.get(key)?.value ?? 0) + (tx.amount as number) });
    }
    setCategoryData(
      Array.from(catMap.values()).sort((a, b) => b.value - a.value)
        .map((c, i) => ({ ...c, color: CHART_COLORS[i % CHART_COLORS.length] }))
    );

    const trend: TrendData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const { start: mStart, end: mEnd } = getMonthRange(d);
      const label = new Intl.DateTimeFormat("es-UY", { month: "short" }).format(d);
      const { data: mTxs } = await supabase.from("transactions").select("type, amount").eq("user_id", user.id).gte("date", mStart).lte("date", mEnd);
      trend.push({
        month: label,
        income: (mTxs ?? []).filter(t => t.type === "income").reduce((s, t) => s + (t.amount as number), 0),
        expenses: (mTxs ?? []).filter(t => t.type === "expense").reduce((s, t) => s + (t.amount as number), 0),
      });
    }
    setTrendData(trend);
    setLoadingCharts(false);
  }

  async function generateInsights() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setInsights(json.insights ?? []);
      setSummary(json.summary ?? null);
      await loadSavedInsights(); // refresh saved list
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }

  const [month, year] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS[month - 1]} ${year}`;
  const unreadCount = savedInsights.filter(i => !i.is_read).length;

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
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Button onClick={generateInsights} loading={generating} icon={<Sparkles className="h-4 w-4" />}>
              Generar análisis
            </Button>
            {insights.length > 0 && (
              <Button variant="secondary" onClick={generateInsights} loading={generating} icon={<RefreshCw className="h-4 w-4" />}>
                Regenerar
              </Button>
            )}
          </div>

          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Ingresos",   value: formatCurrency(summary.total_income,    currency), color: "text-emerald-600" },
                { label: "Gastos",     value: formatCurrency(summary.total_expenses,  currency), color: "text-red-500" },
                { label: "Neto",       value: formatCurrency(summary.net,             currency), color: summary.net >= 0 ? "text-emerald-600" : "text-red-500" },
                { label: "Burn diario",value: formatCurrency(summary.daily_burn_rate, currency), color: "text-slate-600" },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          )}

          <InsightList insights={insights} monthLabel={monthLabel} />

          {!generating && insights.length === 0 && !error && (
            <div className="text-center py-10 text-slate-400">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Seleccioná un período y generá tu análisis</p>
              <p className="text-xs mt-1 text-slate-300">También recibís análisis automáticos cada lunes por WhatsApp</p>
            </div>
          )}
        </Card>

        {/* Saved/historical insights from cron */}
        {!loadingSaved && savedInsights.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-indigo-500" />
                  Historial de análisis
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount} nuevo{unreadCount > 1 ? "s" : ""}</span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Generados automáticamente cada semana</p>
              </div>
            </div>
            <div className="space-y-2">
              {savedInsights.map(ins => {
                const styles = SEVERITY_STYLES[ins.severity] ?? SEVERITY_STYLES.info;
                const Icon = KIND_ICONS[ins.kind] ?? Info;
                return (
                  <div key={ins.id} className={`p-3 rounded-xl border transition-all ${ins.is_read ? "opacity-60" : ""} ${styles.card}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${styles.icon}`}><Icon className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{ins.title}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                            {ins.severity === "critical" ? "Crítico" : ins.severity === "warn" ? "Atención" : "Info"}
                          </span>
                          {ins.source === "cron_weekly" && (
                            <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">Semanal</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{ins.detail}</p>
                        {ins.created_at && (
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(ins.created_at).toLocaleDateString("es-UY")}</p>
                        )}
                      </div>
                      {!ins.is_read && ins.id && (
                        <button onClick={() => markRead(ins.id!)} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors" title="Marcar como leído">
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

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

function InsightList({ insights, monthLabel }: { insights: Insight[]; monthLabel: string }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600">{monthLabel}</h3>
      {insights.map((insight, i) => {
        const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
        const Icon = KIND_ICONS[insight.kind] ?? Info;
        return (
          <div key={i} className={`p-4 rounded-xl border ${styles.card}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 ${styles.icon}`}><Icon className="h-5 w-5" /></div>
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
  );
}
