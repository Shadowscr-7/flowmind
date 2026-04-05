export type TransactionType = "expense" | "income" | "transfer";
export type AccountType = "bank" | "cash" | "savings" | "investment";
export type Plan = "pro";
export type AlertType = "budget_exceeded" | "goal_reached" | "large_expense" | "recurring_due";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Profile {
  id: string;
  display_name: string | null;
  currency_default: string;
  plan: Plan;
  ai_usage_count: number;
  ai_usage_reset_at: string | null;
  settings_json: Record<string, unknown> | null;
  timezone: string | null;
  whatsapp_phone: string | null;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  is_active: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: "expense" | "income";
  icon: string | null;
  color: string | null;
  is_custom: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category_id: string | null;
  merchant: string | null;
  date: string;
  source: string | null;
  confidence: number | null;
  is_confirmed: boolean;
  is_recurring: boolean;
  notes: string | null;
  accounts?: Account;
  categories?: Category;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  currency: string;
  period: string;
  categories?: Category;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  current_amount: number;
  currency: string;
}

export interface Alert {
  id: string;
  user_id: string;
  type: AlertType;
  threshold: number | null;
  triggered_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  source_transaction_id: string | null;
  type: TransactionType;
  amount: number;
  frequency: RecurringFrequency;
  next_occurrence: string | null;
}

export interface TransactionDraft {
  type: TransactionType;
  amount: number;
  currency: string;
  merchant: string | null;
  category_id: string | null;
  notes: string | null;
  date: string;
}
