"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import {
  Users,
  UserPlus,
  ShieldOff,
  ShieldCheck,
  Trash2,
  RefreshCw,
  X,
  Crown,
  Search,
} from "lucide-react";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  plan: string;
  ai_usage_count: number;
  banned: boolean;
  created_at: string;
  last_sign_in: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `hace ${days}d`;
  return formatDate(iso);
}

/* ─── Create user modal ─── */
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name: displayName || undefined }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Error al crear usuario");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">Crear nuevo usuario</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Contraseña * (mín. 6 caracteres)</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre (opcional)</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Plan badge info */}
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
            <Crown className="h-4 w-4 text-indigo-500 shrink-0" />
            <p className="text-xs text-indigo-700">
              El usuario se creará con <strong>Plan Pro</strong> activo de forma inmediata, sin verificación de pago.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={loading} icon={<UserPlus className="h-4 w-4" />} className="flex-1">
              Crear usuario
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm dialog ─── */
function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-5">{description}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button
            loading={loading}
            onClick={onConfirm}
            className={`flex-1 ${danger ? "!bg-red-600 hover:!bg-red-700" : ""}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── User row ─── */
function UserRow({ user, onAction }: { user: AdminUser; onAction: () => void }) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<"ban" | "unban" | "delete" | null>(null);

  async function executeAction(action: "ban" | "unban" | "delete") {
    setLoading(true);
    if (action === "delete") {
      await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
    } else {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, action }),
      });
    }
    setLoading(false);
    setConfirm(null);
    onAction();
  }

  return (
    <>
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${user.banned ? "border-red-100 bg-red-50/40" : "border-slate-100 bg-white"}`}>
        {/* Avatar placeholder */}
        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${user.banned ? "bg-red-100 text-red-500" : "bg-indigo-100 text-indigo-600"}`}>
          {(user.display_name ?? user.email).charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-800 truncate">
              {user.display_name ?? <span className="text-slate-400 italic">Sin nombre</span>}
            </p>
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              <Crown className="h-2.5 w-2.5" /> Pro
            </span>
            {user.banned && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                Desactivado
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Creado: {formatDate(user.created_at)} · Último acceso: {timeAgo(user.last_sign_in)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {user.banned ? (
            <button
              onClick={() => setConfirm("unban")}
              disabled={loading}
              title="Reactivar usuario"
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setConfirm("ban")}
              disabled={loading}
              title="Desactivar usuario"
              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-40"
            >
              <ShieldOff className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setConfirm("delete")}
            disabled={loading}
            title="Eliminar usuario"
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {confirm === "ban" && (
        <ConfirmDialog
          title="Desactivar usuario"
          description={`¿Desactivar a ${user.email}? No podrá iniciar sesión, pero sus datos se conservan.`}
          confirmLabel="Desactivar"
          danger
          loading={loading}
          onConfirm={() => executeAction("ban")}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "unban" && (
        <ConfirmDialog
          title="Reactivar usuario"
          description={`¿Reactivar a ${user.email}? Podrá volver a iniciar sesión.`}
          confirmLabel="Reactivar"
          loading={loading}
          onConfirm={() => executeAction("unban")}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "delete" && (
        <ConfirmDialog
          title="Eliminar usuario"
          description={`¿Eliminar permanentemente a ${user.email}? Esta acción no se puede deshacer y borrará todos sus datos.`}
          confirmLabel="Eliminar"
          danger
          loading={loading}
          onConfirm={() => executeAction("delete")}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ─── Main page ─── */
export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "banned">("all");

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
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    setUsers(json.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authorized) load();
  }, [authorized, load]);

  if (authorized === null) return <FullPageSpinner />;

  const filtered = users.filter(u => {
    if (filter === "active" && u.banned) return false;
    if (filter === "banned" && !u.banned) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalActive = users.filter(u => !u.banned).length;
  const totalBanned = users.filter(u => u.banned).length;

  return (
    <>
      <Header title="Gestión de usuarios" />

      <main className="flex-1 p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",        value: users.length,  color: "text-slate-700" },
            { label: "Activos",      value: totalActive,   color: "text-emerald-600" },
            { label: "Desactivados", value: totalBanned,   color: "text-red-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por email o nombre..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(["all", "active", "banned"] as const).map(key => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
              >
                {key === "all" ? "Todos" : key === "active" ? "Activos" : "Desactivados"}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={load}
          >
            Actualizar
          </Button>

          <Button
            size="sm"
            icon={<UserPlus className="h-4 w-4" />}
            onClick={() => setShowCreate(true)}
          >
            Crear usuario
          </Button>
        </div>

        {/* Users list */}
        <Card>
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                {search ? "No se encontraron usuarios" : "No hay usuarios en esta categoría"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(u => (
                <UserRow key={u.id} user={u} onAction={load} />
              ))}
            </div>
          )}
        </Card>
      </main>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </>
  );
}
