'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/DataTable';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Users as UsersIcon, UserPlus, Shield, Ban } from 'lucide-react';
import { StatCard } from '@/components/StatCard';

interface UserRow {
  id: string;
  displayName: string;
  email: string;
  plan: string;
  currencyDefault: string;
  onboardingCompleted: boolean;
  aiUsageCount: number;
  accountCount: number;
  transactionCount: number;
  createdAt: string;
  lastSignIn: string;
  [key: string]: unknown;
}

// Demo data
const demoUsers: UserRow[] = [
  {
    id: '1', displayName: 'María González', email: 'maria@example.com', plan: 'pro',
    currencyDefault: 'UYU', onboardingCompleted: true, aiUsageCount: 45,
    accountCount: 3, transactionCount: 234, createdAt: '2025-11-15T10:00:00Z', lastSignIn: '2026-02-25T08:30:00Z',
  },
  {
    id: '2', displayName: 'Carlos Pérez', email: 'carlos@example.com', plan: 'free',
    currencyDefault: 'UYU', onboardingCompleted: true, aiUsageCount: 12,
    accountCount: 2, transactionCount: 89, createdAt: '2025-12-01T14:00:00Z', lastSignIn: '2026-02-24T19:00:00Z',
  },
  {
    id: '3', displayName: 'Ana Torres', email: 'ana@example.com', plan: 'free',
    currencyDefault: 'USD', onboardingCompleted: false, aiUsageCount: 3,
    accountCount: 1, transactionCount: 15, createdAt: '2026-01-20T08:00:00Z', lastSignIn: '2026-02-23T12:00:00Z',
  },
  {
    id: '4', displayName: 'Diego López', email: 'diego@example.com', plan: 'pro',
    currencyDefault: 'UYU', onboardingCompleted: true, aiUsageCount: 120,
    accountCount: 4, transactionCount: 567, createdAt: '2025-09-10T16:00:00Z', lastSignIn: '2026-02-25T07:00:00Z',
  },
  {
    id: '5', displayName: 'Laura Martínez', email: 'laura@example.com', plan: 'free',
    currencyDefault: 'ARS', onboardingCompleted: true, aiUsageCount: 28,
    accountCount: 2, transactionCount: 145, createdAt: '2025-10-05T11:00:00Z', lastSignIn: '2026-02-22T20:00:00Z',
  },
];

const columns: Column<UserRow>[] = [
  {
    key: 'displayName',
    header: 'Usuario',
    render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
          <span className="text-sm font-semibold text-brand-700">
            {row.displayName.charAt(0)}
          </span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{row.displayName}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'plan',
    header: 'Plan',
    render: (row) => (
      <span className={row.plan === 'pro' ? 'badge-info' : 'badge bg-gray-100 text-gray-600'}>
        {row.plan === 'pro' ? '⭐ Pro' : 'Free'}
      </span>
    ),
  },
  {
    key: 'aiUsageCount',
    header: 'IA Uso',
    render: (row) => (
      <div>
        <span className="font-medium">{row.aiUsageCount}</span>
        <span className="text-xs text-gray-400"> / {row.plan === 'pro' ? 500 : 50}</span>
      </div>
    ),
  },
  {
    key: 'transactionCount',
    header: 'Transacciones',
    render: (row) => <span className="font-medium">{row.transactionCount}</span>,
  },
  {
    key: 'accountCount',
    header: 'Cuentas',
  },
  {
    key: 'onboardingCompleted',
    header: 'Onboarding',
    render: (row) =>
      row.onboardingCompleted ? (
        <span className="badge-success">Completo</span>
      ) : (
        <span className="badge-warning">Pendiente</span>
      ),
  },
  {
    key: 'createdAt',
    header: 'Registro',
    render: (row) => <span className="text-gray-500">{formatDate(row.createdAt)}</span>,
  },
  {
    key: 'lastSignIn',
    header: 'Último acceso',
    render: (row) => <span className="text-gray-500">{formatDate(row.lastSignIn)}</span>,
  },
];

export default function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de usuarios registrados en Flowmind
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Usuarios"
          value="1,247"
          change="+47 este mes"
          changeType="up"
          icon={UsersIcon}
        />
        <StatCard
          title="Nuevos (7d)"
          value="23"
          icon={UserPlus}
          iconColor="text-green-500"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Plan Pro"
          value="186"
          change="14.9% del total"
          changeType="neutral"
          icon={Shield}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Sin Onboarding"
          value="34"
          change="2.7% del total"
          changeType="down"
          icon={Ban}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
      </div>

      {/* Users table */}
      <DataTable
        columns={columns}
        data={demoUsers}
        searchKey="displayName"
        searchPlaceholder="Buscar usuario por nombre..."
        onRowClick={setSelectedUser}
        pageSize={10}
      />

      {/* User detail panel */}
      {selectedUser && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Detalle de Usuario</h3>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cerrar
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Nombre</p>
              <p className="font-medium">{selectedUser.displayName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="font-medium">{selectedUser.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Moneda</p>
              <p className="font-medium">{selectedUser.currencyDefault}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ID</p>
              <p className="font-mono text-xs text-gray-500">{selectedUser.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
