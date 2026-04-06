"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell, CheckCheck, AlertTriangle, Target, TrendingDown, RefreshCw, Info,
  Plus, Trash2, ToggleLeft, ToggleRight, ShoppingCart, CreditCard, Zap, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/lib/types";

// ─── Smart Alert types ────────────────────────────────────────────────────────

type AlertType = "spending_limit" | "low_balance" | "goal_milestone" | "weekly_summary" | "unusual_spending";

interface SmartAlert {
  id: string;
  type: AlertType;
  title: string;
  is_active: boolean;
  threshold_amount: number | null;
  period: "daily" | "weekly" | "monthly" | null;
  category_id: string | null;
  account_id: string | null;
  notify_whatsapp: boolean;
  notify_web: boolean;
  last_triggered_at: string | null;
  created_at: string;
  categories?: { name: string } | null;
  accounts?: { name: string } | null;
}

interface Category { id: string; name: string; }
interface Account { id: string; name: string; type: string; }

const TYPE_META: Record<AlertType, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  spending_limit:    { label: "Límite de gasto",      icon: <ShoppingCart className="h-4 w-4" />,    description: "Alertá cuando gastes más de X en un período", color: "text-amber-500 bg-amber-50 border-amber-100" },
  low_balance:       { label: "Saldo bajo",            icon: <CreditCard className="h-4 w-4" />,       description: "Alertá cuando una cuenta baje de X",           color: "text-red-500 bg-red-50 border-red-100" },
  goal_milestone:    { label: "Hito de meta",          icon: <Target className="h-4 w-4" />,           description: "Celebrá cuando una meta alcance cierto %",     color: "text-emerald-500 bg-emerald-50 border-emerald-100" },
  weekly_summary:    { label: "Resumen semanal",       icon: <RefreshCw className="h-4 w-4" />,        description: "Recibí un resumen cada semana por WhatsApp",   color: "text-indigo-500 bg-indigo-50 border-indigo-100" },
  unusual_spending:  { label: "Gasto inusual",         icon: <Zap className="h-4 w-4" />,              description: "Detectá gastos fuera de lo normal",            color: "text-violet-500 bg-violet-50 border-violet-100" },
};

const PERIOD_LABELS: Record<string, string> = { daily: "día", weekly: "semana", monthly: "mes" };

function describeAlert(alert: SmartAlert): string {
  const catName = alert.categories?.name;
  const accName = alert.accounts?.name;
  switch (alert.type) {
    case "spending_limit":
      return `${alert.threshold_amount ? `Límite $${alert.threshold_amount.toLocaleString("es-UY")}` : ""}${catName ? ` en ${catName}` : ""}${alert.period ? ` por ${PERIOD_LABELS[alert.period]}` : ""}`;
    case "low_balance":
      return `Saldo < $${alert.threshold_amount?.toLocaleString("es-UY") ?? "–"}${accName ? ` en ${accName}` : ""}`;
    case "goal_milestone":
      return `Al alcanzar ${alert.threshold_amount ?? 50}% de progreso en una meta`;
    case "weekly_summary":
      return "Resumen financiero cada lunes";
    case "unusual_spending":
      return `Gasto ${alert.threshold_amount ? `>${alert.threshold_amount}%` : ""} del promedio${catName ? ` en ${catName}` : ""}`;
    default:
      return "";
  }
}

// ─── Notification icons ───────────────────────────────────────────────────────

const notifIcons: Record<string, React.ReactNode> = {
  budget_exceeded: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  goal_reached:    <Target className="h-4 w-4 text-emerald-500" />,
  large_expense:   <TrendingDown className="h-4 w-4 text-red-500" />,
  recurring_due:   <RefreshCw className="h-4 w-4 text-blue-500" />,
  smart_alert:     <Bell className="h-4 w-4 text-indigo-500" />,
  info:            <Info className="h-4 w-4 text-indigo-500" />,
};

// ─── Create Alert Modal ───────────────────────────────────────────────────────

