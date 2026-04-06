"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Pencil,
  Archive,
  ArchiveRestore,
  X,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  formatCurrency,
  formatDate,
  formatDateLong,
  transactionTypeColor,
  transactionAmountPrefix,
  getTransactionTypeLabel,
} from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";
import type { Category, Account, Transaction } from "@/lib/types";

const PAGE_SIZE = 20;

// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({
  tx,
  categories,
  accounts,
  onClose,
  onSaved,
}: {
  tx: Transaction;
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [merchant, setMerchant] = useState(tx.merchant ?? "");
  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.date ? tx.date.split("T")[0] : "");
  const [categoryId, setCategoryId] = useState(tx.category_id ?? "");
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [accountId, setAccountId] = useState(tx.account_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCats = categories.filter((c) =>
    tx.type === "income" ? c.type === "income" : c.type === "expense"
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant: merchant.trim() || null,
        amount: parsed,
        date,
        category_id: categoryId || null,
        notes: notes.trim() || null,
        account_id: accountId,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Error al guardar"); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">Editar transacción</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nombre / Comercio"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Ej: Supermercado Disco"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <Select
            label="Cuenta"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.filter((a) => a.is_active).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>

          {filteredCats.length > 0 && (
            <Select
              label="Categoría"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </Select>
          )}

          <Input
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas opcionales"
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" onClick={onClose} className="flex-1" type="button">
              Cancelar
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────
function TxRow({
  tx,
  expanded,
  onToggle,
  categories,
  accounts,
  onRefresh,
}: {
  tx: Transaction;
  expanded: boolean;
  onToggle: () => void;
  categories: Category[];
  accounts: Account[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const typeBadgeVariant = (t: string) => {
    if (t === "income") return "success" as const;
    if (t === "expense") return "danger" as const;
    return "info" as const;
  };

  async function toggleArchive() {
    setArchiving(true);
    await fetch(`/api/transactions/${tx.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: tx.is_archived }),
    });
    setArchiving(false);
    onRefresh();
  }

  const isUnnamed = !tx.merchant;

  return (
    <>
      <li className={tx.is_archived ? "opacity-50" : ""}>
        <button
          className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
          onClick={onToggle}
        >
          {/* Icon */}
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: tx.categories?.color ? `${tx.categories.color}20` : "#f1f5f9" }}
          >
            {tx.categories?.icon ?? "💸"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${isUnnamed ? "text-slate-400 italic" : "text-slate-800"}`}>
                {tx.merchant ?? tx.categories?.name ?? "Sin nombre"}
              </span>
              {isUnnamed && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 shrink-0">
                  <AlertTriangle className="h-2.5 w-2.5" /> Sin nombre
                </span>
              )}
              <Badge variant={typeBadgeVariant(tx.type)}>
                {getTransactionTypeLabel(tx.type)}
              </Badge>
              {tx.is_archived && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                  Archivada
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {formatDate(tx.date)}{tx.accounts?.name && ` · ${tx.accounts.name}`}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-sm font-semibold ${transactionTypeColor(tx.type)}`}>
              {transactionAmountPrefix(tx.type)}{formatCurrency(tx.amount, tx.currency)}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Fecha</div>
                <div className="text-sm text-slate-700">{formatDateLong(tx.date)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Cuenta</div>
                <div className="text-sm text-slate-700">{tx.accounts?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Categoría</div>
                <div className="text-sm text-slate-700">
                  {tx.categories ? `${tx.categories.icon ?? ""} ${tx.categories.name}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Moneda</div>
                <div className="text-sm text-slate-700">{tx.currency}</div>
              </div>
              {tx.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <div className="text-xs text-slate-400 mb-0.5">Notas</div>
                  <div className="text-sm text-slate-700">{tx.notes}</div>
                </div>
              )}
              {tx.source && (
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Fuente</div>
                  <div className="text-sm text-slate-700">{tx.source}</div>
                </div>
              )}
              {tx.is_recurring && (
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Recurrente</div>
                  <Badge variant="purple">Sí</Badge>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil className="h-3.5 w-3.5" />}
                onClick={() => setEditing(true)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={archiving}
                icon={tx.is_archived
                  ? <ArchiveRestore className="h-3.5 w-3.5" />
                  : <Archive className="h-3.5 w-3.5" />}
                onClick={toggleArchive}
                className={tx.is_archived ? "" : "!text-amber-600 hover:!bg-amber-50"}
              >
                {tx.is_archived ? "Restaurar" : "Archivar"}
              </Button>
            </div>
          </div>
        )}
      </li>

      {editing && (
        <EditModal
          tx={tx}
          categories={categories}
          accounts={accounts}
          onClose={() => setEditing(false)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [page, setPage] = useState(0);
  const [type, setType] = useState("all");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { transactions, loading, count, refetch } = useTransactions({
    type,
    categoryId: categoryId || undefined,
    accountId: accountId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
    showArchived,
  });

  const loadMeta = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cats }, { data: accs }] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("accounts").select("*").order("name"),
    ]);
    setCategories((cats as Category[]) ?? []);
    setAccounts((accs as Account[]) ?? []);
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  function resetFilters() {
    setType("all");
    setCategoryId("");
    setAccountId("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  }

  function handleRefresh() {
    refetch();
    setExpandedId(null);
  }

  return (
    <>
      <Header title="Transacciones" />
      <main className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Filtros</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Limpiar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Filter className="h-4 w-4" />}
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select
                label="Tipo"
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(0); }}
              >
                <option value="all">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
                <option value="transfer">Transferencias</option>
              </Select>

              <Select
                label="Categoría"
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setPage(0); }}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </Select>

              <Select
                label="Cuenta"
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setPage(0); }}
              >
                <option value="">Todas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Desde</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Hasta</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Results bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {count} transacción{count !== 1 ? "es" : ""}
          </p>
          <div className="flex items-center gap-3">
            {totalPages > 1 && (
              <p className="text-sm text-slate-500">Página {page + 1} de {totalPages}</p>
            )}
            <button
              onClick={() => { setShowArchived(v => !v); setPage(0); }}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                showArchived
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
            </button>
          </div>
        </div>

        {/* List */}
        <Card padding={false}>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No hay transacciones que coincidan con los filtros
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  expanded={expandedId === tx.id}
                  onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                  categories={categories}
                  accounts={accounts}
                  onRefresh={handleRefresh}
                />
              ))}
            </ul>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronLeft className="h-4 w-4" />}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
