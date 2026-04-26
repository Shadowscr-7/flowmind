"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  Crown,
  LineChart,
  MessageSquare,
  Mic,
  Shield,
  Sparkles,
  Target,
  Wallet,
  X,
  Zap,
} from "lucide-react";

const freeFeatures = [
  "Registro manual de ingresos y gastos",
  "Cuentas, presupuestos y metas basicas",
  "2 audios por WhatsApp al mes",
  "3 fotos de tickets al mes",
  "Sin analisis financiero con IA",
];

const proFeatures = [
  "WhatsApp con texto, voz y fotos sin friccion",
  "Analisis de IA sobre gastos, habitos y riesgos",
  "Insights automaticos y reportes accionables",
  "Presupuestos, metas y alertas inteligentes",
  "Web, app movil y WhatsApp sincronizados",
  "Soporte prioritario",
];

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/images/logo.png" alt="FlowMind" className="h-8 w-8 object-contain" />
      <span className="text-lg font-black tracking-tight text-white">FlowMind</span>
    </div>
  );
}

function AppPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[32px] bg-emerald-400/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#101418] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-slate-500">flowmind.app</span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 text-slate-950">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Este mes</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-black">$ 42.150</p>
                  <p className="mt-1 text-sm text-slate-500">gastos detectados</p>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">+18%</span>
              </div>
              <div className="mt-5 flex h-24 items-end gap-2">
                {[38, 72, 46, 84, 58, 90, 66, 52, 78, 95].map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t-md bg-slate-950"
                    style={{ height: `${height}%`, opacity: 0.35 + index * 0.05 }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-100">Alerta util, no decorativa</p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-100/70">
                    Comida ya va en 82% del presupuesto. Si seguis igual, cerras el mes $ 6.400 arriba.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-[#16251f] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-950">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">WhatsApp</p>
                  <p className="text-xs text-slate-400">registrado hace 8 segundos</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-sm bg-emerald-600 px-3 py-2 text-white">
                  Gaste 1850 en el super
                </div>
                <div className="w-fit max-w-[90%] rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-slate-100">
                  Listo. Supermercado - $ 1.850. Te quedan $ 4.320 para comida.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Mic, label: "Voz", value: "2 s" },
                { icon: Camera, label: "Ticket", value: "1 foto" },
                { icon: Sparkles, label: "IA", value: "Insight" },
                { icon: Bell, label: "Alerta", value: "Hoy" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <item.icon className="h-5 w-5 text-emerald-300" />
                  <p className="mt-3 text-xs text-slate-500">{item.label}</p>
                  <p className="font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({ label, free, pro }: { label: string; free: string; pro: string }) {
  return (
    <div className="grid grid-cols-[1.25fr_0.8fr_0.8fr] items-center gap-3 border-t border-slate-200 py-4 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <span className="text-slate-500">{free}</span>
      <span className="font-semibold text-slate-950">{pro}</span>
    </div>
  );
}

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  const primaryHref = isLoggedIn ? "/dashboard" : "/register";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b0f12] text-white">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b0f12]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <BrandLogo />
          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#dolor" className="hover:text-white">Problema</a>
            <a href="#funciona" className="hover:text-white">Como funciona</a>
            <a href="#planes" className="hover:text-white">Planes</a>
          </div>
          <div className="flex items-center gap-3">
            {!isLoggedIn && (
              <Link href="/login" className="hidden text-sm font-medium text-slate-300 hover:text-white sm:block">
                Ingresar
              </Link>
            )}
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              {isLoggedIn ? "Ir al dashboard" : "Probar gratis"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative border-b border-white/10 pt-28">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 lg:grid-cols-[0.95fr_1.05fr] lg:pb-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Finanzas por WhatsApp, web y app
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Deja de perder plata por no mirar tus gastos.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              FlowMind convierte cada gasto, audio o foto de ticket en informacion clara: cuanto se fue, en que se fue y que hacer antes de que el mes se desordene.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-7 py-4 text-base font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Crear cuenta gratis
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#planes"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-4 text-base font-bold text-white transition hover:bg-white/10"
              >
                Ver Pro
                <ChevronRight className="h-5 w-5" />
              </a>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {[
                ["2 min", "para empezar"],
                ["24/7", "por WhatsApp"],
                ["USD 5", "Pro mensual"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <AppPreview />
        </div>
      </section>

      <section id="dolor" className="bg-white py-20 text-slate-950">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-rose-600">El problema real</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              No necesitas otra planilla. Necesitas enterarte antes.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock3,
                title: "Registrar a mano cansa",
                text: "La mayoria abandona porque anotar cada gasto parece una tarea mas.",
              },
              {
                icon: AlertTriangle,
                title: "El problema aparece tarde",
                text: "Cuando revisas el resumen del banco, el presupuesto ya se rompio.",
              },
              {
                icon: LineChart,
                title: "Los numeros no explican nada",
                text: "Ver graficas ayuda, pero la venta esta en saber que decision tomar hoy.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 p-6">
                <item.icon className="h-6 w-6 text-rose-600" />
                <h3 className="mt-5 text-xl font-black">{item.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="funciona" className="border-y border-white/10 bg-[#101418] py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">Como se siente</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Mandas un mensaje. FlowMind hace el resto.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                El valor no es guardar gastos. Es que la app te devuelva contexto: limites, tendencias, alertas y proximas decisiones.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: MessageSquare, title: "Texto natural", text: "\"Gaste 850 en farmacia\" queda clasificado y guardado." },
                { icon: Mic, title: "Audios", text: "Hablas rapido y FlowMind lo transforma en un movimiento." },
                { icon: Camera, title: "Tickets", text: "Foto del comprobante, monto y comercio extraidos automaticamente." },
                { icon: Sparkles, title: "Analisis Pro", text: "La IA detecta habitos, excesos y oportunidades de ahorro." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <item.icon className="h-6 w-6 text-emerald-300" />
                  <h3 className="mt-5 text-xl font-black">{item.title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f5f2eb] py-20 text-slate-950">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-700">Resultado</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                La suscripcion se vende cuando el usuario entiende lo que pierde sin Pro.
              </h2>
            </div>
            <div className="rounded-2xl bg-slate-950 p-6 text-white">
              {[
                ["Sin FlowMind", "Gastos sueltos, tickets perdidos, decisiones tarde."],
                ["Con Free", "Orden basico y una muestra limitada de voz/fotos."],
                ["Con Pro", "Automatizacion, IA, alertas e insights para actuar."],
              ].map(([title, text]) => (
                <div key={title} className="border-b border-white/10 py-5 last:border-b-0">
                  <p className="font-black text-emerald-300">{title}</p>
                  <p className="mt-2 leading-7 text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="planes" className="bg-white py-20 text-slate-950">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">Planes</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Gratis para probar. Pro para tomar control.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              El plan Free muestra el valor. Pro desbloquea la razon por la que alguien paga: menos carga mental y mejores decisiones.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-7">
              <div className="flex items-center gap-3">
                <Wallet className="h-6 w-6 text-slate-500" />
                <h3 className="text-2xl font-black">Free</h3>
              </div>
              <p className="mt-2 text-slate-600">Para ordenar lo basico y sentir el producto.</p>
              <div className="mt-6">
                <span className="text-5xl font-black">USD 0</span>
                <span className="text-slate-500">/mes</span>
              </div>
              <ul className="mt-7 space-y-3">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register?plan=free" className="mt-8 flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 font-black transition hover:bg-slate-100">
                Empezar gratis
              </Link>
            </div>

            <div className="relative rounded-2xl bg-slate-950 p-7 text-white shadow-2xl lg:col-span-2">
              <div className="absolute right-6 top-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">
                Recomendado
              </div>
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-amber-300" />
                <h3 className="text-2xl font-black">Pro</h3>
              </div>
              <p className="mt-2 max-w-xl text-slate-300">
                Para quien quiere registrar sin esfuerzo y recibir analisis que le ayuden a gastar mejor.
              </p>
              <div className="mt-6 flex flex-wrap items-end gap-4">
                <div>
                  <span className="text-5xl font-black">USD 5</span>
                  <span className="text-slate-400">/mes</span>
                </div>
                <div className="pb-2 text-sm text-emerald-300">
                  o USD 48 al anio, 20% menos
                </div>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {proFeatures.map((feature) => (
                  <div key={feature} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <Link href="/register?plan=annual" className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-7 py-4 font-black text-slate-950 transition hover:bg-emerald-300">
                Quiero Pro
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1.25fr_0.8fr_0.8fr] gap-3 bg-slate-950 px-5 py-4 text-sm font-black text-white">
              <span>Comparacion clara</span>
              <span>Free</span>
              <span>Pro</span>
            </div>
            <div className="px-5">
              <ComparisonRow label="Analisis financiero con IA" free="No incluido" pro="Incluido" />
              <ComparisonRow label="Audios por WhatsApp" free="2/mes" pro="Ilimitado" />
              <ComparisonRow label="Fotos de tickets" free="3/mes" pro="Ilimitado" />
              <ComparisonRow label="Alertas e insights" free="Basico" pro="Inteligente" />
              <ComparisonRow label="Sincronizacion web/app/WhatsApp" free="Incluida" pro="Incluida" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0b0f12] py-20">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
            <Zap className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            El mejor momento para ordenar tus gastos fue antes. El segundo mejor es ahora.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Empeza gratis, manda tus primeros audios o tickets, y deja que FlowMind te muestre por que Pro vale mas que una suscripcion mas.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register?plan=free" className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-7 py-4 font-black text-slate-950 transition hover:bg-emerald-300">
              Crear cuenta gratis
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/register?plan=annual" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-4 font-black text-white transition hover:bg-white/10">
              Ir directo a Pro
              <CreditCard className="h-5 w-5" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Shield className="h-4 w-4 text-emerald-300" /> Datos protegidos</span>
            <span className="inline-flex items-center gap-1.5"><X className="h-4 w-4 text-emerald-300" /> Cancela cuando quieras</span>
            <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-emerald-300" /> Hecho para decidir mejor</span>
            <span className="inline-flex items-center gap-1.5"><Target className="h-4 w-4 text-emerald-300" /> Metas y presupuestos</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-500 sm:flex-row">
          <BrandLogo />
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-white">Ingresar</Link>
            <Link href="/register" className="hover:text-white">Registrarse</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
