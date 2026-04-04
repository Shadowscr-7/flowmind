"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  PenLine,
  CheckCircle,
  AlertCircle,
  FileText,
  ImageIcon,
  Mic,
  MicOff,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency } from "@/lib/utils";
import type { Category, Account, TransactionDraft } from "@/lib/types";

type Tab = "ai" | "manual";
type InputMode = "text" | "image" | "audio";

// ─── Shared save helper ───────────────────────────────────────────────────────
async function saveTransaction(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: {
    type: "expense" | "income" | "transfer";
    amount: number;
    currency: string;
    merchant: string | null;
    date: string;
    category_id: string | null;
    notes: string | null;
    account_id: string;
    source: string;
  }
) {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    account_id: payload.account_id,
    type: payload.type,
    amount: payload.amount,
    currency: payload.currency || "UYU",
    date: payload.date || new Date().toISOString().split("T")[0],
    merchant: payload.merchant || null,
    category_id: payload.category_id || null,
    notes: payload.notes || null,
    source: payload.source,
    confidence: 1.0,
    is_confirmed: true,
    is_recurring: false,
  });
  if (error) throw new Error(error.message);
}

// ─── Image resize helper ──────────────────────────────────────────────────────
async function resizeImageToBase64(file: File, maxPx = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function AddPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ai");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    async function loadMeta() {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").order("name"),
        supabase.from("accounts").select("*").order("name"),
      ]);
      setCategories((cats as Category[]) ?? []);
      setAccounts((accs as Account[]) ?? []);
      setLoadingMeta(false);
    }
    loadMeta();
  }, []);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function onSuccess() {
    showToast("success", "Transacción guardada exitosamente");
    setTimeout(() => router.push("/transactions"), 1500);
  }

  return (
    <>
      <Header title="Agregar transacción" />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            {toast.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "ai"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setTab("ai")}
          >
            <Sparkles className="h-4 w-4" />
            Con IA
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "manual"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setTab("manual")}
          >
            <PenLine className="h-4 w-4" />
            Manual
          </button>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : tab === "ai" ? (
          <AIForm
            accounts={accounts}
            categories={categories}
            onSuccess={onSuccess}
            onError={(m) => showToast("error", m)}
          />
        ) : (
          <ManualForm
            accounts={accounts}
            categories={categories}
            onSuccess={onSuccess}
            onError={(m) => showToast("error", m)}
          />
        )}
      </main>
    </>
  );
}

