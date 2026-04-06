"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Check, Zap, Crown, Loader2 } from "lucide-react";

type Step = "form" | "plan";
type Plan = "monthly" | "annual";

const COUNTRY_CODES = [
  { code: "+598", label: "Uruguay +598", flag: "🇺🇾" },
  { code: "+54",  label: "Argentina +54", flag: "🇦🇷" },
  { code: "+55",  label: "Brasil +55", flag: "🇧🇷" },
  { code: "+56",  label: "Chile +56", flag: "🇨🇱" },
  { code: "+57",  label: "Colombia +57", flag: "🇨🇴" },
  { code: "+51",  label: "Perú +51", flag: "🇵🇪" },
  { code: "+58",  label: "Venezuela +58", flag: "🇻🇪" },
  { code: "+593", label: "Ecuador +593", flag: "🇪🇨" },
  { code: "+595", label: "Paraguay +595", flag: "🇵🇾" },
  { code: "+591", label: "Bolivia +591", flag: "🇧🇴" },
  { code: "+52",  label: "México +52", flag: "🇲🇽" },
  { code: "+502", label: "Guatemala +502", flag: "🇬🇹" },
  { code: "+503", label: "El Salvador +503", flag: "🇸🇻" },
  { code: "+504", label: "Honduras +504", flag: "🇭🇳" },
  { code: "+505", label: "Nicaragua +505", flag: "🇳🇮" },
  { code: "+506", label: "Costa Rica +506", flag: "🇨🇷" },
  { code: "+507", label: "Panamá +507", flag: "🇵🇦" },
  { code: "+1787", label: "Puerto Rico +1787", flag: "🇵🇷" },
  { code: "+1809", label: "R. Dominicana +1809", flag: "🇩🇴" },
  { code: "+34",  label: "España +34", flag: "🇪🇸" },
];

const MONTHLY_USD = 5;
const ANNUAL_USD = 48; // $4/mes, 20% off

