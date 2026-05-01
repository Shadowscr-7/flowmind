"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";

type Step = "auth" | "phone" | "plan";
type Plan = "free" | "monthly" | "annual";
type PaidPlan = Exclude<Plan, "free">;
type SignupSource = "email" | "google";

const COUNTRY_CODES = [
  { code: "+598", label: "Uruguay +598", flag: "UY" },
  { code: "+54", label: "Argentina +54", flag: "AR" },
  { code: "+55", label: "Brasil +55", flag: "BR" },
  { code: "+56", label: "Chile +56", flag: "CL" },
  { code: "+57", label: "Colombia +57", flag: "CO" },
  { code: "+51", label: "Peru +51", flag: "PE" },
  { code: "+595", label: "Paraguay +595", flag: "PY" },
  { code: "+52", label: "Mexico +52", flag: "MX" },
  { code: "+34", label: "Espana +34", flag: "ES" },
];

const MONTHLY_USD = 5;
const ANNUAL_USD = 48;

const PAYPAL_PLAN_IDS: Record<PaidPlan, string> = {
  monthly: process.env.NEXT_PUBLIC_PAYPAL_MONTHLY_PLAN_ID ?? "",
  annual: process.env.NEXT_PUBLIC_PAYPAL_ANNUAL_PLAN_ID ?? "",
};

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  monthly: "Pro Mensual",
  annual: "Pro Anual",
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("auth");
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("+598");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan>("annual");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signupNotificationSentRef = useRef(false);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    const requestedStep = params.get("step");
    const requestedPlan = plan === "free" || plan === "monthly" || plan === "annual" ? plan : "annual";
    const isRegistrationReturn = requestedStep === "phone" || params.has("code");
    if (plan === "free" || plan === "monthly" || plan === "annual") setSelectedPlan(plan);

    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      setDisplayName(data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "");
      setEmail(data.user.email ?? "");
      if (isRegistrationReturn) void notifyNewSignup(data.user.id, requestedPlan, "google");
      setStep(requestedStep === "phone" ? "phone" : "plan");
    });
  }, []);

  useEffect(() => {
    if (step !== "plan" || selectedPlan === "free") {
      paypalButtonsRef.current?.close();
      if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
      setPaypalLoading(false);
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const planId = PAYPAL_PLAN_IDS[selectedPlan];
    if (!clientId || !planId) {
      setError("PayPal no esta configurado para este plan. Contacta al soporte.");
      return;
    }

    setPaypalLoading(true);
    const scriptId = "paypal-sdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderButtons = () => {
      if (!window.paypal || !paypalContainerRef.current) return;
      paypalButtonsRef.current?.close();
      const buttons = window.paypal.Buttons({
        style: { shape: "rect", color: "blue", layout: "vertical", label: "subscribe" },
        createSubscription: (_data: unknown, actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }) => {
          return actions.subscription.create({ plan_id: planId });
        },
        onApprove: async (data: { subscriptionID: string }) => {
          await activatePro(data.subscriptionID);
        },
        onError: () => setError("Ocurrio un error con PayPal. Intenta de nuevo."),
        onCancel: () => setError(null),
      });

      paypalContainerRef.current.innerHTML = "";
      buttons.render(paypalContainerRef.current);
      paypalButtonsRef.current = buttons;
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
        setError("No se pudo cargar PayPal. Revisa tu conexion.");
        setPaypalLoading(false);
      });
      document.head.appendChild(script);
    }

    return () => paypalButtonsRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedPlan, userId]);

  async function handleGoogleRegister() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/register?step=phone&plan=${selectedPlan}`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error || !data.user) {
      setError(error?.message ?? "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }

    setUserId(data.user.id);
    void notifyNewSignup(data.user.id, selectedPlan, "email");
    setStep("phone");
    setLoading(false);
  }

  function normalizedPhone() {
    const digits = phone.trim().replace(/\D/g, "");
    return digits ? `${countryCode}${digits}` : null;
  }

  async function savePhoneAndContinue(skip = false) {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const number = skip ? null : normalizedPhone();

    if (number) {
      await createClient().from("profiles").update({ whatsapp_phone: number }).eq("id", userId);
      void fetch("/api/whatsapp/send-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number, name: displayName }),
      });
    }

    setLoading(false);
    setStep("plan");
  }

  async function notifyNewSignup(id: string, plan: Plan, source: SignupSource) {
    if (signupNotificationSentRef.current) return;

    const storageKey = `flowmind-signup-notified:${id}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(storageKey)) return;

    signupNotificationSentRef.current = true;
    try {
      const res = await fetch("/api/notifications/new-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone(),
          plan: PLAN_LABELS[plan],
          source,
        }),
      });
      if (res.ok && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, "1");
      }
    } catch (err) {
      signupNotificationSentRef.current = false;
      console.warn("Signup notification failed", err);
    }
  }

  async function activateFree() {
    if (!userId) return;
    setLoading(true);
    await createClient().from("profiles").update({ plan: "free" }).eq("id", userId);
    trackSignup("free");
    router.push("/dashboard");
    router.refresh();
  }

  async function activatePro(subscriptionId: string) {
    if (!userId || selectedPlan === "free") return;
    setLoading(true);
    setError(null);
    await createClient().from("profiles").update({ plan: "pro" }).eq("id", userId);
    await fetch("/api/paypal/activate-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscriptionId, planType: selectedPlan }),
    });
    trackSignup(selectedPlan);
    router.push("/dashboard");
    router.refresh();
  }

  function trackSignup(plan: Plan) {
    const value = plan === "annual" ? ANNUAL_USD : plan === "monthly" ? MONTHLY_USD : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fbq = (window as any).fbq;
    if (typeof fbq !== "function") return;
    fbq("track", "CompleteRegistration", { content_name: PLAN_LABELS[plan], value, currency: "USD" });
    if (plan !== "free") {
      fbq("track", "Subscribe", { value, currency: "USD", predicted_ltv: value });
      fbq("track", "Purchase", { value, currency: "USD", content_name: PLAN_LABELS[plan], content_type: "product" });
    }
  }

  if (step === "phone") {
    return (
      <Card className="border-white/10 shadow-2xl shadow-emerald-950/30">
        <h2 className="mb-1 text-2xl font-bold text-slate-800">Conecta WhatsApp</h2>
        <p className="mb-6 text-sm text-slate-500">
          Es opcional, pero te permite registrar gastos por mensaje, audio o foto.
        </p>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="space-y-4">
          <PhoneInput countryCode={countryCode} setCountryCode={setCountryCode} phone={phone} setPhone={setPhone} />
          <Button
            type="button"
            className="w-full bg-emerald-400 font-bold text-slate-950 hover:bg-emerald-300 disabled:bg-emerald-200"
            size="lg"
            loading={loading}
            onClick={() => savePhoneAndContinue(false)}
          >
            Continuar
          </Button>
          <button
            type="button"
            onClick={() => savePhoneAndContinue(true)}
            className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            Saltar por ahora
          </button>
        </div>
      </Card>
    );
  }

  if (step === "plan") {
    return (
      <Card className="border-white/10 shadow-2xl shadow-emerald-950/30">
        <h2 className="mb-1 text-2xl font-bold text-slate-800">Elegi tu plan</h2>
        <p className="mb-5 text-sm text-slate-500">Free para probar. Pro para desbloquear la IA que ayuda a decidir.</p>
        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="mb-5 space-y-3">
          <PlanButton selected={selectedPlan === "free"} onClick={() => setSelectedPlan("free")} icon={<Zap className="h-4 w-4 text-slate-500" />} title="Free" badge="Sin tarjeta" description="2 audios/mes, 3 fotos/mes, sin analisis IA" price="USD 0" subprice="para probar" />
          <PlanButton selected={selectedPlan === "annual"} onClick={() => setSelectedPlan("annual")} icon={<Crown className="h-4 w-4 text-emerald-700" />} title="Pro Anual" badge="20% OFF" description={`USD ${ANNUAL_USD}/anio - USD ${(ANNUAL_USD / 12).toFixed(2)}/mes`} price={`USD ${ANNUAL_USD}`} subprice={`antes USD ${MONTHLY_USD * 12}`} highlighted />
          <PlanButton selected={selectedPlan === "monthly"} onClick={() => setSelectedPlan("monthly")} icon={<Sparkles className="h-4 w-4 text-slate-500" />} title="Pro Mensual" description="IA, audios y tickets sin friccion" price={`USD ${MONTHLY_USD}`} subprice="por mes" />
        </div>

        {selectedPlan === "free" ? (
          <Button type="button" className="w-full bg-emerald-400 font-bold text-slate-950 hover:bg-emerald-300 disabled:bg-emerald-200" size="lg" loading={loading} onClick={activateFree}>
            Crear cuenta gratis
          </Button>
        ) : (
          <>
            {loading || paypalLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loading ? "Activando tu plan..." : "Cargando PayPal..."}
              </div>
            ) : null}
            <div ref={paypalContainerRef} className={loading ? "hidden" : ""} />
            <p className="mt-3 text-center text-xs text-slate-400">Pago seguro con PayPal. Podes cancelar en cualquier momento.</p>
          </>
        )}
      </Card>
    );
  }

  return (
    <Card className="border-white/10 shadow-2xl shadow-emerald-950/30">
      <h2 className="mb-1 text-2xl font-bold text-slate-800">Crear cuenta</h2>
      <p className="mb-6 text-sm text-slate-500">Entra con Google y completa lo minimo.</p>

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button
        variant="secondary"
        className="w-full border-slate-200 bg-white font-bold hover:bg-slate-50"
        size="lg"
        loading={googleLoading}
        onClick={handleGoogleRegister}
        icon={<GoogleIcon />}
      >
        Continuar con Google
      </Button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center text-xs uppercase text-slate-400"><span className="bg-white px-3">o con email</span></div>
      </div>

      <form onSubmit={handleEmailRegister} className="space-y-4">
        <Input label="Nombre" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" required autoComplete="email" />
        <Input label="Contrasena" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" required autoComplete="new-password" hint="La contrasena debe tener al menos 6 caracteres" />
        <Button type="submit" className="w-full bg-emerald-400 font-bold text-slate-950 hover:bg-emerald-300 disabled:bg-emerald-200" size="lg" loading={loading}>
          Crear con email
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Ya tenes cuenta? <Link href="/login" className="font-medium text-emerald-700 hover:text-emerald-800">Ingresar</Link>
      </p>
    </Card>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{children}</div>;
}

