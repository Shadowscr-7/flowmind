import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "jgomez@flowmind.app";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL ? user : null;
}

// GET /api/admin/conversations
//   → list of conversations (grouped by phone, latest message)
// GET /api/admin/conversations?phone=xxx
//   → all messages for a specific phone
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone");
  const db = service();

  if (phone) {
    // Messages for a specific phone
    const { data, error } = await db
      .from("whatsapp_messages")
      .select("id, created_at, direction, message_type, content, intent, transaction_id")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  }

  // Conversation list: all phones with at least one message + user info
  const { data: messages, error } = await db
    .from("whatsapp_messages")
    .select(`
      id, created_at, phone, direction, message_type, content, intent,
      user_id,
      profiles:user_id (display_name, whatsapp_phone, plan)
    `)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by phone, keep latest message per phone
  const byPhone = new Map<string, {
    phone: string;
    user_id: string | null;
    display_name: string | null;
    plan: string | null;
    last_message: string | null;
    last_message_at: string;
    last_direction: string;
    message_count: number;
  }>();

  for (const msg of (messages ?? [])) {
    if (!byPhone.has(msg.phone)) {
      const profile = msg.profiles as unknown as { display_name: string; whatsapp_phone: string; plan: string } | null;
      byPhone.set(msg.phone, {
        phone: msg.phone,
        user_id: msg.user_id ?? null,
        display_name: profile?.display_name ?? null,
        plan: profile?.plan ?? null,
        last_message: msg.content,
        last_message_at: msg.created_at,
        last_direction: msg.direction,
        message_count: 1,
      });
    } else {
      byPhone.get(msg.phone)!.message_count++;
    }
  }

  const conversations = Array.from(byPhone.values()).sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  return NextResponse.json({ conversations });
}
