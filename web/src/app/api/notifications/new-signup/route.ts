import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendSignupNotification } from "@/lib/email/signup-notification";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Body = {
  phone?: string | null;
  plan?: string | null;
  source?: string | null;
};

function cleanText(value: unknown, max = 128) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseServer = await createServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const phone = cleanText(body.phone, 40);
    const plan = cleanText(body.plan, 32);
    const source = cleanText(body.source, 32);
    const displayName =
      cleanText(user.user_metadata?.display_name, 120) ||
      cleanText(user.user_metadata?.full_name, 120) ||
      cleanText(user.user_metadata?.name, 120) ||
      user.email.split("@")[0];

    const db = createSupabaseAdmin(SB_URL, SB_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing, error: existingError } = await db
      .from("signup_notifications")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return NextResponse.json({ ok: true, alreadySent: true });
    }

    await sendSignupNotification({
      userId: user.id,
      email: user.email,
      displayName,
      phone,
      plan,
      source,
      createdAt: user.created_at,
    });

    const { error: insertError } = await db.from("signup_notifications").insert({
      user_id: user.id,
      email: user.email,
      display_name: displayName,
      phone,
      plan,
      source,
    });

    if (insertError && insertError.code !== "23505") {
      throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("new-signup notification error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
