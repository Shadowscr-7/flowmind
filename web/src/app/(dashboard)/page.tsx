"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  MessageSquare,
  Smartphone,
  Globe,
  Check,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  Target,
  Bell,
  Shield,
  Mic,
  Camera,
  RefreshCw,
  Zap,
} from "lucide-react";

function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const imgSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-14 w-14" : "h-9 w-9";
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-3xl" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <img src="/images/logo.png" alt="FlowMind" className={`${imgSize} object-contain drop-shadow-lg`} />
      <span
        className={`font-extrabold ${textSize} tracking-tight`}
        style={{
          background: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 40%, #67e8f9 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        FlowMind
      </span>
    </div>
  );
}

// ─── Scroll animation hook ────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Reusable animated section wrappers ──────────────────────────────────────
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`section-hidden ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
function SlideLeft({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`section-hidden-left ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
function SlideRight({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`section-hidden-right ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Mini dashboard mockup ────────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900 w-full max-w-sm">
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-800 border-b border-white/5">
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <div className="ml-3 flex-1 rounded-md bg-slate-700 h-5 flex items-center px-2">
          <span className="text-[10px] text-slate-400">flowmind.aivanguardlabs.com</span>
        </div>
      </div>
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Balance card */}
        <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 p-3">
          <p className="text-indigo-200 text-[10px] font-medium mb-1">Balance total</p>
          <p className="text-white text-xl font-bold">$ 142,850</p>
          <div className="flex gap-3 mt-2">
            <div>
              <p className="text-indigo-200 text-[9px]">Ingresos</p>
              <p className="text-emerald-300 text-xs font-semibold">+$85,000</p>
            </div>
            <div>
              <p className="text-indigo-200 text-[9px]">Gastos</p>
              <p className="text-red-300 text-xs font-semibold">-$42,150</p>
            </div>
          </div>
        </div>
        {/* Mini bar chart */}
        <div className="rounded-xl bg-slate-800 p-3">
          <p className="text-slate-400 text-[10px] mb-2">Gastos del mes</p>
          <div className="flex items-end gap-1 h-12">
            {[40, 65, 45, 80, 55, 70, 50, 90, 60, 75, 85, 95].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-indigo-500/60" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        {/* Transactions */}
        <div className="space-y-1.5">
          {[
            { icon: "🛒", label: "Supermercado", amt: "-$1,850", color: "text-red-400" },
            { icon: "💰", label: "Sueldo", amt: "+$45,000", color: "text-emerald-400" },
            { icon: "🚗", label: "Nafta", amt: "-$2,300", color: "text-red-400" },
          ].map((tx) => (
            <div key={tx.label} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">{tx.icon}</span>
                <span className="text-slate-300 text-[11px]">{tx.label}</span>
              </div>
              <span className={`text-[11px] font-semibold ${tx.color}`}>{tx.amt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp mockup ──────────────────────────────────────────────────────────
function WhatsAppMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#111b21] w-full max-w-xs">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
          <img src="/images/logo.png" alt="FlowMind" className="w-6 h-6 object-contain" />
        </div>
        <div>
          <p className="text-white text-sm font-medium">FlowMind AI</p>
          <p className="text-emerald-400 text-[10px]">en línea</p>
        </div>
      </div>
      {/* Messages */}
      <div className="p-4 space-y-3 min-h-[200px]">
        {/* User message */}
        <div className="flex justify-end animate-chat">
          <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            <p className="text-white text-xs">Gasté $1850 en el super 🛒</p>
            <p className="text-emerald-300/50 text-[9px] text-right mt-0.5">10:24 ✓✓</p>
          </div>
        </div>
        {/* Bot response */}
        <div className="flex justify-start animate-chat animation-delay-300">
          <div className="bg-[#202c33] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
            <p className="text-white text-xs">✅ <span className="font-semibold">Gasto registrado</span></p>
            <p className="text-slate-300 text-xs mt-1">🏪 Supermercado · $1,850</p>
            <p className="text-slate-400 text-[10px] mt-1">📊 Llevás $42,150 gastados este mes</p>
            <p className="text-slate-400 text-[9px] text-right mt-1">10:24 ✓✓</p>
          </div>
        </div>
        {/* Voice note */}
        <div className="flex justify-end animate-chat animation-delay-700">
          <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%] flex items-center gap-2">
            <Mic className="w-3 h-3 text-emerald-300 shrink-0" />
            <div className="flex gap-0.5 items-center">
              {[3,5,8,4,7,5,3,6,4,8,3,5].map((h, i) => (
                <div key={i} className="w-0.5 bg-emerald-300/70 rounded-full" style={{ height: `${h * 2}px` }} />
              ))}
            </div>
            <span className="text-emerald-300/60 text-[9px]">0:04</span>
          </div>
        </div>
        {/* Bot response 2 */}
        <div className="flex justify-start animate-chat animation-delay-1000">
          <div className="bg-[#202c33] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
            <p className="text-slate-400 text-[9px] italic mb-1">🎤 "Cobré el sueldo 85000"</p>
            <p className="text-white text-xs">💰 <span className="font-semibold">Ingreso registrado</span> · $85,000</p>
            <p className="text-slate-400 text-[9px] text-right mt-1">10:31 ✓✓</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Phone mockup ─────────────────────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-36">
      {/* Phone frame */}
      <div className="rounded-[28px] bg-slate-900 border-2 border-slate-700 overflow-hidden shadow-2xl">
        {/* Notch */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-16 h-4 rounded-full bg-slate-800" />
        </div>
        {/* Screen content */}
        <div className="px-2 pb-3 space-y-2">
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 p-2">
            <p className="text-indigo-200 text-[8px]">Balance</p>
            <p className="text-white text-sm font-bold">$142,850</p>
          </div>
          <div className="space-y-1">
            {[
              { e: "🛒", l: "Super", a: "-$1,850", c: "text-red-400" },
              { e: "💰", l: "Sueldo", a: "+$85,000", c: "text-emerald-400" },
              { e: "🚗", l: "Nafta", a: "-$2,300", c: "text-red-400" },
            ].map((tx) => (
              <div key={tx.l} className="flex items-center justify-between rounded-lg bg-slate-800 px-2 py-1">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">{tx.e}</span>
                  <span className="text-slate-300 text-[8px]">{tx.l}</span>
                </div>
                <span className={`text-[8px] font-semibold ${tx.c}`}>{tx.a}</span>
              </div>
            ))}
          </div>
          {/* Bottom nav */}
          <div className="flex justify-around pt-1 border-t border-slate-700">
            <div className="flex flex-col items-center gap-0.5">
              <BarChart3 className="w-3 h-3 text-indigo-400" />
              <span className="text-[7px] text-indigo-400">Inicio</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="text-[7px] text-slate-500">Movs</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Target className="w-3 h-3 text-slate-500" />
              <span className="text-[7px] text-slate-500">Metas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main landing page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  return (
    <div className="bg-slate-950 text-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-dark border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo size="sm" />
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="text-sm font-medium px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
              >
                Ir al Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
                  Ingresar
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
                >
                  Empezar ahora
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-1/4 -left-20 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/30 rounded-full blur-3xl animate-blob animation-delay-4000" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: headline + CTAs */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping-slow" />
                Web · App Móvil · WhatsApp — Todo sincronizado
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
                Tu dinero,
                <br />
                bajo control.
                <br />
                <span className="gradient-text">En cualquier lugar.</span>
              </h1>

              <p className="text-lg text-slate-400 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                FlowMind es tu asistente financiero con IA. Registrá gastos desde{" "}
                <span className="text-slate-200">WhatsApp</span>, gestioná todo desde la{" "}
                <span className="text-slate-200">web</span> o la{" "}
                <span className="text-slate-200">app</span>, y mirá tus finanzas en tiempo real — siempre sincronizado.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:scale-95"
                >
                  Empezar ahora
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl glass hover:bg-white/10 text-slate-300 font-medium text-base transition-all"
                >
                  Ver cómo funciona
                </a>
              </div>

              {/* Trust line */}
              <div className="mt-8 flex flex-wrap items-center gap-4 justify-center lg:justify-start text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  Datos cifrados con SSL
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Cancelá cuando quieras
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                  Sincronización en tiempo real
                </div>
              </div>
            </div>

            {/* Right: floating mockups */}
            <div className="relative flex items-center justify-center h-[520px] lg:h-[600px]">
              {/* Dashboard (background, tilted) */}
              <div className="absolute top-0 right-0 lg:-right-8 w-72 lg:w-80 animate-float-reverse opacity-90" style={{ transform: "rotate(3deg)" }}>
                <DashboardMockup />
              </div>
              {/* WhatsApp (foreground left) */}
              <div className="absolute bottom-0 left-0 lg:-left-4 w-56 lg:w-64 animate-float z-10">
                <WhatsAppMockup />
              </div>
              {/* Phone (center, overlapping) */}
              <div className="absolute bottom-16 right-8 lg:right-4 z-20 animate-float animation-delay-500">
                <PhoneMockup />
              </div>
              {/* Connecting glow */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-600 text-xs animate-bounce">
          <div className="w-6 h-10 rounded-full border border-slate-700 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-slate-600 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── Platforms section ──────────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Tres formas de usar FlowMind</p>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Dónde estés,<br /><span className="gradient-text">como prefieras.</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Empezá por donde te resulte más fácil. Todo queda guardado y sincronizado al instante.
            </p>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Globe className="h-7 w-7 text-indigo-400" />,
                color: "from-indigo-600/20 to-indigo-600/5",
                border: "border-indigo-500/20",
                title: "Web App",
                subtitle: "Control total desde tu navegador",
                features: [
                  "Dashboard con análisis visual",
                  "Gestión de presupuestos y metas",
                  "Insights de IA sobre tus hábitos",
                  "Historial completo de movimientos",
                  "Configuración de alertas inteligentes",
                ],
                delay: 0,
              },
              {
                icon: <Smartphone className="h-7 w-7 text-violet-400" />,
                color: "from-violet-600/20 to-violet-600/5",
                border: "border-violet-500/20",
                title: "App Móvil",
                subtitle: "Tu finanzas en el bolsillo",
                features: [
                  "Registrá gastos en segundos",
                  "Notificaciones en tiempo real",
                  "Acceso offline parcial",
                  "Escaneo de tickets con cámara",
                  "Widget de balance rápido",
                ],
                delay: 150,
              },
              {
                icon: <MessageSquare className="h-7 w-7 text-emerald-400" />,
                color: "from-emerald-600/20 to-emerald-600/5",
                border: "border-emerald-500/20",
                title: "WhatsApp",
                subtitle: "Sin abrir ninguna app",
                features: [
                  "Texto: \"Gasté $500 en el super\"",
                  "Nota de voz — transcripción IA",
                  "Foto de ticket — OCR automático",
                  "Consultá tu balance al instante",
                  "Análisis financiero por chat",
                ],
                delay: 300,
              },
            ].map((card) => (
              <FadeUp key={card.title} delay={card.delay}>
                <div className={`rounded-2xl bg-gradient-to-b ${card.color} border ${card.border} p-6 h-full hover:scale-[1.02] transition-transform duration-300`}>
                  <div className="mb-4">{card.icon}</div>
                  <h3 className="text-xl font-bold mb-1">{card.title}</h3>
                  <p className="text-slate-400 text-sm mb-5">{card.subtitle}</p>
                  <ul className="space-y-2.5">
                    {card.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sync section ───────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            <SlideLeft>
              <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Sincronización real</p>
              <h2 className="text-4xl lg:text-5xl font-bold mb-5">
                Todo conectado,<br /><span className="gradient-text">en tiempo real.</span>
              </h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                Registrá un gasto por WhatsApp mientras hacés las compras. Al segundo ya lo ves en la web y en la app. Sin esperas, sin inconsistencias, sin trabajo manual.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <MessageSquare className="h-5 w-5 text-emerald-400" />, text: "Mandás un mensaje por WhatsApp" },
                  { icon: <Zap className="h-5 w-5 text-yellow-400" />, text: "La IA lo clasifica y registra automáticamente" },
                  { icon: <RefreshCw className="h-5 w-5 text-indigo-400" />, text: "En segundos aparece en web y app" },
                  { icon: <Bell className="h-5 w-5 text-violet-400" />, text: "Recibís alertas si superás un presupuesto" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 glass rounded-xl p-4">
                    <div className="shrink-0">{item.icon}</div>
                    <p className="text-slate-300 text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            </SlideLeft>

            <SlideRight>
              {/* Visual sync diagram */}
              <div className="relative flex items-center justify-center h-80">
                {/* Center node */}
                <div className="absolute z-10 w-20 h-20 rounded-full bg-slate-900 border border-indigo-500/40 flex items-center justify-center shadow-2xl animate-pulse-glow overflow-hidden">
                  <img src="/images/logo.png" alt="FlowMind" className="w-14 h-14 object-contain" />
                </div>

                {/* Orbit ring */}
                <div className="absolute w-64 h-64 rounded-full border border-indigo-500/20 animate-spin-slow" />
                <div className="absolute w-52 h-52 rounded-full border border-indigo-500/10" />

                {/* Platform nodes */}
                {[
                  { icon: <Globe className="h-5 w-5 text-indigo-300" />, label: "Web", top: "4%", left: "50%", transform: "-50%" },
                  { icon: <Smartphone className="h-5 w-5 text-violet-300" />, label: "App", top: "72%", left: "10%", transform: "0%" },
                  { icon: <MessageSquare className="h-5 w-5 text-emerald-300" />, label: "WhatsApp", top: "72%", left: "90%", transform: "-100%" },
                ].map((node) => (
                  <div
                    key={node.label}
                    className="absolute flex flex-col items-center gap-1.5"
                    style={{ top: node.top, left: node.left, transform: `translateX(${node.transform})` }}
                  >
                    <div className="w-12 h-12 rounded-xl glass border border-white/10 flex items-center justify-center shadow-lg">
                      {node.icon}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{node.label}</span>
                  </div>
                ))}

                {/* Connection lines (SVG) */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 320">
                  <line x1="160" y1="160" x2="160" y2="25" stroke="rgba(99,102,241,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="160" y1="160" x2="50" y2="255" stroke="rgba(99,102,241,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="160" y1="160" x2="270" y2="255" stroke="rgba(99,102,241,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                </svg>

                {/* Animated dots along lines */}
                <div className="absolute w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50"
                  style={{ top: "20%", left: "50%", transform: "translateX(-50%)", animation: "float 1.5s ease-in-out infinite" }} />
                <div className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
                  style={{ top: "60%", left: "70%", animation: "float 1.8s ease-in-out infinite 0.5s" }} />
                <div className="absolute w-2.5 h-2.5 rounded-full bg-violet-400 shadow-lg shadow-violet-400/50"
                  style={{ top: "60%", left: "30%", animation: "float 2s ease-in-out infinite 1s" }} />
              </div>
            </SlideRight>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Simple y poderoso</p>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Empezás en <span className="gradient-text">3 pasos.</span>
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: <Zap className="h-8 w-8 text-indigo-400" />,
                title: "Creá tu cuenta",
                desc: "Registrate en minutos. Elegí tu plan y enlazá tu número de WhatsApp para empezar a registrar al instante.",
                delay: 0,
              },
              {
                step: "02",
                icon: <MessageSquare className="h-8 w-8 text-emerald-400" />,
                title: "Registrá desde donde estés",
                desc: "Un texto, una foto de ticket o una nota de voz a WhatsApp. La IA entiende, clasifica y guarda todo solo.",
                delay: 200,
              },
              {
                step: "03",
                icon: <TrendingUp className="h-8 w-8 text-violet-400" />,
                title: "Tomá el control",
                desc: "Mirá tus finanzas en el dashboard, configurá presupuestos, analizá categorías y alcanzá tus metas.",
                delay: 400,
              },
            ].map((s) => (
              <FadeUp key={s.step} delay={s.delay}>
                <div className="text-center">
                  <div className="relative inline-flex mb-6">
                    <div className="w-16 h-16 rounded-2xl glass border border-white/10 flex items-center justify-center">
                      {s.icon}
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold">
                      {s.step}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <FadeUp className="text-center mb-16">
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Todo lo que necesitás</p>
            <h2 className="text-4xl lg:text-5xl font-bold">
              Una plataforma completa.<br /><span className="gradient-text">Nada de extras.</span>
            </h2>
          </FadeUp>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: <Wallet className="h-5 w-5" />, title: "Múltiples cuentas", desc: "Efectivo, banco, billetera virtual. Todo en un solo lugar.", color: "text-indigo-400", delay: 0 },
              { icon: <BarChart3 className="h-5 w-5" />, title: "Presupuestos inteligentes", desc: "Establecé límites por categoría y recibí alertas antes de pasarte.", color: "text-violet-400", delay: 100 },
              { icon: <Target className="h-5 w-5" />, title: "Metas de ahorro", desc: "Definí tus objetivos y seguí tu progreso automáticamente.", color: "text-emerald-400", delay: 200 },
              { icon: <Mic className="h-5 w-5" />, title: "Notas de voz con IA", desc: "Hablá y FlowMind entiende, transcribe y registra el gasto.", color: "text-yellow-400", delay: 300 },
              { icon: <Camera className="h-5 w-5" />, title: "Escaneo de tickets", desc: "Sacá una foto y la IA extrae comercio, monto, fecha y categoría.", color: "text-red-400", delay: 400 },
              { icon: <Bell className="h-5 w-5" />, title: "Alertas automáticas", desc: "Balance bajo, presupuesto cerca del límite, gastos inusuales.", color: "text-orange-400", delay: 500 },
              { icon: <TrendingUp className="h-5 w-5" />, title: "Análisis de IA", desc: "Insights mensuales sobre tus hábitos y sugerencias de mejora.", color: "text-blue-400", delay: 600 },
              { icon: <TrendingDown className="h-5 w-5" />, title: "Detección de anomalías", desc: "FlowMind detecta gastos inusuales y te avisa antes de que sea tarde.", color: "text-pink-400", delay: 700 },
              { icon: <Shield className="h-5 w-5" />, title: "Seguridad total", desc: "Tus datos cifrados, RLS en base de datos, acceso solo tuyo.", color: "text-emerald-400", delay: 800 },
            ].map((feat) => (
              <FadeUp key={feat.title} delay={feat.delay}>
                <div className="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all duration-300 h-full">
                  <div className={`mb-3 ${feat.color}`}>{feat.icon}</div>
                  <h3 className="font-semibold mb-1.5">{feat.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="precios" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <FadeUp className="text-center mb-14">
            <p className="text-indigo-400 text-sm font-medium uppercase tracking-widest mb-3">Precios transparentes</p>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Un solo precio.<br /><span className="gradient-text">Acceso total.</span>
            </h2>
            <p className="text-slate-400 text-lg">Sin niveles, sin límites ocultos. Todo incluido desde el primer día.</p>
          </FadeUp>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Monthly */}
            <FadeUp delay={0}>
              <div className="glass rounded-2xl border border-white/10 p-7 h-full">
                <h3 className="font-bold text-xl mb-1">Mensual</h3>
                <p className="text-slate-400 text-sm mb-5">Flexibilidad total</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold">$5</span>
                  <span className="text-slate-400 text-sm ml-1">/mes</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {["Acceso completo web + app + WhatsApp", "IA financiera sin límites", "Presupuestos y metas ilimitados", "Soporte prioritario", "Cancelá cuando quieras"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block text-center px-6 py-3.5 rounded-xl glass border border-white/10 hover:bg-white/10 font-medium transition-all">
                  Empezar con Mensual
                </Link>
              </div>
            </FadeUp>

            {/* Annual — highlighted */}
            <FadeUp delay={150}>
              <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 h-full">
                <div className="rounded-2xl bg-slate-900 p-7 h-full">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-bold text-xl">Anual</h3>
                    <span className="text-xs font-bold bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-2.5 py-1 rounded-full">
                      20% OFF
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-5">El mejor valor</p>
                  <div className="mb-1">
                    <span className="text-5xl font-bold gradient-text">$4</span>
                    <span className="text-slate-400 text-sm ml-1">/mes</span>
                  </div>
                  <p className="text-slate-500 text-xs mb-6">facturado como $48/año <span className="line-through text-slate-600">$60</span></p>
                  <ul className="space-y-3 mb-8">
                    {["Todo lo del plan mensual", "Ahorrás $12 al año", "Acceso garantizado 12 meses", "Prioridad en nuevas features", "Soporte VIP"].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className="block text-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-semibold transition-all hover:shadow-xl hover:shadow-indigo-500/30"
                  >
                    Empezar con Anual
                  </Link>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        </div>
        <FadeUp className="relative z-10 text-center max-w-3xl mx-auto px-6">
          <div className="flex justify-center mb-6">
            <img src="/images/logo.png" alt="FlowMind" className="h-20 w-20 object-contain drop-shadow-2xl animate-pulse-glow" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-5">
            Empezá hoy mismo.<br />
            <span className="gradient-text">Tu yo futuro te lo va a agradecer.</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Sumate a quienes ya tienen el control de sus finanzas personales con IA.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:scale-95"
              >
                Ir al Dashboard
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:scale-95"
                >
                  Crear mi cuenta
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl glass border border-white/10 hover:bg-white/10 text-slate-300 font-medium text-lg transition-all"
                >
                  Ya tengo cuenta
                </Link>
              </>
            )}
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <img src="/images/logo.png" alt="FlowMind" className="h-6 w-6 object-contain opacity-80" />
            <span className="text-slate-400 font-medium">FlowMind</span>
            <span>© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-400 transition-colors">Ingresar</Link>
            <Link href="/register" className="hover:text-slate-400 transition-colors">Registrarse</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
