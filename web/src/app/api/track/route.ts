/**
 * POST /api/track
 * Public endpoint — records a single page-view event from the web frontend.
 * Uses service-role key so it bypasses RLS; never exposes data back to client.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Bot detection heuristic ───────────────────────────────────────────────────
const BOT_PATTERNS =
  /bot|crawl|spider|slurp|mediapartners|adsbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|bingpreview|googlebot|yandex|baiduspider|duckduckbot|ia_archiver/i;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      session_id,
      page,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      duration_seconds,
    } = body as {
      session_id?: string;
      page?: string;
      referrer?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      duration_seconds?: number;
    };

    // Validate required fields
    if (!session_id || typeof session_id !== "string" || session_id.length > 128) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!page || typeof page !== "string" || page.length > 512) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const user_agent = req.headers.get("user-agent") ?? "";
    const is_bot = BOT_PATTERNS.test(user_agent);

    const db = createClient(SB_URL, SB_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await db.from("web_visits").insert({
      session_id: session_id.slice(0, 128),
      ip: getClientIp(req),
      user_agent: user_agent.slice(0, 512),
      page: page.slice(0, 512),
      referrer: referrer ? String(referrer).slice(0, 512) : null,
      utm_source: utm_source ? String(utm_source).slice(0, 128) : null,
      utm_medium: utm_medium ? String(utm_medium).slice(0, 128) : null,
      utm_campaign: utm_campaign ? String(utm_campaign).slice(0, 128) : null,
      utm_content: utm_content ? String(utm_content).slice(0, 128) : null,
      duration_seconds: typeof duration_seconds === "number" ? Math.min(duration_seconds, 86400) : null,
      is_bot,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never surface internal errors to the client
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
