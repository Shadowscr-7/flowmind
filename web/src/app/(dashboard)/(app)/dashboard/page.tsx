"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  formatCurrency,
  formatDate,
  transactionTypeColor,
  transactionAmountPrefix,
  getMonthRange,
  getCurrentMonthLabel,
} from "@/lib/utils";
import type { Transaction, Budget, Account } from "@/lib/types";

interface DashboardData {
  totalBalance: number;
  currency: string;
  monthIncome: number;
  monthExpenses: number;
  recentTransactions: Transaction[];
  topBudgets: Array<Budget & { spent: number }>;
  accounts: Account[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // middleware already guards — just bail silently
      const user = session.user;

      const { start, end } = getMonthRange();

      const { data: profile } = await supabase
        .from("profiles")
        .select("currency_default")
        .eq("id", user.id)
        .single();

      const currency = profile?.currency_default ?? "UYU";

      const { data: accounts } = await supabase.from("accounts").select("*");

      const totalBalance = (accounts ?? []).reduce(
        (s: number, a: Account) => s + a.balance,
        0
      );

      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("type, amount")
        .gte("date", start)
        .lte("date", end);

      const monthIncome = (monthTxs ?? [])
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0);

      const monthExpenses = (monthTxs ?? [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0);

      const { data: recent } = await supabase
        .from("transactions")
        .select("*, accounts(id, name), categories(id, name, icon, color)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: budgets } = await supabase
        .from("budgets")
        .select("*, categories(id, name, icon, color)")
        .limit(3);

      const topBudgets: Array<Budget & { spent: number }> = [];
      for (const budget of budgets ?? []) {
        const { data: txs } = await supabase
          .from("transactions")
          .select("amount")
          .eq("category_id", budget.category_id)
          .eq("type", "expense")
          .gte("date", start)
          .lte("date", end);

        const spent = (txs ?? []).reduce((s, t) => s + t.amount, 0);
        topBudgets.push({ ...budget, spent });
      }

      setData({
        totalBalance,
        currency,
        monthIncome,
        monthExpenses,
        recentTransactions: (recent as Transaction[]) ?? [],
        topBudgets,
        accounts: (accounts as Account[]) ?? [],
      });
      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  const d = data!;

  function TypeIcon({ type }: { type: string }) {
    if (type === "income")
      return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
    if (type === "expense")
      return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="sm:col-span-1 bg-gradient-to-br from-indigo-600 to-violet-700 border-0 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-indigo-200 text-sm font-medium">Balance total</span>
              <Wallet className="h-5 w-5 text-indigo-200" />
            </div>
            <div className="text-3xl font-bold tracking-tight">
              {formatCurrency(d.totalBalance, d.currency)}
            </div>
            <div className="mt-1 text-indigo-200 text-xs">
              {d.accounts.length} cuenta{d.accounts.length !== 1 ? "s" : ""}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm">Ingresos — {getCurrentMonthLabel()}</span>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(d.monthIncome, d.currency)}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 text-sm">Gastos — {getCurrentMonthLabel()}</span>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(d.monthExpenses, d.currency)}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card padding={false}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Últimas transacciones</h3>
              <Link href="/transactions">
                <Button variant="ghost" size="sm">Ver todo</Button>
              </Link>
            </div>
            {d.recentTransactions.length === 0 ? (
              <div className="px-6 pb-6 text-slate-400 text-sm text-center py-8">
                No hay transacciones aún
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {d.recentTransactions.map((tx) => (
                  <li key={tx.id} className="px-6 py-3.5 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <TypeIcon type={tx.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">
                        {tx.merchant ?? tx.categories?.name ?? tx.type}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatDate(tx.date)}{" "}
                        {tx.accounts?.name && `· ${tx.accounts.name}`}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold shrink-0 ${transactionTypeColor(tx.type)}`}>
                      {transactionAmountPrefix(tx.type)}
                      {formatCurrency(tx.amount, tx.currency)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Presupuestos"
              subtitle={getCurrentMonthLabel()}
              action={
                <Link href="/budgets">
                  <Button variant="ghost" size="sm">Ver todo</Button>
                </Link>
              }
            />
            {d.topBudgets.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-8">
                No hay presupuestos configurados
              </div>
            ) : (
              <div className="space-y-4">
                {d.topBudgets.map((budget) => {
                  const pct = Math.min((budget.spent / budget.amount) * 100, 100);
                  const isOver = budget.spent > budget.amount;
                  return (
                    <div key={budget.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{budget.categories?.icon ?? "📦"}</span>
                          <span className="text-sm font-medium text-slate-700">
                            {budget.categories?.name ?? "Sin categoría"}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500">
                          <span className={isOver ? "text-red-600 font-medium" : ""}>
                            {formatCurrency(budget.spent, budget.currency)}
                          </span>{" "}
                          / {formatCurrency(budget.amount, budget.currency)}
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-indigo-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="flex justify-center">
          <Link href="/add">
            <Button size="lg" icon={<PlusCircle className="h-5 w-5" />}>
              Agregar transacción
            </Button>
          </Link>
        </div>
      </main>
    </>
  );
}
