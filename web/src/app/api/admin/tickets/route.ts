/**
 * Admin tickets API
 * GET  /api/admin/tickets          — list all tickets (admin only)
 * PATCH /api/admin/tickets         — update status/notes + notify user via WA
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

function serviceDb() { return createClient(SB_URL, SB_KEY); }

async function sendWA(phone: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE || !phone) return;
  try {
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: phone, text }),
    });
  } catch { /* non-blocking */ }
}

async function requireAdmin(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // open | in_progress | resolved | all
  const supabase = serviceDb();

  let query = supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, admin_notes } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = serviceDb();

  // Fetch ticket to get phone + subject
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (admin_notes !== undefined) updates.admin_notes = admin_notes;
  if (status === "resolved") {
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = admin.id;
  }

  const { error } = await supabase.from("support_tickets").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify user via WhatsApp if resolved and has phone
  if (status === "resolved" && ticket.phone) {
    const noteMsg = admin_notes ? `\n\n📝 _${admin_notes}_` : "";
    await sendWA(
      ticket.phone,
      `✅ *Tu ticket fue resuelto*\n\n` +
      `📋 *${ticket.subject}*${noteMsg}\n\n` +
      `Si el problema persiste o tenés otra consulta, escribinos nuevamente. ¡Gracias! 🙏`
    );
  }

  // Also create web notification if user is registered
  if (status === "resolved" && ticket.user_id) {
    await supabase.from("notifications").insert({
      user_id: ticket.user_id,
      title: "Ticket resuelto",
      body: `Tu consulta "${ticket.subject}" fue resuelta.${admin_notes ? ` ${admin_notes}` : ""}`,
      type: "info",
    });
  }

  return NextResponse.json({ ok: true });
}
