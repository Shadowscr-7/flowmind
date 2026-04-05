"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatCurrency, getMonthRange, getCurrentMonthLabel } from "@/lib/utils";
import type { Budget, Category } from "@/lib/types";

interface BudgetWithSpent extends Budget {
  spent: number;
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { start, end } = getMonthRange();

    const [{ data: cats }, { data: budgetRows }] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("budgets")
        .select("*, categories(id, name, icon, color)")
        .order("amount", { ascending: false }),
    ]);

    setCategories((cats as Category[]) ?? []);

    const withSpent: BudgetWithSpent[] = [];
    for (const budget of budgetRows ?? []) {
      const { data: txs } = await supabase
        .from("transactions")
        .select("amount")
        .eq("category_id", budget.category_id)
        .eq("type", "expense")
        .gte("date", start)
        .lte("date", end);

      withSpent.push({
        ...(budget as Budget),
        spent: (txs ?? []).reduce((s, t) => s + t.amount, 0),
      });
    }

    setBudgets(withSpent);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { error } = await supabase.from("budgets").insert({
      user_id: user.id,
      category_id: categoryId,
      amount: parseFloat(amount),
      currency,
      period,
    });

    if (error) {
      setError(error.message);
    } else {
      setShowModal(false);
      setCategoryId("");
      setAmount("");
      await loadData();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <>
        <Header title="Presupuestos" />
        <FullPageSpinner />
      </>
    );
  }

  return (
    <>
      <Header title="Presupuestos" />
      <main className="flex-1 p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <div className="text-sm text-slate-500 mb-1">
              {getCurrentMonthLabel()}
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {formatCurrency(totalBudgeted, "UYU")}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Presupuestado total
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1">Gastado</div>
            <div
              className={`text-2xl font-bold ${
                totalSpent > totalBudgeted ? "text-red-600" : "text-slate-800"
              }`}
            >
              {formatCurrency(totalSpent, "UYU")}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Total este mes
            </div>
          </Card>
          <Card>
            <div className="text-sm text-slate-500 mb-1">Disponible</div>
            <div
              className={`text-2xl font-bold ${
                totalBudgeted - totalSpent < 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {formatCurrency(totalBudgeted - totalSpent, "UYU")}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Restante</div>
          </Card>
        </div>

        {/* Budget list */}
        <Card>
          <CardHeader
            title="Presupuestos por categoría"
            subtitle={getCurrentMonthLabel()}
            action={
              <Button
                icon={<Plus className="h-4 w-4" />}
                size="sm"
                onClick={() => setShowModal(true)}
              >
                Agregar
              </Button>
            }
          />

          {budgets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No hay presupuestos configurados
            </div>
          ) : (
            <div className="space-y-5">
              {budgets.map((budget) => {
                const pct = Math.min((budget.spent / budget.amount) * 100, 100);
                const isOver = budget.spent > budget.amount;
                const remaining = budget.amount - budget.spent;

                return (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">
                          {budget.categories?.icon ?? "📦"}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {budget.categories?.name ?? "Sin categoría"}
                          </div>
                          {isOver && (
                            <div className="flex items-center gap-1 text-xs text-red-600">
                              <AlertCircle className="h-3 w-3" />
                              Excedido por{" "}
                              {formatCurrency(budget.spent - budget.amount, budget.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-700">
                          <span className={isOver ? "text-red-600" : ""}>
                            {formatCurrency(budget.spent, budget.currency)}
                          </span>
                          <span className="text-slate-400 font-normal">
                            {" "}/ {formatCurrency(budget.amount, budget.currency)}
                          </span>
                        </div>
                        {!isOver && (
                          <div className="text-xs text-slate-400">
                            {formatCurrency(remaining, budget.currency)} restante
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{pct.toFixed(0)}% usado</span>
                      <span>
                        {budget.period}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo presupuesto"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          <Select
            label="Categoría"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Seleccionar categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
            <Select
              label="Moneda"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
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
              Crear presupuesto
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
