"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  MessagesSquare,
  LogOut,
  LifeBuoy,
  Ticket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Transacciones" },
  { href: "/add", icon: PlusCircle, label: "Agregar" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/budgets", icon: BarChart3, label: "Presupuestos" },
  { href: "/goals", icon: Target, label: "Metas" },
  { href: "/insights", icon: Zap, label: "Insights IA" },
  { href: "/alerts", icon: Bell, label: "Alertas" },
  { href: "/support", icon: LifeBuoy, label: "Soporte" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

const adminItems = [
  { href: "/admin/conversations", icon: MessagesSquare, label: "Conversaciones" },
  { href: "/admin/tickets",       icon: Ticket,         label: "Tickets" },
  { href: "/settings/whatsapp",   icon: MessageSquare,  label: "WhatsApp Admin" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [openTickets, setOpenTickets] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        // Fetch open ticket count for badge
        fetch("/api/admin/tickets?status=open")
          .then(r => r.json())
          .then(j => setOpenTickets((j.tickets ?? []).length))
          .catch(() => {});
      }
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex flex-col w-[280px] h-screen sticky top-0 bg-sidebar shrink-0">
      {/* Logo */}
      <div className="px-6 py-7 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <img
            src="/images/logo.png"
            alt="FlowMind"
            className="h-9 w-9 object-contain drop-shadow-md"
          />
          <span
            className="font-extrabold text-lg tracking-tight"
            style={{
              background: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 40%, #67e8f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            FlowMind
          </span>
        </Link>
      </div>

      {/* Nav — scrollable */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
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

      {/* Footer — always visible at bottom */}
      <div className="shrink-0 border-t border-white/5">
        {/* Admin section — only visible to admin */}
        {isAdmin && (
          <div className="px-3 pt-3 pb-1">
            {adminItems.map(({ href, icon: Icon, label }) => {
              const isActive = pathname.startsWith(href);
              const badge = href === "/admin/tickets" && openTickets > 0 ? openTickets : 0;
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
                  <span className="flex-1">{label}</span>
                  {badge > 0 && (
                    <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Logout + copyright */}
        <div className="px-3 pb-4 pt-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Cerrar sesión
          </button>
          <p className="text-xs text-slate-700 text-center mt-2">FlowMind © 2026</p>
        </div>
      </div>
    </aside>
  );
}
