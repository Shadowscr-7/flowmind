"use client";

import { useState } from "react";
import {
  Building2,
  Banknote,
  PiggyBank,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAccounts } from "@/lib/hooks/useAccounts";
import {
  formatCurrency,
  formatDate,
  getAccountTypeLabel,
  transactionTypeColor,
  transactionAmountPrefix,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";
import type { AccountType } from "@/lib/types";

const accountIcons: Record<AccountType, React.ReactNode> = {
  bank: <Building2 className="h-5 w-5" />,
  cash: <Banknote className="h-5 w-5" />,
  savings: <PiggyBank className="h-5 w-5" />,
  investment: <TrendingUp className="h-5 w-5" />,
};

const accountColors: Record<AccountType, string> = {
  bank: "text-blue-600 bg-blue-50",
  cash: "text-emerald-600 bg-emerald-50",
  savings: "text-violet-600 bg-violet-50",
  investment: "text-amber-600 bg-amber-50",
};

export default function AccountsPage() {
  const { accounts, loading, totalBalance, createAccount, refetch } = useAccounts();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountTxs, setAccountTxs] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await createAccount({
      name,
      type,
      balance: parseFloat(balance) || 0,
      currency,
    });

    if (error) {
      setError(error);
    } else {
      setShowModal(false);
      setName("");
      setBalance("");
    }
    setSaving(false);
  }

  async function toggleAccount(accountId: string) {
    if (selectedAccountId === accountId) {
      setSelectedAccountId(null);
      setAccountTxs([]);
      return;
    }

    setSelectedAccountId(accountId);
    setLoadingTxs(true);

    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select("*, categories(id, name, icon, color)")
      .eq("account_id", accountId)
      .order("date", { ascending: false })
      .limit(10);

    setAccountTxs((data as Transaction[]) ?? []);
    setLoadingTxs(false);
  }

  if (loading) return (
    <>
      <Header title="Cuentas" />
      <FullPageSpinner />
    </>
  );

  return (
    <>
      <Header title="Cuentas" />
      <main className="flex-1 p-6 space-y-6">
        {/* Total balance */}
        <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 border-0 text-white">
          <div className="text-indigo-200 text-sm mb-2">Balance total</div>
          <div className="text-4xl font-bold">
            {formatCurrency(totalBalance, accounts[0]?.currency ?? "UYU")}
          </div>
          <div className="text-indigo-200 text-sm mt-1">
            {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""}
          </div>
        </Card>

        {/* Add button */}
        <div className="flex justify-end">
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowModal(true)}
          >
            Nueva cuenta
          </Button>
        </div>

        {/* Accounts grid */}
        {accounts.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-slate-400">
              No tenés cuentas aún. Creá la primera.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => {
              const isSelected = selectedAccountId === account.id;
              const iconColor = accountColors[account.type] ?? "text-slate-600 bg-slate-50";
              return (
                <div key={account.id} className="space-y-3">
                  <button
                    className={`w-full text-left rounded-2xl border transition-all ${
                      isSelected
                        ? "border-indigo-300 shadow-md shadow-indigo-100"
                        : "border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100"
                    } bg-white p-6`}
                    onClick={() => toggleAccount(account.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconColor}`}
                      >
                        {accountIcons[account.type] ?? accountIcons.bank}
                      </div>
                      <Badge variant="default">
                        {getAccountTypeLabel(account.type)}
                      </Badge>
                    </div>
                    <div className="text-base font-semibold text-slate-800 mb-1">
                      {account.name}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatCurrency(account.balance, account.currency)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {account.currency}
                    </div>
                  </button>

                  {/* Inline transactions */}
                  {isSelected && (
                    <Card padding={false}>
                      <div className="px-4 py-3 border-b border-slate-50">
                        <h4 className="text-sm font-medium text-slate-700">
                          Últimas transacciones
                        </h4>
                      </div>
                      {loadingTxs ? (
                        <div className="flex justify-center py-6">
                          <span className="text-sm text-slate-400">Cargando...</span>
                        </div>
                      ) : accountTxs.length === 0 ? (
                        <div className="text-center py-6 text-sm text-slate-400">
                          Sin transacciones
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-50">
                          {accountTxs.map((tx) => (
                            <li key={tx.id} className="px-4 py-3 flex items-center gap-3">
                              <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 text-xs">
                                {tx.type === "income" ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                                ) : tx.type === "expense" ? (
                                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                                ) : (
                                  <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-700 truncate">
                                  {tx.merchant ?? tx.categories?.name ?? tx.type}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {formatDate(tx.date)}
                                </div>
                              </div>
                              <div
                                className={`text-xs font-semibold shrink-0 ${transactionTypeColor(tx.type)}`}
                              >
                                {transactionAmountPrefix(tx.type)}
                                {formatCurrency(tx.amount, tx.currency)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create account modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva cuenta"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cuenta corriente BROU"
            required
          />

          <Select
            label="Tipo"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            <option value="bank">Banco</option>
            <option value="cash">Efectivo</option>
            <option value="savings">Ahorro</option>
            <option value="investment">Inversión</option>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Saldo inicial"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
            <Select
              label="Moneda"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={saving}>
              Crear cuenta
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
