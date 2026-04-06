"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Ticket, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const SUBJECTS = [
  "No puedo registrar una transacción",
  "El bot de WhatsApp no responde",
  "Error en mi saldo o cuentas",
  "Problema con mi suscripción",
  "Sugerencia de mejora",
  "Otro",
];

export default function SupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const finalSubject = subject === "Otro" ? customSubject.trim() : subject;
    if (!finalSubject || !message.trim()) {
      setError("Completá el asunto y el mensaje.");
      return;
    }
    setSending(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("display_name, whatsapp_phone").eq("id", user.id).single()
        : { data: null };

      const { error: dbErr } = await supabase.from("support_tickets").insert({
        user_id: user?.id ?? null,
        phone: profile?.whatsapp_phone ?? null,
        display_name: profile?.display_name ?? null,
        subject: finalSubject,
        message: message.trim(),
        priority,
        source: "web",
        status: "open",
      });

      if (dbErr) throw dbErr;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <>
        <Header title="Soporte" />
        <main className="flex-1 p-6">
          <Card>
            <div className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-base font-semibold text-slate-800 mb-2">¡Ticket enviado!</h2>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Recibimos tu consulta. Te responderemos a la brevedad. Si tenés WhatsApp vinculado, te avisaremos cuando esté resuelto.
              </p>
              <button
                onClick={() => { setSent(false); setMessage(""); setCustomSubject(""); }}
                className="mt-6 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Enviar otro ticket
              </button>
            </div>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Soporte" />
      <main className="flex-1 p-6 space-y-4 max-w-xl">
        <Card>
          <CardHeader
            title="¿Necesitás ayuda?"
            subtitle="Contanos tu problema y te respondemos a la brevedad"
          />

          <div className="space-y-4 mt-2">
            {/* Subject */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Asunto</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
              {subject === "Otro" && (
                <input
                  type="text"
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="Describí el asunto brevemente..."
                  className="mt-2 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Urgencia</label>
              <div className="flex gap-2">
                {([
                  { key: "normal", label: "Normal" },
                  { key: "high",   label: "Alta" },
                  { key: "urgent", label: "Urgente" },
                ] as const).map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPriority(p.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      priority === p.key
                        ? p.key === "urgent" ? "border-red-300 bg-red-50 text-red-700"
                          : p.key === "high" ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Descripción</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Contanos qué pasó con el mayor detalle posible..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

            <Button onClick={handleSubmit} loading={sending} icon={<Ticket className="h-4 w-4" />} className="w-full">
              Enviar ticket
            </Button>
          </div>
        </Card>

        {/* WhatsApp alternative */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50">
          <MessageSquare className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-700">También por WhatsApp</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Si tenés WhatsApp vinculado, podés escribir <span className="font-medium">"quiero hacer un reclamo"</span> y te ayudamos directo desde el chat.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
