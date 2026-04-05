'use client';

import { StatCard } from '@/components/StatCard';
import { DataTable, Column } from '@/components/DataTable';
import { formatDate } from '@/lib/utils';
import { Brain, Sparkles, Mic, Camera, MessageSquare, TrendingUp, Zap, BarChart3 } from 'lucide-react';

interface InsightRow {
  id: string;
  userName: string;
  kind: string;
  title: string;
  detail: string;
  confidence: number;
  isRead: boolean;
  createdAt: string;
  [key: string]: unknown;
}

const demoInsights: InsightRow[] = [
  { id: '1', userName: 'María González', kind: 'saving_tip', title: 'Oportunidad de ahorro en Transporte', detail: 'Podrías ahorrar $3,200/mes usando transporte público 2 días/semana.', confidence: 0.89, isRead: true, createdAt: '2026-02-25T08:00:00Z' },
  { id: '2', userName: 'Carlos Pérez', kind: 'spending_alert', title: 'Gasto en Entretenimiento +40%', detail: 'Tu gasto en entretenimiento aumentó 40% vs mes anterior.', confidence: 0.94, isRead: false, createdAt: '2026-02-24T14:00:00Z' },
  { id: '3', userName: 'Diego López', kind: 'budget_warning', title: 'Presupuesto Alimentación al 85%', detail: 'Ya usaste 85% del presupuesto de alimentación y faltan 5 días para fin de mes.', confidence: 0.97, isRead: true, createdAt: '2026-02-23T10:00:00Z' },
  { id: '4', userName: 'Laura Martínez', kind: 'anomaly', title: 'Cobro duplicado detectado', detail: 'Se detectó un posible cobro duplicado de $1,500 en "Netflix".', confidence: 0.82, isRead: false, createdAt: '2026-02-22T16:00:00Z' },
  { id: '5', userName: 'Ana Torres', kind: 'trend', title: 'Tendencia positiva en gastos', detail: 'Tus gastos promedio bajaron 12% en los últimos 3 meses.', confidence: 0.91, isRead: true, createdAt: '2026-02-21T09:00:00Z' },
];

const kindLabels: Record<string, { label: string; badge: string }> = {
  saving_tip: { label: 'Ahorro', badge: 'badge-success' },
  spending_alert: { label: 'Alerta Gasto', badge: 'badge-warning' },
  budget_warning: { label: 'Presupuesto', badge: 'badge-error' },
  anomaly: { label: 'Anomalía', badge: 'badge-error' },
  trend: { label: 'Tendencia', badge: 'badge-info' },
};

const columns: Column<InsightRow>[] = [
  {
    key: 'createdAt',
    header: 'Fecha',
    render: (row) => <span className="text-sm text-gray-500">{formatDate(row.createdAt)}</span>,
  },
  {
    key: 'kind',
    header: 'Tipo',
    render: (row) => {
      const meta = kindLabels[row.kind] ?? { label: row.kind, badge: 'badge' };
      return <span className={meta.badge}>{meta.label}</span>;
    },
  },
  {
    key: 'title',
    header: 'Insight',
    render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.title}</p>
        <p className="text-xs text-gray-400 line-clamp-1">{row.detail}</p>
      </div>
    ),
  },
  { key: 'userName', header: 'Usuario' },
  {
    key: 'confidence',
    header: 'Confianza',
    render: (row) => (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${row.confidence >= 0.9 ? 'bg-green-500' : row.confidence >= 0.8 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${row.confidence * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{Math.round(row.confidence * 100)}%</span>
      </div>
    ),
  },
  {
    key: 'isRead',
    header: 'Estado',
    render: (row) => row.isRead ? <span className="text-xs text-gray-400">Leído</span> : <span className="badge-info">Nuevo</span>,
  },
];

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">IA & Insights</h1>
        <p className="text-sm text-gray-500 mt-1">Rendimiento del motor de inteligencia artificial</p>
      </div>

      {/* AI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Requests IA" value="12,340" change="+18% vs mes anterior" changeType="up" icon={Brain} iconColor="text-brand-500" iconBg="bg-brand-50" />
        <StatCard title="Confianza Promedio" value="87%" change="+2pp" changeType="up" icon={Zap} iconColor="text-amber-500" iconBg="bg-amber-50" />
        <StatCard title="Insights Generados" value="4,521" icon={Sparkles} iconColor="text-purple-500" iconBg="bg-purple-50" />
        <StatCard title="Tasa Lectura" value="68%" change="+5pp" changeType="up" icon={TrendingUp} iconColor="text-green-500" iconBg="bg-green-50" />
      </div>

      {/* AI Input breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Uso por Tipo de Entrada</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50">
            <Mic className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-700">4,120</p>
              <p className="text-sm text-blue-500">Voz (33.4%)</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50">
            <Camera className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-700">3,890</p>
              <p className="text-sm text-green-500">Foto (31.5%)</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-50">
            <MessageSquare className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-purple-700">4,330</p>
              <p className="text-sm text-purple-500">Texto (35.1%)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Insights */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Insights Recientes</h3>
        <DataTable
          columns={columns}
          data={demoInsights}
          searchKey="title"
          searchPlaceholder="Buscar insight..."
          pageSize={10}
        />
      </div>
    </div>
  );
}
