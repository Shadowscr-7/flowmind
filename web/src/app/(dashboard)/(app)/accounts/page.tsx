"use client";

import { useState } from "react";
import {
  Building2, Banknote, PiggyBank, TrendingUp,
  Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Pencil, PowerOff, Power,
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
  formatCurrency, formatDate, getAccountTypeLabel,
  transactionTypeColor, transactionAmountPrefix,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, AccountType, Account } from "@/lib/types";

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
  const { accounts, loading, totalBalance, createAccount, updateAccount, toggleAccountActive, refetch } =
    useAccounts({ includeInactive: true });

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("bank");
  const [newBalance, setNewBalance] = useState("");
  const [newCurrency, setNewCurrency] = useState("UYU");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Transactions drawer
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountTxs, setAccountTxs] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

  const activeAccounts = accounts.filter(a => a.is_active);
  const inactiveAccounts = accounts.filter(a => !a.is_active);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError(null);
    const { error } = await createAccount({ name: newName, type: newType, balance: parseFloat(newBalance) || 0, currency: newCurrency });
    if (error) { setCreateError(error); } else { setShowCreate(false); setNewName(""); setNewBalance(""); }
    setSaving(false);
  }

  function openEdit(acc: Account) {
    setEditAccount(acc);
    setEditName(acc.name);
    setEditCurrency(acc.currency);
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAccount) return;
    setEditSaving(true);
    setEditError(null);
    const { error } = await updateAccount(editAccount.id, { name: editName, currency: editCurrency });
    if (error) { setEditError(error); } else { setEditAccount(null); }
    setEditSaving(false);
  }

  async function handleToggle(acc: Account) {
    await toggleAccountActive(acc.id, !acc.is_active);
    if (selectedAccountId === acc.id) setSelectedAccountId(null);
  }

  async function handleSelectAccount(accountId: string) {
    if (selectedAccountId === accountId) { setSelectedAccountId(null); setAccountTxs([]); return; }
    setSelectedAccountId(accountId);
    setLoadingTxs(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions").select("*, categories(id, name, icon, color)")
      .eq("account_id", accountId).order("date", { ascending: false }).limit(10);
    setAccountTxs((data as Transaction[]) ?? []);
    setLoadingTxs(false);
  }

  if (loading) return (<><Header title="Cuentas" /><FullPageSpinner /></>);

  return (
    <>
      <Header title="Cuentas" />
      <main className="flex-1 p-6 space-y-6">

        {/* Total balance */}
        <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 border-0 text-white">
          <div className="text-indigo-200 text-sm mb-2">Balance total (cuentas activas)</div>
          <div className="text-4xl font-bold">
            {formatCurrency(totalBalance, activeAccounts[0]?.currency ?? "UYU")}
          </div>
          <div className="text-indigo-200 text-sm mt-1">
            {activeAccounts.length} cuenta{activeAccounts.length !== 1 ? "s" : ""} activa{activeAccounts.length !== 1 ? "s" : ""}
          </div>
        </Card>

        {/* Add button */}
        <div className="flex justify-end">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Nueva cuenta
          </Button>
        </div>

        {/* Active accounts */}
        {activeAccounts.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-slate-400">No tenés cuentas activas. Creá la primera.</div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isSelected={selectedAccountId === account.id}
                txs={accountTxs}
                loadingTxs={loadingTxs}
                onSelect={() => handleSelectAccount(account.id)}
                onEdit={() => openEdit(account)}
                onToggle={() => handleToggle(account)}
              />
            ))}
          </div>
        )}

        {/* Inactive accounts */}
        {inactiveAccounts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <PowerOff className="h-4 w-4" /> Cuentas desactivadas ({inactiveAccounts.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactiveAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  isSelected={false}
                  txs={[]}
                  loadingTxs={false}
                  onSelect={() => {}}
                  onEdit={() => openEdit(account)}
                  onToggle={() => handleToggle(account)}
                  inactive
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva cuenta">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{createError}</div>}
          <Input label="Nombre" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Cuenta BROU" required />
          <Select label="Tipo" value={newType} onChange={e => setNewType(e.target.value as AccountType)}>
            <option value="bank">Banco</option>
            <option value="cash">Efectivo</option>
            <option value="savings">Ahorro</option>
            <option value="investment">Inversión</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Saldo inicial" type="number" step="0.01" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="0.00" />
            <Select label="Moneda" value={newCurrency} onChange={e => setNewCurrency(e.target.value)}>
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="ARS">ARS</option>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={saving}>Crear cuenta</Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editAccount} onClose={() => setEditAccount(null)} title="Editar cuenta">
        <form onSubmit={handleEdit} className="space-y-4">
          {editError && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{editError}</div>}
          <Input label="Nombre" value={editName} onChange={e => setEditName(e.target.value)} required />
          <Select label="Moneda" value={editCurrency} onChange={e => setEditCurrency(e.target.value)}>
            <option value="UYU">UYU</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="ARS">ARS</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditAccount(null)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={editSaving}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({
  account, isSelected, txs, loadingTxs, onSelect, onEdit, onToggle, inactive = false,
}: {
  account: Account;
  isSelected: boolean;
  txs: Transaction[];
  loadingTxs: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: () => void;
  inactive?: boolean;
}) {
  const iconColor = accountColors[account.type] ?? "text-slate-600 bg-slate-50";

  return (
    <div className={`space-y-3 ${inactive ? "opacity-50" : ""}`}>
      <div className={`rounded-2xl border bg-white transition-all ${
        isSelected ? "border-indigo-300 shadow-md shadow-indigo-100" : "border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100"
      }`}>
        {/* Card body */}
        <button className="w-full text-left p-6" onClick={inactive ? undefined : onSelect}>
          <div className="flex items-start justify-between mb-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconColor}`}>
              {accountIcons[account.type] ?? accountIcons.bank}
            </div>
            <Badge variant="default">{getAccountTypeLabel(account.type)}</Badge>
          </div>
          <div className="text-base font-semibold text-slate-800 mb-1">{account.name}</div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(account.balance, account.currency)}</div>
          <div className="text-xs text-slate-400 mt-1">{account.currency}</div>
        </button>

        {/* Actions */}
        <div className="px-4 pb-3 flex gap-2 border-t border-slate-50 pt-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-lg ${
              inactive
                ? "text-emerald-600 hover:bg-emerald-50"
                : "text-slate-500 hover:text-red-500 hover:bg-red-50"
            }`}
          >
            {inactive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
            {inactive ? "Activar" : "Desactivar"}
          </button>
        </div>
      </div>

      {/* Inline transactions */}
      {isSelected && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-slate-50">
            <h4 className="text-sm font-medium text-slate-700">Últimas transacciones</h4>
          </div>
          {loadingTxs ? (
            <div className="flex justify-center py-6"><span className="text-sm text-slate-400">Cargando...</span></div>
          ) : txs.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">Sin transacciones</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {txs.map((tx) => (
                <li key={tx.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 text-xs">
                    {tx.type === "income" ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> :
                     tx.type === "expense" ? <ArrowDownRight className="h-3.5 w-3.5 text-red-500" /> :
                     <ArrowLeftRight className="h-3.5 w-3.5 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700 truncate">
                      {tx.merchant ?? tx.categories?.name ?? tx.type}
                    </div>
                    <div className="text-[10px] text-slate-400">{formatDate(tx.date)}</div>
                  </div>
                  <div className={`text-xs font-semibold shrink-0 ${transactionTypeColor(tx.type)}`}>
                    {transactionAmountPrefix(tx.type)}{formatCurrency(tx.amount, tx.currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
