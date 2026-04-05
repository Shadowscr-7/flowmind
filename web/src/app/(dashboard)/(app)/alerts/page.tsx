"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Target,
  TrendingDown,
  RefreshCw,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/lib/types";

const notifIcons: Record<string, React.ReactNode> = {
  budget_exceeded: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  goal_reached: <Target className="h-4 w-4 text-emerald-500" />,
  large_expense: <TrendingDown className="h-4 w-4 text-red-500" />,
  recurring_due: <RefreshCw className="h-4 w-4 text-blue-500" />,
  info: <Info className="h-4 w-4 text-indigo-500" />,
};

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    const supabase = createClient();
    const now = new Date().toISOString();

    await supabase
      .from("notifications")
      .update({ read_at: now })
      .is("read_at", null);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? now }))
    );
    setMarkingAll(false);
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

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
      <Header title="Alertas y notificaciones" />
      <main className="flex-1 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-500" />
            <span className="text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} sin leer`
                : "Todo leído"}
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
              Marcar todo como leído
            </Button>
          )}
        </div>

        {/* Notifications */}
        <Card padding={false}>
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <CardHeader title="Notificaciones" />
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                No hay notificaciones aún
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {notifications.map((notif) => {
                const isUnread = !notif.read_at;
                const icon =
                  notifIcons[notif.type] ?? notifIcons.info;

                return (
                  <li
                    key={notif.id}
                    className={`px-6 py-4 flex gap-4 transition-colors ${
                      isUnread ? "bg-indigo-50/40" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className="h-9 w-9 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className={`text-sm font-medium ${
                              isUnread ? "text-slate-900" : "text-slate-600"
                            }`}
                          >
                            {notif.title}
                            {isUnread && (
                              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-indigo-600 align-middle" />
                            )}
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5">
                            {notif.body}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {formatDate(notif.created_at)}
                          </div>
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
      </main>
    </>
  );
}
