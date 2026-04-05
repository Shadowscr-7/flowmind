'use client';

import { StatCard } from '@/components/StatCard';
import { RevenueChart, CategoryPieChart, GrowthChart } from '@/components/Charts';
import { BarChart3, TrendingUp, Users, Clock } from 'lucide-react';

const revenueData = [
  { month: 'Sep', income: 28000000, expenses: 22000000 },
  { month: 'Oct', income: 31000000, expenses: 24000000 },
  { month: 'Nov', income: 33000000, expenses: 25000000 },
  { month: 'Dic', income: 35000000, expenses: 27000000 },
  { month: 'Ene', income: 38000000, expenses: 28000000 },
  { month: 'Feb', income: 42000000, expenses: 30000000 },
];

const categoryData = [
  { name: 'Alimentación', value: 32, color: '#6C63FF' },
  { name: 'Transporte', value: 18, color: '#00BFA6' },
  { name: 'Entretenimiento', value: 14, color: '#FF6B6B' },
  { name: 'Salud', value: 12, color: '#4ECDC4' },
  { name: 'Vivienda', value: 24, color: '#FFE66D' },
];

const growthData = [
  { month: 'Sep', users: 820, transactions: 18000 },
  { month: 'Oct', users: 910, transactions: 21000 },
  { month: 'Nov', users: 980, transactions: 24500 },
  { month: 'Dic', users: 1050, transactions: 27000 },
  { month: 'Ene', users: 1150, transactions: 30500 },
  { month: 'Feb', users: 1247, transactions: 34521 },
];

const retentionData = [
  { cohort: 'Sep 2025', m0: 100, m1: 72, m2: 58, m3: 51, m4: 46, m5: 43 },
  { cohort: 'Oct 2025', m0: 100, m1: 75, m2: 62, m3: 54, m4: 49 },
  { cohort: 'Nov 2025', m0: 100, m1: 78, m2: 65, m3: 57 },
  { cohort: 'Dic 2025', m0: 100, m1: 76, m2: 63 },
  { cohort: 'Ene 2026', m0: 100, m1: 80 },
  { cohort: 'Feb 2026', m0: 100 },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Métricas detalladas de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="MAU" value="892" change="+15% vs mes ant." changeType="up" icon={Users} />
        <StatCard title="DAU" value="342" change="+8%" changeType="up" icon={TrendingUp} iconColor="text-green-500" iconBg="bg-green-50" />
        <StatCard title="Tx/usuario/mes" value="27.7" change="+3.2" changeType="up" icon={BarChart3} iconColor="text-brand-500" iconBg="bg-brand-50" />
        <StatCard title="Sesión Promedio" value="4:32" change="min" changeType="neutral" icon={Clock} iconColor="text-amber-500" iconBg="bg-amber-50" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Volumen por Mes</h3>
          <RevenueChart data={revenueData} />
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Distribución por Categoría</h3>
          <CategoryPieChart data={categoryData} />
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Crecimiento Usuarios & Transacciones</h3>
        <GrowthChart data={growthData} />
      </div>

      {/* Retention cohort table */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Retención por Cohorte</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">Cohorte</th>
                <th className="pb-2 px-3 text-center">M0</th>
                <th className="pb-2 px-3 text-center">M1</th>
                <th className="pb-2 px-3 text-center">M2</th>
                <th className="pb-2 px-3 text-center">M3</th>
                <th className="pb-2 px-3 text-center">M4</th>
                <th className="pb-2 px-3 text-center">M5</th>
              </tr>
            </thead>
            <tbody>
              {retentionData.map((row) => (
                <tr key={row.cohort} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{row.cohort}</td>
                  {[row.m0, row.m1, row.m2, row.m3, row.m4, row.m5].map((val, i) => (
                    <td key={i} className="py-2 px-3 text-center">
                      {val !== undefined ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(108, 99, 255, ${(val / 100) * 0.6 + 0.1})`,
                            color: val > 50 ? 'white' : '#4B5563',
                          }}
                        >
                          {val}%
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
