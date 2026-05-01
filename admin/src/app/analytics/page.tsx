'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import {
  Globe, Users, Eye, Clock, ExternalLink,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';

// ── Types ────────────────────────────────────────────────────────────────────

interface Kpis {
  totalViews: number;
  uniqueSessions: number;
  uniqueIps: number;
  avgDurationSeconds: number;
  views7: number;
  sessions7: number;
}

interface AnalyticsData {
  kpis: Kpis;
  visitsByDay: { date: string; count: number }[];
  topPages: { page: string; count: number }[];
  funnel: { step: string; sessions: number }[];
  topReferrers: { referrer: string; count: number }[];
  utmCampaigns: { campaign: string; sessions: number; views: number; utm_source: string | null; utm_medium: string | null }[];
  topIps: { ip: string; views: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const FUNNEL_COLORS = ['#6C63FF', '#7C73FF', '#A78BFA', '#C4B5FD'];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('No se pudieron cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error ?? 'Error desconocido'}
      </div>
    );
  }

  const { kpis, visitsByDay, topPages, funnel, topReferrers, utmCampaigns, topIps } = data;
  const funnelMax = funnel[0]?.sessions || 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics del Sitio Web</h1>
        <p className="text-sm text-gray-500 mt-1">Últimos 30 días — visitas reales, bots excluidos</p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Páginas vistas (30d)"
          value={kpis.totalViews.toLocaleString()}
          change={`${kpis.views7.toLocaleString()} últimos 7d`}
          changeType="up"
          icon={Eye}
        />
        <StatCard
          title="Sesiones únicas (30d)"
          value={kpis.uniqueSessions.toLocaleString()}
          change={`${kpis.sessions7.toLocaleString()} últimos 7d`}
          changeType="up"
          icon={Users}
          iconColor="text-green-500"
          iconBg="bg-green-50"
        />
        <StatCard
          title="IPs únicas (30d)"
          value={kpis.uniqueIps.toLocaleString()}
          icon={Globe}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Tiempo promedio"
          value={fmtDuration(kpis.avgDurationSeconds)}
          change="por página"
          changeType="neutral"
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
        />
      </div>

      {/* ── Visits by day ─────────────────────────────────────────────────── */}
      <Card title="Visitas por día">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visitsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip labelFormatter={(v: string) => `Fecha: ${v}`} formatter={(v: number) => [v, 'Visitas']} />
              <Line type="monotone" dataKey="count" stroke="#6C63FF" strokeWidth={2} dot={false} name="Visitas" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Funnel + Top pages ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card title="Embudo de conversión">
          <div className="space-y-3">
            {funnel.map((step, i) => {
              const pct = funnelMax > 0 ? Math.round((step.sessions / funnelMax) * 100) : 0;
              return (
                <div key={step.step}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{step.step}</span>
                    <span className="text-gray-500">{step.sessions.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: FUNNEL_COLORS[i] ?? '#6C63FF' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {funnel[0]?.sessions > 0 && (
            <p className="mt-4 text-xs text-gray-400">
              Tasa landing → registro:{' '}
              <strong>
                {funnel[1]
                  ? `${Math.round((funnel[1].sessions / funnel[0].sessions) * 100)}%`
                  : '—'}
              </strong>
            </p>
          )}
        </Card>

        {/* Top pages */}
        <Card title="Páginas más visitadas">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPages.slice(0, 10)} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="page"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + '…' : v)}
                />
                <Tooltip formatter={(v: number) => [v, 'Vistas']} />
                <Bar dataKey="count" fill="#6C63FF" radius={[0, 4, 4, 0]} name="Vistas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Referrers + UTM campaigns ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top referrers */}
        <Card title="Principales fuentes de tráfico">
          <div className="space-y-2">
            {topReferrers.length === 0 && (
              <p className="text-sm text-gray-400">Sin datos aún</p>
            )}
            {topReferrers.map((r, i) => (
              <div key={r.referrer} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700">{r.referrer}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{r.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* UTM campaigns */}
        <Card title="Campañas publicitarias (UTM)">
          {utmCampaigns.length === 0 ? (
            <p className="text-sm text-gray-400">
              Aún no hay visitas con parámetros UTM. Agregá{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">
                ?utm_source=facebook&utm_medium=cpc&utm_campaign=nombre
              </code>{' '}
              a tus anuncios.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b">
                    <th className="pb-2 font-medium">Campaña</th>
                    <th className="pb-2 font-medium">Fuente</th>
                    <th className="pb-2 font-medium text-right">Sesiones</th>
                    <th className="pb-2 font-medium text-right">Vistas</th>
                  </tr>
                </thead>
                <tbody>
                  {utmCampaigns.map((c) => (
                    <tr key={c.campaign} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 font-medium text-gray-800 max-w-[120px] truncate">{c.campaign}</td>
                      <td className="py-2 text-gray-500 text-xs">
                        {[c.utm_source, c.utm_medium].filter(Boolean).join(' / ')}
                      </td>
                      <td className="py-2 text-right text-gray-700">{c.sessions.toLocaleString()}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{c.views.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Top IPs ───────────────────────────────────────────────────────── */}
      <Card title="Top visitantes por IP (últimos 30d)">
        <p className="text-xs text-gray-400 mb-3">
          IPs con muchas visitas pueden ser bots no detectados o usuarios muy recurrentes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">IP</th>
                <th className="pb-2 font-medium text-right">Páginas vistas</th>
              </tr>
            </thead>
            <tbody>
              {topIps.map((r, i) => (
                <tr key={r.ip} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="py-2 text-gray-400 w-8">{i + 1}</td>
                  <td className="py-2 font-mono text-gray-700">{r.ip}</td>
                  <td className="py-2 text-right font-semibold">{r.views.toLocaleString()}</td>
                </tr>
              ))}
              {topIps.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-400">Sin datos aún</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
