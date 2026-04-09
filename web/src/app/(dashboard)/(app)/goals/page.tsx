"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Target, Calendar, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState<Goal | null>(null);
  const [fundAmount, setFundAmount] = useState("");
  const [savingFund, setSavingFund] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("goals")
      .select("*")
      .order("deadline", { ascending: true });
    setGoals((data as Goal[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      name,
      target_amount: parseFloat(targetAmount),
      deadline: targetDate || null,
      current_amount: 0,
      currency,
    });

    if (error) {
      setError(error.message);
    } else {
      setShowModal(false);
      setName("");
      setTargetAmount("");
      setTargetDate("");
      await loadGoals();
    }
    setSaving(false);
  }

  async function handleAddFunds(e: React.FormEvent) {
    e.preventDefault();
    if (!showFundModal) return;
    setSavingFund(true);

    const supabase = createClient();
    const newAmount = showFundModal.current_amount + parseFloat(fundAmount || "0");

    const { error } = await supabase
      .from("goals")
      .update({ current_amount: newAmount })
      .eq("id", showFundModal.id);

    if (!error) {
      setShowFundModal(null);
      setFundAmount("");
      await loadGoals();
    }
    setSavingFund(false);
  }

  if (loading) {
    return (
      <>
        <Header title="Metas" />
        <FullPageSpinner />
      </>
    );
  }

  return (
    <>
      <Header title="Metas de ahorro" />
      <main className="flex-1 p-6 space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {goals.length} meta{goals.length !== 1 ? "s" : ""} activa
            {goals.length !== 1 ? "s" : ""}
          </p>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowModal(true)}
          >
            Nueva meta
          </Button>
        </div>

        {/* Goals grid */}
        {goals.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Target className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                No tenés metas de ahorro aún
              </p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => setShowModal(true)}
              >
                Crear primera meta
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const pct = Math.min(
                (goal.current_amount / goal.target_amount) * 100,
                100
              );
              const isComplete = goal.current_amount >= goal.target_amount;
              const daysLeft = goal.deadline
                ? Math.ceil(
                    (new Date(goal.deadline).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;

              return (
                <Card key={goal.id}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">
                        {goal.name}
                      </h3>
                      {goal.deadline && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(goal.deadline)}
                          {daysLeft !== null && daysLeft >= 0 && (
                            <span className="text-slate-400">
                              · {daysLeft}d restantes
                            </span>
                          )}
                          {daysLeft !== null && daysLeft < 0 && (
                            <span className="text-red-500">· Vencida</span>
                          )}
                        </div>
                      )}
                    </div>
                    {isComplete && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                        ¡Completada!
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <div className="text-2xl font-bold text-slate-900">
                          {formatCurrency(goal.current_amount, goal.currency)}
                        </div>
                        <div className="text-xs text-slate-400">
                          de {formatCurrency(goal.target_amount, goal.currency)}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-indigo-600">
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isComplete ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1.5">
                      Faltan{" "}
                      {formatCurrency(
                        Math.max(goal.target_amount - goal.current_amount, 0),
                        goal.currency
                      )}
                    </div>
                  </div>

                  {!isComplete && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      icon={<PlusCircle className="h-4 w-4" />}
                      onClick={() => {
                        setShowFundModal(goal);
                        setFundAmount("");
                      }}
                    >
                      Agregar fondos
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create goal modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva meta de ahorro"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            label="Nombre de la meta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Viaje a Europa, Fondo de emergencia..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monto objetivo"
              type="number"
              step="0.01"
              min="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
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
          <Input
            label="Fecha límite (opcional)"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
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
              Crear meta
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add funds modal */}
      <Modal
        open={!!showFundModal}
        onClose={() => setShowFundModal(null)}
        title={`Agregar fondos — ${showFundModal?.name}`}
        size="sm"
      >
        <form onSubmit={handleAddFunds} className="space-y-4">
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-700">
            Balance actual:{" "}
            <span className="font-semibold">
              {formatCurrency(
                showFundModal?.current_amount ?? 0,
                showFundModal?.currency ?? "UYU"
              )}
            </span>
          </div>
          <Input
            label="Monto a agregar"
            type="number"
            step="0.01"
            min="0"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            placeholder="0.00"
            required
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowFundModal(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={savingFund}>
              Agregar
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
