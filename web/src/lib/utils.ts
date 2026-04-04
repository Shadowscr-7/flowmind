import { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter(Boolean)
    .join(" ");
}

export function formatCurrency(
  amount: number,
  currency: string = "UYU"
): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getMonthRange(date: Date = new Date()): {
  start: string;
  end: string;
} {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    bank: "Banco",
    cash: "Efectivo",
    savings: "Ahorro",
    investment: "Inversión",
  };
  return labels[type] ?? type;
}

export function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    expense: "Gasto",
    income: "Ingreso",
    transfer: "Transferencia",
  };
  return labels[type] ?? type;
}

export function transactionTypeColor(type: string): string {
  switch (type) {
    case "income":
      return "text-emerald-500";
    case "expense":
      return "text-red-500";
    case "transfer":
      return "text-blue-500";
    default:
      return "text-slate-400";
  }
}

export function transactionAmountPrefix(type: string): string {
  switch (type) {
    case "income":
      return "+";
    case "expense":
      return "-";
    default:
      return "";
  }
}

export function getCurrentMonthLabel(): string {
  return new Intl.DateTimeFormat("es-UY", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function getLast6Months(): string[] {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(
      new Intl.DateTimeFormat("es-UY", { month: "short" }).format(d)
    );
  }
  return months;
}
