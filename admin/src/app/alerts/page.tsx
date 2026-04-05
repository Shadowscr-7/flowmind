'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/DataTable';
import { formatDate } from '@/lib/utils';
import { StatCard } from '@/components/StatCard';
import { Bell, AlertTriangle, CheckCircle, Clock, Filter } from 'lucide-react';

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  [key: string]: unknown;
}

const demoAlerts: AlertRow[] = [
  { id: '1', type: 'system', severity: 'critical', title: 'Alto uso de API OpenAI', message: 'Se alcanzó el 90% del límite mensual de requests OpenAI.', resolved: false, createdAt: '2026-02-25T06:00:00Z', resolvedAt: null },
  { id: '2', type: 'security', severity: 'high', title: 'Múltiples intentos de login fallidos', message: 'Usuario carlos@example.com: 5 intentos fallidos en 10 minutos.', resolved: true, createdAt: '2026-02-24T22:00:00Z', resolvedAt: '2026-02-24T22:30:00Z' },
  { id: '3', type: 'performance', severity: 'medium', title: 'Latencia alta en Edge Functions', message: 'La función ai-parse-transaction promedia 3.2s (umbral: 2s).', resolved: false, createdAt: '2026-02-24T15:00:00Z', resolvedAt: null },
  { id: '4', type: 'data', severity: 'low', title: 'Categorías sin transacciones', message: '12 categorías personalizadas no tienen transacciones en 30 días.', resolved: true, createdAt: '2026-02-23T09:00:00Z', resolvedAt: '2026-02-23T10:00:00Z' },
  { id: '5', type: 'system', severity: 'medium', title: 'Almacenamiento Storage 70%', message: 'El bucket de recibos usa 700MB de 1GB disponible.', resolved: false, createdAt: '2026-02-22T14:00:00Z', resolvedAt: null },
];

const severityConfig: Record<string, { badge: string; label: string }> = {
  critical: { badge: 'badge-error', label: 'Crítica' },
  high: { badge: 'badge-warning', label: 'Alta' },
  medium: { badge: 'badge bg-amber-100 text-amber-700', label: 'Media' },
  low: { badge: 'badge bg-gray-100 text-gray-600', label: 'Baja' },
};

const columns: Column<AlertRow>[] = [
  {
    key: 'createdAt',
    header: 'Fecha',
    render: (row) => <span className="text-sm text-gray-500">{formatDate(row.createdAt)}</span>,
  },
  {
    key: 'severity',
    header: 'Severidad',
    render: (row) => {
      const cfg = severityConfig[row.severity] ?? { badge: 'badge', label: row.severity };
      return <span className={cfg.badge}>{cfg.label}</span>;
    },
  },
  {
    key: 'title',
    header: 'Alerta',
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.title}</p>
        <p className="text-xs text-gray-400 line-clamp-1">{row.message}</p>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Tipo',
    render: (row) => <span className="capitalize text-sm">{row.type}</span>,
  },
  {
    key: 'resolved',
    header: 'Estado',
    render: (row) =>
      row.resolved ? (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Resuelta</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-amber-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm">Pendiente</span>
        </div>
      ),
  },
];

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = statusFilter === 'all'
    ? demoAlerts
    : statusFilter === 'pending'
      ? demoAlerts.filter((a) => !a.resolved)
      : demoAlerts.filter((a) => a.resolved);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
        <p className="text-sm text-gray-500 mt-1">Monitoreo y alertas del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Alertas Activas" value="3" changeType="up" change="2 críticas" icon={AlertTriangle} iconColor="text-red-500" iconBg="bg-red-50" />
        <StatCard title="Resueltas (mes)" value="18" icon={CheckCircle} iconColor="text-green-500" iconBg="bg-green-50" />
        <StatCard title="Tiempo Respuesta" value="24 min" change="promedio" changeType="neutral" icon={Clock} iconColor="text-blue-500" iconBg="bg-blue-50" />
        <StatCard title="Total (mes)" value="21" icon={Bell} />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {[
          { key: 'all', label: 'Todas' },
          { key: 'pending', label: 'Pendientes' },
          { key: 'resolved', label: 'Resueltas' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="title"
        searchPlaceholder="Buscar alerta..."
        pageSize={10}
      />
    </div>
  );
}
