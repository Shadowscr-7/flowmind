"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/lib/types";

export function useAccounts({ includeInactive = false } = {}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase.from("accounts").select("*").order("name", { ascending: true });
    if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) setError(error.message);
    else setAccounts((data as Account[]) ?? []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  async function createAccount(
    account: Omit<Account, "id" | "user_id" | "is_active">
  ): Promise<{ error: string | null }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };
    const { error } = await supabase.from("accounts").insert({ ...account, user_id: user.id, is_active: true });
    if (error) return { error: error.message };
    await fetchAccounts();
    return { error: null };
  }

  async function updateAccount(
    id: string,
    fields: Partial<Pick<Account, "name" | "currency">>
  ): Promise<{ error: string | null }> {
    const supabase = createClient();
    const { error } = await supabase.from("accounts").update(fields).eq("id", id);
    if (error) return { error: error.message };
    await fetchAccounts();
    return { error: null };
  }

  async function toggleAccountActive(id: string, active: boolean): Promise<{ error: string | null }> {
    const supabase = createClient();
    const { error } = await supabase.from("accounts").update({ is_active: active }).eq("id", id);
    if (error) return { error: error.message };
    await fetchAccounts();
    return { error: null };
  }

  const totalBalance = accounts.filter(a => a.is_active).reduce((sum, a) => sum + a.balance, 0);

  return { accounts, loading, error, totalBalance, createAccount, updateAccount, toggleAccountActive, refetch: fetchAccounts };
}