// ─── AI Form ──────────────────────────────────────────────────────────────────
function AIForm({
  accounts,
  categories,
  onSuccess,
  onError,
}: {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [inputMode, setInputMode] = useState<InputMode>("text");

  // Text
  const [text, setText] = useState("");

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Draft
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const [editedDraft, setEditedDraft] = useState<TransactionDraft | null>(null);
  const [confirming, setConfirming] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const filteredCategories = categories.filter((c) =>
    txType === "expense" ? c.type === "expense" : c.type === "income"
  );

  // ── Image handlers ───────────────────────────────────────
  function handleImageSelect(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleImageSelect(file);
  }

  // ── Audio handlers ───────────────────────────────────────
  function toggleRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const SR = (window as Window & typeof globalThis).SpeechRecognition ||
      (window as Window & typeof globalThis & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      onError("Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalText + interim);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    setTranscript("");
  }

  // ── Analyze ──────────────────────────────────────────────
  async function handleAnalyze() {
    setLoading(true);
    setDraft(null);

    try {
      let apiInput = "";
      let apiMode: "text" | "image" = "text";

      if (inputMode === "text") {
        if (!text.trim()) { onError("Escribí una descripción primero"); setLoading(false); return; }
        apiInput = text.trim();
      } else if (inputMode === "audio") {
        if (!transcript.trim()) { onError("Grabá un audio primero"); setLoading(false); return; }
        apiInput = transcript.trim();
      } else if (inputMode === "image") {
        if (!imageFile) { onError("Seleccioná una imagen primero"); setLoading(false); return; }
        apiInput = await resizeImageToBase64(imageFile);
        apiMode = "image";
      }

      const catPayload = filteredCategories.map((c) => ({ id: c.id, name: c.name }));

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: apiMode,
          input: apiInput,
          type: txType,
          currency: selectedAccount?.currency ?? "UYU",
          categories: catPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.draft) throw new Error(json.error ?? "Error al analizar");

      const d: TransactionDraft = {
        type: txType,
        amount: json.draft.amount ?? 0,
        currency: json.draft.currency ?? selectedAccount?.currency ?? "UYU",
        merchant: json.draft.merchant ?? null,
        date: json.draft.date ?? new Date().toISOString().split("T")[0],
        category_id: json.draft.category_id ?? null,
        notes: json.draft.notes ?? null,
      };

      setDraft(d);
      setEditedDraft({ ...d });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // ── Confirm ──────────────────────────────────────────────
  async function handleConfirm() {
    if (!editedDraft || !accountId) return;
    setConfirming(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { onError("No autenticado"); setConfirming(false); return; }

    const sourceMap: Record<InputMode, string> = {
      text: "text",
      image: "receipt",
      audio: "voice",
    };

    try {
      await saveTransaction(supabase, user.id, {
        ...editedDraft,
        account_id: accountId,
        source: sourceMap[inputMode],
      });
      onSuccess();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setConfirming(false);
    }
  }

  // ── Input section per mode ────────────────────────────────
  function renderInput() {
    if (inputMode === "text") {
      return (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: Pagué 1200 en el supermercado hoy · Cobré el sueldo de marzo 45000 · Cena en Pizzería Don Juan 890 pesos"
          rows={4}
          hint="Incluí monto, comercio y cualquier detalle que tengas"
        />
      );
    }

    if (inputMode === "audio") {
      return (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              type="button"
              onClick={toggleRecording}
              className={`h-16 w-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                isRecording
                  ? "bg-red-500 animate-pulse scale-110"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isRecording ? (
                <MicOff className="h-7 w-7 text-white" />
              ) : (
                <Mic className="h-7 w-7 text-white" />
              )}
            </button>
            <p className="text-sm text-slate-500">
              {isRecording ? "Grabando... tocá para detener" : "Tocá el micrófono y hablá"}
            </p>
          </div>

          {transcript && (
            <Textarea
              label="Transcripción (podés editar)"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
              hint="Se analizará el texto transcripto"
            />
          )}
        </div>
      );
    }

    // image
    return (
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageSelect(file);
          }}
        />

        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Ticket" className="w-full max-h-64 object-contain bg-slate-50" />
            <button
              type="button"
              onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute top-2 right-2 h-7 w-7 bg-white rounded-full shadow flex items-center justify-center"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors"
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">Subí una foto del ticket</p>
              <p className="text-xs text-slate-500 mt-1">Arrastrá o tocá para seleccionar · JPG, PNG, HEIC</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const canAnalyze =
    (inputMode === "text" && text.trim().length > 0) ||
    (inputMode === "audio" && transcript.trim().length > 0) ||
    (inputMode === "image" && !!imageFile);

  return (
    <div className="space-y-4">
      <Card>
        {/* ── Type toggle ── */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            ¿Es un gasto o un ingreso?
          </label>
          <div className="flex rounded-xl border-2 overflow-hidden">
            <button
              type="button"
              onClick={() => setTxType("expense")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                txType === "expense"
                  ? "bg-red-500 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              💸 Gasto
            </button>
            <button
              type="button"
              onClick={() => setTxType("income")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                txType === "income"
                  ? "bg-emerald-500 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              💰 Ingreso
            </button>
          </div>
        </div>

        {/* ── Account ── */}
        <div className="mb-5">
          <Select
            label="Cuenta"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.currency}
              </option>
            ))}
          </Select>
        </div>

        {/* ── Input mode tabs ── */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            ¿Cómo querés ingresar la información?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "text", icon: <FileText className="h-4 w-4" />, label: "Texto" },
                { id: "image", icon: <ImageIcon className="h-4 w-4" />, label: "Imagen" },
                { id: "audio", icon: <Mic className="h-4 w-4" />, label: "Audio" },
              ] as { id: InputMode; icon: React.ReactNode; label: string }[]
            ).map(({ id, icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setInputMode(id)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-colors border ${
                  inputMode === id
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Mode-specific input ── */}
        {renderInput()}

        {/* ── Analyze button ── */}
        <Button
          className="w-full mt-4"
          onClick={handleAnalyze}
          loading={loading}
          disabled={!canAnalyze || !accountId || accounts.length === 0}
          icon={<Sparkles className="h-4 w-4" />}
        >
          Analizar con IA
        </Button>

        {accounts.length === 0 && (
          <p className="text-xs text-center text-amber-600 mt-2">
            Necesitás crear una cuenta antes de agregar transacciones
          </p>
        )}
      </Card>

      {/* ── Draft review ── */}
      {draft && editedDraft && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-800">
              Revisá y confirmá la transacción
            </h3>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Monto"
                type="number"
                min="0"
                step="0.01"
                value={editedDraft.amount}
                onChange={(e) =>
                  setEditedDraft({ ...editedDraft, amount: parseFloat(e.target.value) || 0 })
                }
              />
              <Select
                label="Moneda"
                value={editedDraft.currency}
                onChange={(e) => setEditedDraft({ ...editedDraft, currency: e.target.value })}
              >
                {["UYU", "USD", "EUR", "ARS", "BRL"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Comercio / concepto"
                value={editedDraft.merchant ?? ""}
                onChange={(e) => setEditedDraft({ ...editedDraft, merchant: e.target.value || null })}
                placeholder="Ej: Supermercado"
              />
              <Input
                label="Fecha"
                type="date"
                value={editedDraft.date}
                onChange={(e) => setEditedDraft({ ...editedDraft, date: e.target.value })}
              />
            </div>

            <Select
              label="Categoría"
              value={editedDraft.category_id ?? ""}
              onChange={(e) =>
                setEditedDraft({ ...editedDraft, category_id: e.target.value || null })
              }
            >
              <option value="">Sin categoría</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>

            <Input
              label="Notas"
              value={editedDraft.notes ?? ""}
              onChange={(e) => setEditedDraft({ ...editedDraft, notes: e.target.value || null })}
              placeholder="Opcional"
            />

            {/* Preview */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Vista previa</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700 font-medium">
                  {editedDraft.merchant || "Sin comercio"}
                </span>
                <span
                  className={`text-base font-bold ${
                    editedDraft.type === "income" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {editedDraft.type === "income" ? "+" : "−"}
                  {formatCurrency(editedDraft.amount, editedDraft.currency)}
                </span>
              </div>
              {editedDraft.notes && (
                <p className="text-xs text-slate-400 mt-1">{editedDraft.notes}</p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                loading={confirming}
                onClick={handleConfirm}
                icon={<CheckCircle className="h-4 w-4" />}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Manual Form ──────────────────────────────────────────────────────────────
function ManualForm({
  accounts,
  categories,
  onSuccess,
  onError,
}: {
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UYU");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !amount) return;
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { onError("No autenticado"); setLoading(false); return; }

    try {
      await saveTransaction(supabase, user.id, {
        type,
        amount: parseFloat(amount),
        currency,
        merchant: merchant || null,
        date,
        category_id: categoryId || null,
        notes: notes || null,
        account_id: accountId,
        source: "manual",
      });
      onSuccess();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  const filteredCategories = categories.filter((c) =>
    type === "transfer" ? true : c.type === type
  );

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Tipo</label>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(["expense", "income", "transfer"] as const).map((t) => {
              const labels = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia" };
              const activeClasses = {
                expense: "bg-red-500 text-white",
                income: "bg-emerald-500 text-white",
                transfer: "bg-blue-500 text-white",
              };
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    type === t ? activeClasses[t] : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

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
          <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {["UYU", "USD", "EUR", "ARS", "BRL"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Comercio / descripción"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Ej: Supermercado, Netflix, Sueldo..."
        />

        <Input
          label="Fecha"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Cuenta"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {accounts.length === 0 && <option value="">Sin cuentas</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>

          <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas opcionales..."
          rows={2}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={loading}
          disabled={accounts.length === 0}
        >
          Guardar transacción
        </Button>

        {accounts.length === 0 && (
          <p className="text-xs text-center text-amber-600">
            Necesitás crear una cuenta antes de agregar transacciones
          </p>
        )}
      </form>
    </Card>
  );
}
