'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

// ─── Revenue Chart ──────────────────────────────────────

interface RevenueData {
  month: string;
  income: number;
  expenses: number;
}

export function RevenueChart({ data }: { data: RevenueData[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Ingresos vs Gastos
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(value)
              }
            />
            <Bar dataKey="income" name="Ingresos" fill="#4CAF50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Gastos" fill="#E53935" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Category Pie Chart ─────────────────────────────────

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

const RADIAN = Math.PI / 180;

export function CategoryPieChart({ data }: { data: CategoryData[] }) {
  const renderLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent,
  }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Gastos por Categoría
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={100}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Users Growth Line Chart ────────────────────────────

interface GrowthData {
  date: string;
  users: number;
  transactions: number;
}

export function GrowthChart({ data }: { data: GrowthData[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Crecimiento
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="users" name="Usuarios" stroke="#6C63FF" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="transactions" name="Transacciones" stroke="#00BFA6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
