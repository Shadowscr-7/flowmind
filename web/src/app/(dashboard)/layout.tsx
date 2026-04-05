"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Landing page at "/" — no sidebar/app shell
  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {children}
      </div>
      <MobileNav />
    </div>
  );
}