function PhoneInput({
  countryCode,
  setCountryCode,
  phone,
  setPhone,
}: {
  countryCode: string;
  setCountryCode: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">Telefono WhatsApp</label>
      <div className="flex gap-0">
        <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="shrink-0 rounded-l-xl rounded-r-none border border-r-0 border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400">
          {COUNTRY_CODES.map(({ code, label, flag }) => <option key={code} value={code}>{flag} {label}</option>)}
        </select>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="97479212" className="min-w-0 flex-1 rounded-l-none rounded-r-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </div>
      <p className="text-xs text-slate-500">Sin codigo de pais. Se guardara como {countryCode}{phone || "XXXXXXXX"}.</p>
    </div>
  );
}

function PlanButton({
  selected,
  onClick,
  icon,
  title,
  description,
  price,
  subprice,
  badge,
  highlighted = false,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  price: string;
  subprice: string;
  badge?: string;
  highlighted?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl border-2 p-4 text-left transition-all ${selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
            {selected && <Check className="h-3 w-3 text-white" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {icon}
              <span className="font-semibold text-slate-800">{title}</span>
              {badge && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${highlighted ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{badge}</span>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold text-slate-800">{price}</p>
          <p className={`text-xs ${highlighted ? "text-slate-400 line-through" : "text-slate-400"}`}>{subprice}</p>
        </div>
      </div>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
