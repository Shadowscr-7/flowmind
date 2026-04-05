'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/DataTable';
import { formatDate, formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/StatCard';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Repeat,
  DollarSign,
  TrendingUp,
  Filter,
} from 'lucide-react';

interface TransactionRow {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  currency: string;
  categoryName: string;
  description: string;
  accountName: string;
  date: string;
  source: string;
  [key: string]: unknown;
}

const demoTransactions: TransactionRow[] = [
  { id: '1', userId: 'u1', userName: 'María González', type: 'expense', amount: 1250, currency: 'UYU', categoryName: 'Alimentación', description: 'Supermercado Disco', accountName: 'BROU Ahorro', date: '2026-02-25T10:00:00Z', source: 'manual' },
  { id: '2', userId: 'u2', userName: 'Carlos Pérez', type: 'income', amount: 45000, currency: 'UYU', categoryName: 'Salario', description: 'Sueldo febrero', accountName: 'Itaú Cuenta', date: '2026-02-24T14:00:00Z', source: 'ai_voice' },
  { id: '3', userId: 'u1', userName: 'María González', type: 'expense', amount: 850, currency: 'UYU', categoryName: 'Transporte', description: 'Uber', accountName: 'Visa Gold', date: '2026-02-24T08:30:00Z', source: 'ai_photo' },
  { id: '4', userId: 'u3', userName: 'Ana Torres', type: 'transfer', amount: 500, currency: 'USD', categoryName: 'Transferencia', description: 'Ahorro mensual', accountName: 'Santander USD', date: '2026-02-23T16:00:00Z', source: 'manual' },
  { id: '5', userId: 'u4', userName: 'Diego López', type: 'expense', amount: 3200, currency: 'UYU', categoryName: 'Entretenimiento', description: 'Netflix + Spotify', accountName: 'OCA Blue', date: '2026-02-23T12:00:00Z', source: 'ai_text' },
  { id: '6', userId: 'u5', userName: 'Laura Martínez', type: 'income', amount: 12000, currency: 'ARS', categoryName: 'Freelance', description: 'Diseño logo', accountName: 'Banco Nación', date: '2026-02-22T09:00:00Z', source: 'manual' },
  { id: '7', userId: 'u2', userName: 'Carlos Pérez', type: 'expense', amount: 4500, currency: 'UYU', categoryName: 'Salud', description: 'Farmacia', accountName: 'BROU Ahorro', date: '2026-02-22T18:00:00Z', source: 'ai_photo' },
];

const typeIcons: Record<string, React.ReactNode> = {
  income: <ArrowDownCircle className="w-4 h-4 text-green-500" />,
  expense: <ArrowUpCircle className="w-4 h-4 text-red-500" />,
  transfer: <Repeat className="w-4 h-4 text-blue-500" />,
};

const sourceLabels: Record<string, string> = {
  manual: 'Manual',
  ai_voice: 'IA Voz',
  ai_photo: 'IA Foto',
  ai_text: 'IA Texto',
};

const columns: Column<TransactionRow>[] = [
  {
    key: 'date',
    header: 'Fecha',
    render: (row) => <span className="text-gray-500 text-sm">{formatDate(row.date)}</span>,
  },
  {
    key: 'type',
    header: 'Tipo',
    render: (row) => (
      <div className="flex items-center gap-1.5">
        {typeIcons[row.type]}
        <span className="capitalize text-sm">{row.type === 'income' ? 'Ingreso' : row.type === 'expense' ? 'Gasto' : 'Transferencia'}</span>
      </div>
    ),
  },
  {
    key: 'description',
    header: 'Descripción',
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.description}</p>
        <p className="text-xs text-gray-400">{row.categoryName}</p>
      </div>
    ),
  },
  {
    key: 'userName',
    header: 'Usuario',
  },
  {
    key: 'accountName',
    header: 'Cuenta',
  },
  {
    key: 'amount',
    header: 'Monto',
    render: (row) => (
      <span className={`font-semibold ${row.type === 'income' ? 'text-green-600' : row.type === 'expense' ? 'text-red-600' : 'text-blue-600'}`}>
        {row.type === 'income' ? '+' : row.type === 'expense' ? '-' : ''}{formatCurrency(row.amount, row.currency)}
      </span>
    ),
  },
  {
    key: 'source',
    header: 'Fuente',
    render: (row) => (
      <span className={`badge ${row.source.startsWith('ai') ? 'badge-info' : 'bg-gray-100 text-gray-600'}`}>
        {sourceLabels[row.source] ?? row.source}
      </span>
    ),
  },
];

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = typeFilter === 'all' ? demoTransactions : demoTransactions.filter((t) => t.type === typeFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transacciones</h1>
          <p className="text-sm text-gray-500 mt-1">Vista global de todas las transacciones</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Transacciones" value="34,521" change="+1,230 este mes" changeType="up" icon={DollarSign} />
        <StatCard title="Ingresos (mes)" value="$2.1M" change="+12%" changeType="up" icon={ArrowDownCircle} iconColor="text-green-500" iconBg="bg-green-50" />
        <StatCard title="Gastos (mes)" value="$1.8M" change="-5%" changeType="down" icon={ArrowUpCircle} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Creadas por IA" value="42%" change="+8pp" changeType="up" icon={TrendingUp} iconColor="text-brand-500" iconBg="bg-brand-50" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {['all', 'income', 'expense', 'transfer'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === t ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'all' ? 'Todas' : t === 'income' ? 'Ingresos' : t === 'expense' ? 'Gastos' : 'Transferencias'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="description"
        searchPlaceholder="Buscar por descripción..."
        pageSize={10}
      />
    </div>
  );
}
