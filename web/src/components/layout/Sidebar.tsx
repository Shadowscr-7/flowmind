"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PlusCircle,
  Wallet,
  Target,
  BarChart3,
  Bell,
  Settings,
  Zap,
  MessageSquare,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transacciones" },
  { href: "/add", icon: PlusCircle, label: "Agregar" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/budgets", icon: BarChart3, label: "Presupuestos" },
  { href: "/goals", icon: Target, label: "Metas" },
  { href: "/insights", icon: Zap, label: "Insights IA" },
  { href: "/alerts", icon: Bell, label: "Alertas" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

const adminItems = [
  { href: "/settings/whatsapp", icon: MessageSquare, label: "WhatsApp Admin" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-[280px] min-h-screen bg-sidebar shrink-0">
      {/* Logo */}
      <div className="px-6 py-7">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" fill="white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            FlowMind
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-6 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Admin section */}
      <div className="px-3 pb-3 border-t border-white/5 pt-3">
        {adminItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-white/5 hover:text-slate-400"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="px-6 pb-6">
        <div className="text-xs text-slate-600 text-center">
          FlowMind © 2026
        </div>
      </div>
    </aside>
  );
}
