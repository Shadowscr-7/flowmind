'use client';

import { useEffect, useState } from 'react';
import { Users, Receipt, DollarSign, Brain, TrendingUp, Activity } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { RevenueChart, CategoryPieChart, GrowthChart } from '@/components/Charts';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  totalVolume: number;
  aiRequests: number;
  avgConfidence: number;
}

// Demo data — replace with real Supabase queries
const demoStats: DashboardStats = {
  totalUsers: 1247,
  activeUsers: 892,
  totalTransactions: 34521,
  totalVolume: 45800000,
  aiRequests: 12340,
  avgConfidence: 0.87,
};

const demoRevenueData = [
  { month: 'Sep', income: 3200000, expenses: 2800000 },
  { month: 'Oct', income: 3500000, expenses: 2900000 },
  { month: 'Nov', income: 3100000, expenses: 3200000 },
  { month: 'Dic', income: 4200000, expenses: 3400000 },
  { month: 'Ene', income: 3800000, expenses: 3100000 },
  { month: 'Feb', income: 4500000, expenses: 3600000 },
];

const demoCategoryData = [
  { name: 'Alimentación', value: 35, color: '#F44336' },
  { name: 'Transporte', value: 20, color: '#2196F3' },
  { name: 'Entretenimiento', value: 15, color: '#4CAF50' },
  { name: 'Servicios', value: 18, color: '#FF9800' },
  { name: 'Otros', value: 12, color: '#9C27B0' },
];

const demoGrowthData = [
  { date: 'Sep', users: 580, transactions: 12000 },
  { date: 'Oct', users: 720, transactions: 18000 },
  { date: 'Nov', users: 860, transactions: 22000 },
  { date: 'Dic', users: 980, transactions: 26000 },
  { date: 'Ene', users: 1100, transactions: 30000 },
  { date: 'Feb', users: 1247, transactions: 34521 },
];

const recentActivity = [
  { user: 'María González', action: 'Registró un gasto de $1,200', time: 'Hace 2 min', type: 'transaction' },
  { user: 'Carlos Pérez', action: 'Se registró como nuevo usuario', time: 'Hace 15 min', type: 'signup' },
  { user: 'Ana Torres', action: 'Usó IA para parsear un ticket', time: 'Hace 30 min', type: 'ai' },
  { user: 'Diego López', action: 'Excedió presupuesto de Alimentación', time: 'Hace 1h', type: 'alert' },
  { user: 'Laura Martínez', action: 'Registró un ingreso de $45,000', time: 'Hace 2h', type: 'transaction' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(demoStats);

  useEffect(() => {
    // TODO: Fetch real stats from Supabase
    // loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumen general de Flowmind — Febrero 2026
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Usuarios Totales"
          value={stats.totalUsers.toLocaleString()}
          change="+12% vs mes anterior"
          changeType="up"
          icon={Users}
        />
        <StatCard
          title="Usuarios Activos"
          value={stats.activeUsers.toLocaleString()}
          change={`${((stats.activeUsers / stats.totalUsers) * 100).toFixed(0)}% del total`}
          changeType="neutral"
          icon={Activity}
          iconColor="text-green-500"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Transacciones"
          value={stats.totalTransactions.toLocaleString()}
          change="+18% vs mes anterior"
          changeType="up"
          icon={Receipt}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Volumen Total"
          value={formatCurrency(stats.totalVolume)}
          change="+23% vs mes anterior"
          changeType="up"
          icon={DollarSign}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Solicitudes IA"
          value={stats.aiRequests.toLocaleString()}
          change="Texto: 60% · Voz: 25% · Ticket: 15%"
          changeType="neutral"
          icon={Brain}
          iconColor="text-purple-500"
          iconBg="bg-purple-50"
        />
        <StatCard
          title="Confianza IA (promedio)"
          value={`${(stats.avgConfidence * 100).toFixed(0)}%`}
          change="+2% vs mes anterior"
          changeType="up"
          icon={TrendingUp}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={demoRevenueData} />
        <CategoryPieChart data={demoCategoryData} />
      </div>

      <GrowthChart data={demoGrowthData} />

      {/* Recent Activity */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            Actividad Reciente
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {recentActivity.map((activity, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${
                activity.type === 'transaction' ? 'bg-blue-500' :
                activity.type === 'signup' ? 'bg-green-500' :
                activity.type === 'ai' ? 'bg-purple-500' :
                'bg-amber-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.user}</span>{' '}
                  {activity.action}
                </p>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
