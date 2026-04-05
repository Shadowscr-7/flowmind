"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/lib/types";

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  type?: string;
  categoryId?: string;
  accountId?: string;
  page?: number;
  pageSize?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  const {
    startDate,
    endDate,
    type,
    categoryId,
    accountId,
    page = 0,
    pageSize = 20,
  } = filters;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("transactions")
      .select("*, accounts!account_id(id, name, type), categories(id, name, icon, color)", { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);
    if (type && type !== "all") query = query.eq("type", type);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (accountId) query = query.eq("account_id", accountId);

    query = query.range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count: total } = await query;

    if (error) {
      setError(error.message);
    } else {
      setTransactions((data as Transaction[]) ?? []);
      setCount(total ?? 0);
    }
    setLoading(false);
  }, [startDate, endDate, type, categoryId, accountId, page, pageSize]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, count, refetch: fetchTransactions };
}

export function useRecentTransactions(limit = 5) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("transactions")
        .select("*, accounts!account_id(id, name, type), categories(id, name, icon, color)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      setTransactions((data as Transaction[]) ?? []);
      setLoading(false);
    }

    fetch();
  }, [limit]);

  return { transactions, loading };
}

export function useMonthTransactions() {
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const { data } = await supabase
        .from("transactions")
        .select("type, amount")
        .gte("date", start)
        .lte("date", end);

      if (data) {
        const inc = data
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        const exp = data
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0);
        setIncome(inc);
        setExpenses(exp);
      }
      setLoading(false);
    }

    fetch();
  }, []);

  return { income, expenses, loading };
}
