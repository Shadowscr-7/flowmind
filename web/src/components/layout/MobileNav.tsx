"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PlusCircle,
  Wallet,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { href: "/transactions", icon: ArrowLeftRight, label: "Movimientos" },
  { href: "/add", icon: PlusCircle, label: "Agregar" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/settings", icon: Settings, label: "Config" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 flex">
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive =
          href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium transition-colors ${
              isActive ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                isActive ? "text-indigo-600" : "text-slate-400"
              }`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
