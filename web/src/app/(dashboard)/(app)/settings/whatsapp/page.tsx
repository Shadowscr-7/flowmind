"use client";

import { useState, useEffect, useCallback } from "react";
import { Smartphone, RefreshCw, CheckCircle, XCircle, Copy, Wifi } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

type ConnectionState = "open" | "connecting" | "close" | "unknown";

interface InstanceInfo {
  connectionStatus: ConnectionState;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
}

export default function WhatsAppAdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionState>("unknown");
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loadingQr, setLoadingQr] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Detect admin
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? ""));
    });
    // Pre-fill webhook URL
    setWebhookUrl(`${window.location.origin}/api/whatsapp/webhook`);
  }, []);

  const fetchStatus = useCallback(async () => {
    const [statusRes, infoRes] = await Promise.all([
      fetch("/api/whatsapp/setup?action=status"),
      fetch("/api/whatsapp/setup?action=info"),
    ]);
    const statusData = await statusRes.json();
    const infoData = await infoRes.json();

    const state: ConnectionState = statusData?.instance?.state ?? statusData?.state ?? "unknown";
    setStatus(state);
    if (infoData && !infoData.error) setInstanceInfo(infoData as InstanceInfo);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchStatus();
      // Poll status every 5s while connecting
      const interval = setInterval(() => {
        fetchStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, fetchStatus]);

  async function loadQr() {
    setLoadingQr(true);
    setQrBase64(null);
    try {
      const res = await fetch("/api/whatsapp/setup?action=qr");
      const data = await res.json();
      const base64 = data?.base64 ?? data?.qrcode?.base64 ?? null;
      setQrBase64(base64);
    } catch {
      setMsg({ type: "error", text: "Error obteniendo QR" });
    } finally {
      setLoadingQr(false);
    }
  }

  async function saveWebhook() {
    setSavingWebhook(true);
    setMsg(null);
    try {
      const res = await fetch("/api/whatsapp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg({ type: "success", text: "Webhook configurado correctamente" });
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setSavingWebhook(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setMsg({ type: "success", text: "URL copiada al portapapeles" });
    setTimeout(() => setMsg(null), 2000);
  }

  if (isAdmin === null) {
    return (
      <>
        <Header title="WhatsApp Admin" />
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Header title="WhatsApp Admin" />
        <main className="flex-1 p-6 max-w-2xl mx-auto">
          <Card>
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <XCircle className="h-10 w-10 text-red-400" />
              <p className="text-slate-600 font-medium">Acceso restringido</p>
              <p className="text-sm text-slate-400">Solo el super admin puede acceder a esta página</p>
            </div>
          </Card>
        </main>
      </>
    );
  }

  const isConnected = status === "open";

  return (
    <>
      <Header title="WhatsApp Admin" />
      <main className="flex-1 p-6 max-w-2xl mx-auto space-y-5">
        {/* Toast */}
        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
            msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {msg.type === "success" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}

        {/* Status card */}
        <Card>
          <CardHeader
            title="Estado de la conexión"
            subtitle={`Instancia: ${process.env.NEXT_PUBLIC_EVO_INSTANCE ?? "flowmind"}`}
            action={
              <button onClick={fetchStatus} className="p-1.5 rounded-lg hover:bg-slate-100">
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
            }
          />
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : status === "connecting" ? "bg-amber-400 animate-pulse" : "bg-slate-300"
            }`} />
            <span className={`text-sm font-medium ${
              isConnected ? "text-emerald-700" : status === "connecting" ? "text-amber-600" : "text-slate-500"
            }`}>
              {isConnected ? "Conectado" : status === "connecting" ? "Conectando..." : "Desconectado"}
            </span>
            {instanceInfo?.profileName && isConnected && (
              <span className="text-sm text-slate-500 ml-2">— {instanceInfo.profileName}</span>
            )}
          </div>

          {isConnected && instanceInfo?.ownerJid && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <Wifi className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="text-xs text-emerald-700 font-medium">Número vinculado</div>
                <div className="text-sm text-emerald-800">+{instanceInfo.ownerJid.replace("@s.whatsapp.net", "")}</div>
              </div>
            </div>
          )}
        </Card>

        {/* QR Code */}
        {!isConnected && (
          <Card>
            <CardHeader
              title="Escanear código QR"
              subtitle="Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo"
            />

            {qrBase64 ? (
              <div className="flex flex-col items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrBase64}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 border-4 border-white rounded-2xl shadow-lg"
                />
                <p className="text-xs text-slate-500 text-center">
                  El QR expira en 60 segundos. Si venció, actualizalo.
                </p>
                <Button variant="secondary" size="sm" onClick={loadQr} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                  Actualizar QR
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Smartphone className="h-10 w-10 text-slate-400" />
                </div>
                <Button onClick={loadQr} loading={loadingQr} icon={<Smartphone className="h-4 w-4" />}>
                  Generar QR para escanear
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Webhook URL */}
        <Card>
          <CardHeader
            title="URL del Webhook"
            subtitle="Configurá esta URL en Evolution para recibir mensajes"
          />
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://tu-app.com/api/whatsapp/webhook"
              />
              <button
                onClick={copyWebhookUrl}
                className="px-3 rounded-xl border border-slate-200 hover:bg-slate-50 shrink-0"
                title="Copiar"
              >
                <Copy className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <Button
              onClick={saveWebhook}
              loading={savingWebhook}
              className="w-full"
              variant="secondary"
            >
              Configurar webhook en Evolution
            </Button>
            <p className="text-xs text-slate-400 text-center">
              ⚠️ La URL debe ser pública (no localhost). En desarrollo usá ngrok.
            </p>
          </div>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader title="¿Cómo funciona?" />
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex gap-3">
              <span className="text-base">1️⃣</span>
              <p>Escaneá el QR con el WhatsApp del número que va a ser el &quot;bot&quot; de FlowMind</p>
            </div>
            <div className="flex gap-3">
              <span className="text-base">2️⃣</span>
              <p>Configurá la URL del webhook (necesita ser pública)</p>
            </div>
            <div className="flex gap-3">
              <span className="text-base">3️⃣</span>
              <p>Cada usuario va a *Configuración* en la app y registra su número de WhatsApp</p>
            </div>
            <div className="flex gap-3">
              <span className="text-base">4️⃣</span>
              <p>Los usuarios le escriben al número vinculado y el bot procesa gastos, ingresos, tickets e imágenes</p>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