// PayPal plan IDs — configurar en /dashboard.paypal.com → Products & Plans
const PAYPAL_PLAN_IDS: Record<Plan, string> = {
  monthly: process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID ?? "",
  annual: process.env.NEXT_PUBLIC_PAYPAL_ANNUAL_PLAN_ID ?? "",
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

export default function RegisterPage() {
  const router = useRouter();

  // Form data
  const [step, setStep] = useState<Step>("form");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("+598");
  const [phone, setPhone] = useState("");

  // Plan
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");

  // UI state
  const [loading, setLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successNeedsEmail, setSuccessNeedsEmail] = useState(false);

  // PayPal button container ref
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRef = useRef<{ close: () => void } | null>(null);

  // Load & render PayPal button when on plan step
  useEffect(() => {
    if (step !== "plan") return;

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setError("PayPal no está configurado. Contactá al soporte.");
      return;
    }

    setPaypalLoading(true);

    const scriptId = "paypal-sdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderButtons = () => {
      if (!window.paypal || !paypalContainerRef.current) return;

      // Close previous instance if any
      paypalButtonsRef.current?.close();

      const planId = PAYPAL_PLAN_IDS[selectedPlan];

      const buttons = window.paypal.Buttons({
        style: {
          shape: "rect",
          color: "blue",
          layout: "vertical",
          label: "subscribe",
        },
        createSubscription: (_data: unknown, actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }) => {
          return actions.subscription.create({ plan_id: planId });
        },
        onApprove: async (data: { subscriptionID: string }) => {
          await handlePaypalApprove(data.subscriptionID);
        },
        onError: (err: unknown) => {
          console.error("PayPal error:", err);
          setError("Ocurrió un error con PayPal. Intentá de nuevo.");
        },
        onCancel: () => {
          setError(null);
        },
      });

      if (paypalContainerRef.current) {
        paypalContainerRef.current.innerHTML = "";
        buttons.render(paypalContainerRef.current);
        paypalButtonsRef.current = buttons;
      }

      setPaypalLoading(false);
    };

    if (script) {
      if (window.paypal) renderButtons();
      else script.addEventListener("load", renderButtons);
    } else {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
      script.addEventListener("load", renderButtons);
      script.addEventListener("error", () => {
        setError("No se pudo cargar PayPal. Revisá tu conexión.");
        setPaypalLoading(false);
      });
      document.head.appendChild(script);
    }

    return () => {
      paypalButtonsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedPlan]);

  async function handlePaypalApprove(subscriptionId: string) {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // 1. Create Supabase user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError("Error creando la cuenta. Contactá al soporte.");
      setLoading(false);
      return;
    }

    // 2. Update profile: phone + plan
    const profileUpdate: Record<string, string> = { plan: "pro" };
    let normalizedPhone: string | null = null;
    if (phone.trim()) {
      const digits = phone.trim().replace(/^\+/, "");
      normalizedPhone = `${countryCode}${digits}`;
      profileUpdate.whatsapp_phone = normalizedPhone;
    }
    await supabase.from("profiles").update(profileUpdate).eq("id", userId);

    // Send WhatsApp welcome message (fire-and-forget)
    if (normalizedPhone) {
      void fetch("/api/whatsapp/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, name: displayName }),
      });
    }

    // 3. Record PayPal subscription server-side (verify + store in DB)
    await fetch("/api/paypal/activate-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subscriptionId,
        planType: selectedPlan,
      }),
    });

    // 4. Fire Meta Pixel events (Subscribe + Purchase)
    const planValue = selectedPlan === "annual" ? 48 : 5;
    const planName = selectedPlan === "annual" ? "FlowMind Pro Anual" : "FlowMind Pro Mensual";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      fbq("track", "Subscribe", {
        value: planValue,
        currency: "USD",
        predicted_ltv: planValue,
      });
      fbq("track", "Purchase", {
        value: planValue,
        currency: "USD",
        content_name: planName,
        content_type: "product",
      });
    }

    // 5. Redirect or show email confirmation screen
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setSuccessNeedsEmail(true);
      setSuccess(true);
      setLoading(false);
    }
  }

  function handleFormNext(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setError(null);
    setStep("plan");
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <Card>
        <div className="text-center py-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            ¡Suscripción activa!
          </h2>
          {successNeedsEmail ? (
            <p className="text-slate-500 text-sm mb-6">
              Tu plan <span className="font-medium text-indigo-600">{selectedPlan === "monthly" ? "Mensual" : "Anual"}</span> está activo.
              Revisá tu email para confirmar tu cuenta antes de ingresar.
            </p>
          ) : (
            <p className="text-slate-500 text-sm mb-6">
              Tu plan <span className="font-medium text-indigo-600">{selectedPlan === "monthly" ? "Mensual" : "Anual"}</span> está activo.
              Redirigiendo...
            </p>
          )}
          <Link href="/login">
            <Button className="w-full">Ir al inicio de sesión</Button>
          </Link>
        </div>
      </Card>
    );
  }

  // ── Step 2: Plan selection + PayPal button ─────────────────────────────────
  if (step === "plan") {
    return (
      <Card>
        <button
          onClick={() => { setStep("form"); setError(null); }}
          className="text-sm text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1"
        >
          ← Volver
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-1">Elegí tu plan</h2>
        <p className="text-slate-500 text-sm mb-5">
          Acceso completo a FlowMind. Cancelá cuando quieras desde PayPal.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="space-y-3 mb-5">
          {/* Annual */}
          <button
            type="button"
            onClick={() => setSelectedPlan("annual")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selectedPlan === "annual"
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedPlan === "annual" ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`}>
                  {selectedPlan === "annual" && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-indigo-600" />
                    <span className="font-semibold text-slate-800">Anual</span>
                    <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      20% OFF
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    USD {ANNUAL_USD}/año · USD {(ANNUAL_USD / 12).toFixed(2)}/mes
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">USD {ANNUAL_USD}</p>
                <p className="text-xs text-slate-400 line-through">USD {MONTHLY_USD * 12}</p>
              </div>
            </div>
          </button>

          {/* Monthly */}
          <button
            type="button"
            onClick={() => setSelectedPlan("monthly")}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selectedPlan === "monthly"
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedPlan === "monthly" ? "border-indigo-500 bg-indigo-500" : "border-slate-300"}`}>
                  {selectedPlan === "monthly" && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-800">Mensual</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    USD {MONTHLY_USD}/mes · sin compromiso
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">USD {MONTHLY_USD}</p>
                <p className="text-xs text-slate-400">por mes</p>
              </div>
            </div>
          </button>
        </div>

        {/* Features */}
        <div className="mb-5 p-4 rounded-xl bg-slate-50 space-y-2">
          {[
            "Gastos por WhatsApp (texto, voz y foto de ticket)",
            "IA financiera personal ilimitada",
            "Presupuestos y metas de ahorro",
            "Análisis y reportes mensuales",
            "Soporte prioritario",
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-2 text-sm text-slate-600">
              <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              {feat}
            </div>
          ))}
        </div>

        {/* PayPal button container */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creando tu cuenta...
          </div>
        ) : paypalLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando PayPal...
          </div>
        ) : null}

        <div ref={paypalContainerRef} className={loading ? "hidden" : ""} />

        <p className="mt-3 text-center text-xs text-slate-400">
          Pago seguro con PayPal. Podés cancelar en cualquier momento.
        </p>
      </Card>
    );
  }

  // ── Step 1: Registration form ──────────────────────────────────────────────
  return (
    <Card>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">Crear cuenta</h2>
      <p className="text-slate-500 text-sm mb-6">
        Empezá a controlar tus finanzas hoy
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleFormNext} className="space-y-4">
        <Input
          label="Nombre"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Tu nombre"
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          required
          autoComplete="new-password"
          hint="La contraseña debe tener al menos 6 caracteres"
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            Teléfono WhatsApp (opcional)
          </label>
          <div className="flex gap-0">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="rounded-l-xl rounded-r-none border border-r-0 border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-slate-300 shrink-0"
            >
              {COUNTRY_CODES.map(({ code, label, flag }) => (
                <option key={code} value={code}>
                  {flag} {label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="97479212"
              className="flex-1 min-w-0 rounded-r-xl rounded-l-none border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-slate-300"
            />
          </div>
          <p className="text-xs text-slate-500">Sin el código de país. El número se guardará como {countryCode}{phone || "XXXXXXXX"}.</p>
        </div>
        <Button type="submit" className="w-full" size="lg">
          Continuar →
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
          Ingresar
        </Link>
      </p>
    </Card>
  );
}
