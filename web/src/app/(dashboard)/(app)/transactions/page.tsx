"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  formatCurrency,
  formatDate,
  formatDateLong,
  transactionTypeColor,
  transactionAmountPrefix,
  getAccountTypeLabel,
  getTransactionTypeLabel,
} from "@/lib/utils";
import { useTransactions } from "@/lib/hooks/useTransactions";
import type { Category, Account } from "@/lib/types";

const PAGE_SIZE = 20;

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

  const { transactions, loading, count } = useTransactions({
    type,
    categoryId: categoryId || undefined,
    accountId: accountId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    const supabase = createClient();
    async function loadMeta() {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("accounts").select("*").order("name"),
      ]);
      setCategories((cats as Category[]) ?? []);
      setAccounts((accs as Account[]) ?? []);
    }
    loadMeta();
  }, []);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  function resetFilters() {
    setType("all");
    setCategoryId("");
    setAccountId("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  }

  const typeBadgeVariant = (t: string) => {
    if (t === "income") return "success";
    if (t === "expense") return "danger";
    return "info";
  };

  return (
    <>
      <Header title="Transacciones" />
      <main className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Filtros</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
              >
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
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
                <option value="transfer">Transferencias</option>
              </Select>

              <Select
                label="Categoría"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Cuenta"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Desde
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(0);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Hasta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(0);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {count} transacción{count !== 1 ? "es" : ""}
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-slate-500">
              Página {page + 1} de {totalPages}
            </p>
          )}
        </div>

        {/* List */}
        <Card padding={false}>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No hay transacciones que coincidan con los filtros
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <li key={tx.id}>
                  <button
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={() =>
                      setExpandedId(expandedId === tx.id ? null : tx.id)
                    }
                  >
                    {/* Category icon */}
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{
                        background: tx.categories?.color
                          ? `${tx.categories.color}20`
                          : "#f1f5f9",
                      }}
                    >
                      {tx.categories?.icon ?? "💸"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {tx.merchant ?? tx.categories?.name ?? "Sin nombre"}
                        </span>
                        <Badge variant={typeBadgeVariant(tx.type)}>
                          {getTransactionTypeLabel(tx.type)}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatDate(tx.date)}{" "}
                        {tx.accounts?.name && `· ${tx.accounts.name}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-sm font-semibold ${transactionTypeColor(tx.type)}`}
                      >
                        {transactionAmountPrefix(tx.type)}
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                      {expandedId === tx.id ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expandedId === tx.id && (
                    <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">
                            Fecha
                          </div>
                          <div className="text-sm text-slate-700">
                            {formatDateLong(tx.date)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">
                            Cuenta
                          </div>
                          <div className="text-sm text-slate-700">
                            {tx.accounts?.name ?? "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">
                            Categoría
                          </div>
                          <div className="text-sm text-slate-700">
                            {tx.categories
                              ? `${tx.categories.icon ?? ""} ${tx.categories.name}`
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">
                            Moneda
                          </div>
                          <div className="text-sm text-slate-700">
                            {tx.currency}
                          </div>
                        </div>
                        {tx.notes && (
                          <div className="col-span-2 sm:col-span-4">
                            <div className="text-xs text-slate-400 mb-0.5">
                              Notas
                            </div>
                            <div className="text-sm text-slate-700">
                              {tx.notes}
                            </div>
                          </div>
                        )}
                        {tx.source && (
                          <div>
                            <div className="text-xs text-slate-400 mb-0.5">
                              Fuente
                            </div>
                            <div className="text-sm text-slate-700">
                              {tx.source}
                            </div>
                          </div>
                        )}
                        {tx.is_recurring && (
                          <div>
                            <div className="text-xs text-slate-400 mb-0.5">
                              Recurrente
                            </div>
                            <Badge variant="purple">Sí</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
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
