/**
 * GET /api/analytics
 * Returns aggregated web-visit analytics for the admin dashboard.
 * This runs server-side using the Supabase service role — never exposed to browsers.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const revalidate = 0; // always fresh

export async function GET() {
  const db = createAdminClient();

  const now = new Date();
  const days30Ago = new Date(now);
  days30Ago.setDate(days30Ago.getDate() - 30);
  const iso30 = days30Ago.toISOString();

  const days7Ago = new Date(now);
  days7Ago.setDate(days7Ago.getDate() - 7);
  const iso7 = days7Ago.toISOString();

  // ── All visits (last 30d, excluding bots) ─────────────────────────────────
  const { data: visits } = await db
    .from("web_visits")
    .select("id, session_id, ip, page, referrer, utm_source, utm_medium, utm_campaign, utm_content, duration_seconds, created_at")
    .eq("is_bot", false)
    .gte("created_at", iso30)
    .order("created_at", { ascending: false });

  const rows = visits ?? [];

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalViews = rows.length;
  const uniqueSessions = new Set(rows.map((r) => r.session_id)).size;
  const uniqueIps = new Set(rows.map((r) => r.ip).filter(Boolean)).size;

  const rows7 = rows.filter((r) => r.created_at >= iso7);
  const views7 = rows7.length;
  const sessions7 = new Set(rows7.map((r) => r.session_id)).size;

  // ── Visits by day ─────────────────────────────────────────────────────────
  const byDay: Record<string, number> = {};
  for (const r of rows) {
    const day = r.created_at.slice(0, 10); // "YYYY-MM-DD"
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const visitsByDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // ── Top pages ─────────────────────────────────────────────────────────────
  const pageCount: Record<string, number> = {};
  for (const r of rows) {
    pageCount[r.page] = (pageCount[r.page] ?? 0) + 1;
  }
  const topPages = Object.entries(pageCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([page, count]) => ({ page, count }));

  // ── Funnel ────────────────────────────────────────────────────────────────
  // Landing → /login or /register → (registered users)
  const funnelLanding = new Set(
    rows.filter((r) => r.page === "/" || r.page === "").map((r) => r.session_id)
  ).size;
  const funnelRegister = new Set(
    rows
      .filter((r) => r.page.includes("register") || r.page.includes("signup"))
      .map((r) => r.session_id)
  ).size;
  const funnelLogin = new Set(
    rows.filter((r) => r.page.includes("login")).map((r) => r.session_id)
  ).size;

  // Actual registered users count
  const { count: registeredUsers } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const funnel = [
    { step: "Landing (/)", sessions: funnelLanding },
    { step: "Registro", sessions: funnelRegister },
    { step: "Login", sessions: funnelLogin },
    { step: "Usuarios registrados (total)", sessions: registeredUsers ?? 0 },
  ];

  // ── Top referrers ─────────────────────────────────────────────────────────
  const refCount: Record<string, number> = {};
  for (const r of rows) {
    let ref = "(directo)";
    if (r.referrer) {
      try {
        ref = new URL(r.referrer).hostname.replace(/^www\./, "");
      } catch {
        ref = r.referrer.slice(0, 50);
      }
    }
    refCount[ref] = (refCount[ref] ?? 0) + 1;
  }
  const topReferrers = Object.entries(refCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }));

  // ── UTM campaigns ─────────────────────────────────────────────────────────
  const utmCount: Record<string, { sessions: Set<string>; views: number }> = {};
  for (const r of rows) {
    const campaign = r.utm_campaign ?? "(sin campaña)";
    if (!utmCount[campaign]) utmCount[campaign] = { sessions: new Set(), views: 0 };
    utmCount[campaign].sessions.add(r.session_id);
    utmCount[campaign].views++;
  }
  const utmCampaigns = Object.entries(utmCount)
    .sort(([, a], [, b]) => b.views - a.views)
    .slice(0, 10)
    .map(([campaign, { sessions, views }]) => ({
      campaign,
      sessions: sessions.size,
      views,
      utm_source: rows.find((r) => r.utm_campaign === campaign)?.utm_source ?? null,
      utm_medium: rows.find((r) => r.utm_campaign === campaign)?.utm_medium ?? null,
    }));

  // ── Top IPs ───────────────────────────────────────────────────────────────
  const ipCount: Record<string, number> = {};
  for (const r of rows) {
    if (r.ip) ipCount[r.ip] = (ipCount[r.ip] ?? 0) + 1;
  }
  const topIps = Object.entries(ipCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([ip, views]) => ({ ip, views }));

  // ── Avg time on page ──────────────────────────────────────────────────────
  const durRows = rows.filter((r) => r.duration_seconds != null && r.duration_seconds > 0);
  const avgDuration =
    durRows.length > 0
      ? Math.round(durRows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / durRows.length)
      : 0;

  return NextResponse.json({
    kpis: {
      totalViews,
      uniqueSessions,
      uniqueIps,
      avgDurationSeconds: avgDuration,
      views7,
      sessions7,
    },
    visitsByDay,
    topPages,
    funnel,
    topReferrers,
    utmCampaigns,
    topIps,
  });
}
