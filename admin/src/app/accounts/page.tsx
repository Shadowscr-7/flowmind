'use client';

import { DataTable, Column } from '@/components/DataTable';
import { formatCurrency } from '@/lib/utils';
import { StatCard } from '@/components/StatCard';
import { Wallet, Landmark, CreditCard, PiggyBank } from 'lucide-react';

interface AccountRow {
  id: string;
  userName: string;
  name: string;
  type: string;
  institution: string;
  currentBalance: number;
  currency: string;
  isActive: boolean;
  transactionCount: number;
  [key: string]: unknown;
}

const demoAccounts: AccountRow[] = [
  { id: '1', userName: 'María González', name: 'BROU Ahorro', type: 'savings', institution: 'BROU', currentBalance: 125400, currency: 'UYU', isActive: true, transactionCount: 156 },
  { id: '2', userName: 'María González', name: 'Visa Gold', type: 'credit_card', institution: 'Itaú', currentBalance: -34200, currency: 'UYU', isActive: true, transactionCount: 89 },
  { id: '3', userName: 'Carlos Pérez', name: 'Itaú Cuenta', type: 'checking', institution: 'Itaú', currentBalance: 67800, currency: 'UYU', isActive: true, transactionCount: 234 },
  { id: '4', userName: 'Ana Torres', name: 'Santander USD', type: 'savings', institution: 'Santander', currentBalance: 2300, currency: 'USD', isActive: true, transactionCount: 12 },
  { id: '5', userName: 'Diego López', name: 'OCA Blue', type: 'credit_card', institution: 'OCA', currentBalance: -15600, currency: 'UYU', isActive: true, transactionCount: 78 },
  { id: '6', userName: 'Diego López', name: 'Efectivo', type: 'cash', institution: '-', currentBalance: 5000, currency: 'UYU', isActive: true, transactionCount: 45 },
];

const typeLabels: Record<string, string> = {
  savings: 'Ahorro',
  checking: 'Corriente',
  credit_card: 'Tarjeta Crédito',
  cash: 'Efectivo',
  investment: 'Inversión',
};

const typeIcons: Record<string, React.ReactNode> = {
  savings: <PiggyBank className="w-4 h-4 text-green-500" />,
  checking: <Landmark className="w-4 h-4 text-blue-500" />,
  credit_card: <CreditCard className="w-4 h-4 text-purple-500" />,
  cash: <Wallet className="w-4 h-4 text-amber-500" />,
};

const columns: Column<AccountRow>[] = [
  {
    key: 'name',
    header: 'Cuenta',
    render: (row) => (
      <div className="flex items-center gap-2">
        {typeIcons[row.type] ?? <Wallet className="w-4 h-4 text-gray-400" />}
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400">{row.institution}</p>
        </div>
      </div>
    ),
  },
  { key: 'userName', header: 'Usuario' },
  {
    key: 'type',
    header: 'Tipo',
    render: (row) => <span className="badge bg-gray-100 text-gray-600">{typeLabels[row.type] ?? row.type}</span>,
  },
  {
    key: 'currentBalance',
    header: 'Saldo',
    render: (row) => (
      <span className={`font-semibold ${row.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(row.currentBalance, row.currency)}
      </span>
    ),
  },
  { key: 'currency', header: 'Moneda' },
  { key: 'transactionCount', header: 'Mov.' },
  {
    key: 'isActive',
    header: 'Estado',
    render: (row) => row.isActive ? <span className="badge-success">Activa</span> : <span className="badge-error">Inactiva</span>,
  },
];

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cuentas</h1>
        <p className="text-sm text-gray-500 mt-1">Todas las cuentas de los usuarios</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Cuentas" value="3,241" icon={Wallet} />
        <StatCard title="Tarjetas" value="1,102" icon={CreditCard} iconColor="text-purple-500" iconBg="bg-purple-50" />
        <StatCard title="Ahorro" value="1,456" icon={PiggyBank} iconColor="text-green-500" iconBg="bg-green-50" />
        <StatCard title="Corrientes" value="683" icon={Landmark} iconColor="text-blue-500" iconBg="bg-blue-50" />
      </div>

      <DataTable
        columns={columns}
        data={demoAccounts}
        searchKey="name"
        searchPlaceholder="Buscar cuenta..."
        pageSize={10}
      />
    </div>
  );
}
