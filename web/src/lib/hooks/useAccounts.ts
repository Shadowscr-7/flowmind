"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/lib/types";

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setAccounts((data as Account[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function createAccount(
    account: Omit<Account, "id" | "user_id">
  ): Promise<{ error: string | null }> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
      .from("accounts")
      .insert({ ...account, user_id: user.id });

    if (error) return { error: error.message };
    await fetchAccounts();
    return { error: null };
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return { accounts, loading, error, totalBalance, createAccount, refetch: fetchAccounts };
}