function CreateAlertModal({
  categories,
  accounts,
  onClose,
  onCreated,
}: {
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [type, setType] = useState<AlertType>("spending_limit");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [notifyWA, setNotifyWA] = useState(true);
  const [notifyWeb, setNotifyWeb] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildTitle(): string {
    const catName = categories.find(c => c.id === categoryId)?.name;
    const accName = accounts.find(a => a.id === accountId)?.name;
    switch (type) {
      case "spending_limit":    return `Límite${catName ? ` ${catName}` : ""} ${period === "monthly" ? "mensual" : period === "weekly" ? "semanal" : "diario"}`;
      case "low_balance":       return `Saldo bajo${accName ? ` — ${accName}` : ""}`;
      case "goal_milestone":    return `Hito de meta al ${amount || 50}%`;
      case "weekly_summary":    return "Resumen semanal";
      case "unusual_spending":  return `Gasto inusual${catName ? ` — ${catName}` : ""}`;
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const row: Record<string, unknown> = {
        user_id: user.id,
        type,
        title: buildTitle(),
        is_active: true,
        notify_whatsapp: notifyWA,
        notify_web: notifyWeb,
      };

      if (["spending_limit", "low_balance", "unusual_spending"].includes(type) && amount)
        row.threshold_amount = parseFloat(amount);
      if (type === "goal_milestone" && amount)
        row.threshold_amount = parseFloat(amount);
      if (["spending_limit", "unusual_spending"].includes(type))
        row.period = period;
      if (["spending_limit", "unusual_spending"].includes(type) && categoryId)
        row.category_id = categoryId;
      if (type === "low_balance" && accountId)
        row.account_id = accountId;

      const { error: dbErr } = await supabase.from("smart_alerts").insert(row);
      if (dbErr) throw dbErr;
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Nueva alerta</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type grid */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">Tipo de alerta</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(TYPE_META) as AlertType[]).map(t => {
                const meta = TYPE_META[t];
                const selected = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selected ? "border-indigo-300 bg-indigo-50" : "border-slate-100 hover:border-slate-200"}`}
                  >
                    <span className={`mt-0.5 ${selected ? "text-indigo-600" : "text-slate-400"}`}>{meta.icon}</span>
                    <div>
                      <p className={`text-xs font-semibold ${selected ? "text-indigo-700" : "text-slate-700"}`}>{meta.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{meta.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          {["spending_limit", "low_balance", "unusual_spending", "goal_milestone"].includes(type) && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {type === "goal_milestone" ? "Porcentaje (%)" : "Monto límite"}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={type === "goal_milestone" ? "50" : "0"}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Period */}
          {["spending_limit", "unusual_spending"].includes(type) && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Período</label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as typeof period)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          )}

          {/* Category */}
          {["spending_limit", "unusual_spending"].includes(type) && categories.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Categoría (opcional)</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Todas las categorías</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Account */}
          {type === "low_balance" && accounts.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Cuenta (opcional)</label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Cualquier cuenta</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Notify channels */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">Notificar por</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={notifyWeb} onChange={e => setNotifyWeb(e.target.checked)} className="rounded" />
                <span className="text-sm text-slate-700">App</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={notifyWA} onChange={e => setNotifyWA(e.target.checked)} className="rounded" />
                <span className="text-sm text-slate-700">WhatsApp</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">Crear alerta</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onToggle,
  onDelete,
}: {
  alert: SmartAlert;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const meta = TYPE_META[alert.type] ?? TYPE_META.spending_limit;
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${alert.is_active ? "border-slate-100 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
      <div className={`mt-0.5 shrink-0 p-1.5 rounded-lg border ${meta.color}`}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{describeAlert(alert)}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {alert.notify_whatsapp && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">WhatsApp</span>}
          {alert.notify_web && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">App</span>}
          {alert.last_triggered_at && (
            <span className="text-[10px] text-slate-400">Último: {new Date(alert.last_triggered_at).toLocaleDateString("es-UY")}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onToggle(alert.id, !alert.is_active)}
          className="text-slate-400 hover:text-indigo-600 transition-colors"
          title={alert.is_active ? "Desactivar" : "Activar"}
        >
          {alert.is_active
            ? <ToggleRight className="h-5 w-5 text-indigo-500" />
            : <ToggleLeft className="h-5 w-5" />}
        </button>
        <button
          onClick={() => onDelete(alert.id)}
          className="text-slate-300 hover:text-red-500 transition-colors"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"alerts" | "history">("alerts");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [
      { data: notifs },
      { data: alerts },
      { data: cats },
      { data: accs },
    ] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("smart_alerts").select("*, categories(name), accounts(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("categories").select("id, name").eq("user_id", user.id).order("name"),
      supabase.from("accounts").select("id, name, type").eq("user_id", user.id).eq("is_active", true),
    ]);

    setNotifications((notifs as Notification[]) ?? []);
    setSmartAlerts((alerts as SmartAlert[]) ?? []);
    setCategories((cats as Category[]) ?? []);
    setAccounts((accs as Account[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })));
    setMarkingAll(false);
  }

  async function toggleAlert(id: string, active: boolean) {
    await supabase.from("smart_alerts").update({ is_active: active }).eq("id", id);
    setSmartAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: active } : a));
  }

  async function deleteAlert(id: string) {
    await supabase.from("smart_alerts").delete().eq("id", id);
    setSmartAlerts(prev => prev.filter(a => a.id !== id));
  }

  const unreadCount = notifications.filter(n => !n.read_at).length;
  const activeAlerts = smartAlerts.filter(a => a.is_active).length;

  if (loading) {
    return (
      <>
        <Header title="Alertas" />
        <FullPageSpinner />
      </>
    );
  }

  return (
    <>
      <Header title="Alertas" />
      <main className="flex-1 p-6 space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "alerts" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
          >
            Mis alertas
            {activeAlerts > 0 && (
              <span className="ml-1.5 text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">{activeAlerts}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "history" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
          >
            Historial
            {unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </button>
        </div>

        {/* Smart Alerts Tab */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <CardHeader
                  title="Alertas inteligentes"
                  subtitle="Recibí notificaciones cuando ocurran eventos importantes"
                />
                <Button
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setShowModal(true)}
                  size="sm"
                >
                  Nueva alerta
                </Button>
              </div>

              {smartAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <Bell className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No tenés alertas configuradas</p>
                  <p className="text-xs text-slate-300 mt-1">Creá una para no perderte nada importante</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Crear primera alerta
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {smartAlerts.map(alert => (
                    <AlertRow
                      key={alert.id}
                      alert={alert}
                      onToggle={toggleAlert}
                      onDelete={deleteAlert}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Quick templates */}
            {smartAlerts.length === 0 && (
              <Card>
                <CardHeader title="Plantillas rápidas" subtitle="Configuraciones populares para empezar" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {(Object.keys(TYPE_META) as AlertType[]).map(t => {
                    const meta = TYPE_META[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setShowModal(true)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left hover:shadow-sm transition-all ${meta.color}`}
                      >
                        <span className="mt-0.5 shrink-0">{meta.icon}</span>
                        <div>
                          <p className="text-xs font-semibold">{meta.label}</p>
                          <p className="text-[11px] opacity-70 mt-0.5">{meta.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Notifications History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-slate-500" />
                <span className="text-sm text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo leído"}
                </span>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={markingAll}
                  icon={<CheckCheck className="h-4 w-4" />}
                  onClick={markAllAsRead}
                >
                  Marcar todo leído
                </Button>
              )}
            </div>

            <Card padding={false}>
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <CardHeader title="Notificaciones recibidas" />
              </div>
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Sin notificaciones aún</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {notifications.map(notif => {
                    const isUnread = !notif.read_at;
                    const icon = notifIcons[notif.type] ?? notifIcons.info;
                    return (
                      <li key={notif.id} className={`px-6 py-4 flex gap-4 transition-colors ${isUnread ? "bg-indigo-50/40" : ""}`}>
                        <div className="h-9 w-9 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className={`text-sm font-medium ${isUnread ? "text-slate-900" : "text-slate-600"}`}>
                                {notif.title}
                                {isUnread && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-indigo-600 align-middle" />}
                              </div>
                              <div className="text-sm text-slate-500 mt-0.5">{notif.body}</div>
                              <div className="text-xs text-slate-400 mt-1">{formatDate(notif.created_at)}</div>
                            </div>
                            {isUnread && (
                              <button
                                className="shrink-0 text-xs text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
                                onClick={() => markAsRead(notif.id)}
                              >
                                Marcar leída
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        )}
      </main>

      {showModal && (
        <CreateAlertModal
          categories={categories}
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}
    </>
  );
}
