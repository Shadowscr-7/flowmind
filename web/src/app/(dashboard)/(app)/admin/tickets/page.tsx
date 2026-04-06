"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import {
  Ticket, MessageSquare, Globe, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Send, RefreshCw,
} from "lucide-react";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

type TicketStatus = "open" | "in_progress" | "resolved";

interface SupportTicket {
  id: string;
  user_id: string | null;
  phone: string | null;
  display_name: string | null;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: "low" | "normal" | "high" | "urgent";
  source: "web" | "whatsapp";
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

const STATUS_META: Record<TicketStatus, { label: string; icon: React.ReactNode; color: string }> = {
  open:        { label: "Abierto",      icon: <AlertCircle className="h-3.5 w-3.5" />,  color: "bg-red-100 text-red-700" },
  in_progress: { label: "En proceso",   icon: <Clock className="h-3.5 w-3.5" />,         color: "bg-amber-100 text-amber-700" },
  resolved:    { label: "Resuelto",     icon: <CheckCircle2 className="h-3.5 w-3.5" />,  color: "bg-emerald-100 text-emerald-700" },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-slate-100 text-slate-600",
  normal: "bg-blue-100 text-blue-700",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function TicketRow({
  ticket,
  onUpdate,
}: {
  ticket: SupportTicket;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(ticket.admin_notes ?? "");
  const [saving, setSaving] = useState(false);

  async function updateTicket(status: TicketStatus) {
    setSaving(true);
    await fetch("/api/admin/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status, admin_notes: notes }),
    });
    setSaving(false);
    onUpdate();
  }

  const statusMeta = STATUS_META[ticket.status];

  return (
    <div className={`border rounded-xl transition-all ${ticket.status === "resolved" ? "opacity-60" : "border-slate-200"}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className="mt-0.5 shrink-0 text-slate-400">
          {ticket.source === "whatsapp"
            ? <MessageSquare className="h-4 w-4 text-green-500" />
            : <Globe className="h-4 w-4 text-indigo-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800">{ticket.subject}</p>
            <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusMeta.color}`}>
              {statusMeta.icon}{statusMeta.label}
            </span>
            {ticket.priority !== "normal" && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[ticket.priority]}`}>
                {ticket.priority === "urgent" ? "Urgente" : ticket.priority === "high" ? "Alta" : "Baja"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {ticket.display_name ?? ticket.phone ?? "Anónimo"}
            {ticket.phone && ` · ${ticket.phone}`}
            <span className="ml-2 text-slate-400">{timeAgo(ticket.created_at)}</span>
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">Mensaje del usuario</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{ticket.message}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Respuesta / notas internas
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Escribí una respuesta o nota interna..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {ticket.status !== "in_progress" && ticket.status !== "resolved" && (
              <Button
                variant="secondary"
                size="sm"
                loading={saving}
                icon={<Clock className="h-3.5 w-3.5" />}
                onClick={() => updateTicket("in_progress")}
              >
                Marcar en proceso
              </Button>
            )}
            {ticket.status !== "resolved" && (
              <Button
                size="sm"
                loading={saving}
                icon={<Send className="h-3.5 w-3.5" />}
                onClick={() => updateTicket("resolved")}
              >
                Resolver{ticket.phone ? " y notificar por WhatsApp" : ""}
              </Button>
            )}
            {ticket.status === "resolved" && notes !== (ticket.admin_notes ?? "") && (
              <Button
                variant="secondary"
                size="sm"
                loading={saving}
                onClick={() => updateTicket("resolved")}
              >
                Guardar nota
              </Button>
            )}
            {ticket.resolved_at && (
              <p className="text-xs text-slate-400">
                Resuelto: {new Date(ticket.resolved_at).toLocaleDateString("es-UY")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "in_progress" | "resolved" | "all">("open");
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== ADMIN_EMAIL) {
        router.replace("/dashboard");
      } else {
        setAuthorized(true);
      }
    });
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/tickets?status=${filter}`);
    const json = await res.json();
    setTickets(json.tickets ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (authorized) load();
  }, [authorized, load]);

  if (authorized === null) return <FullPageSpinner />;

  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;

  return (
    <>
      <Header title="Tickets de soporte" />
      <main className="flex-1 p-6 space-y-4">

        {/* Filter tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {([
              { key: "open",        label: "Abiertos",    count: undefined },
              { key: "in_progress", label: "En proceso",  count: undefined },
              { key: "resolved",    label: "Resueltos",   count: undefined },
              { key: "all",         label: "Todos",       count: undefined },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>
            Actualizar
          </Button>
        </div>

        {/* Stats row */}
        {filter === "all" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Abiertos",   value: openCount,       color: "text-red-600" },
              { label: "En proceso", value: inProgressCount, color: "text-amber-600" },
              { label: "Total",      value: tickets.length,  color: "text-slate-700" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <Card>
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Cargando...</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center">
              <Ticket className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                {filter === "open" ? "No hay tickets abiertos" : "No hay tickets en esta categoría"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => (
                <TicketRow key={t.id} ticket={t} onUpdate={load} />
              ))}
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
