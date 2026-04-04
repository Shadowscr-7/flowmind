"use client";

import { useEffect, useState } from "react";
import { Bell, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (profile?.display_name) setDisplayName(profile.display_name);

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);

      setUnreadCount(count ?? 0);
    }

    load();
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-slate-100 bg-white shrink-0">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        <Link
          href="/alerts"
          className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <Bell className="h-5 w-5 text-slate-500" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          {displayName && (
            <span className="text-sm font-medium text-slate-700 hidden sm:block">
              {displayName}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
