import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

async function evoGet(path: string) {
  const res = await fetch(`${EVO_URL}${path}`, {
    headers: { apikey: EVO_KEY },
  });
  return res.json();
}

async function evoPost(path: string, body: object) {
  const res = await fetch(`${EVO_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_KEY },
    body: JSON.stringify(body),
  });
  return res.json();
}

// GET /api/whatsapp/setup?action=qr|status|info
export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const action = req.nextUrl.searchParams.get("action") ?? "status";

  if (action === "qr") {
    const data = await evoGet(`/instance/connect/${EVO_INSTANCE}`);
    return NextResponse.json(data);
  }

  if (action === "status") {
    const data = await evoGet(`/instance/connectionState/${EVO_INSTANCE}`);
    return NextResponse.json(data);
  }

  if (action === "info") {
    const data = await evoGet(`/instance/fetchInstances`);
    const instance = Array.isArray(data)
      ? data.find((i: { name: string }) => i.name === EVO_INSTANCE)
      : null;
    return NextResponse.json(instance ?? { error: "Instance not found" });
  }

  return NextResponse.json({ error: "action inválido" }, { status: 400 });
}

// POST /api/whatsapp/setup — set webhook URL in Evolution
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { webhookUrl } = await req.json();
  if (!webhookUrl) return NextResponse.json({ error: "webhookUrl requerido" }, { status: 400 });

  const data = await evoPost(`/webhook/set/${EVO_INSTANCE}`, {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: ["MESSAGES_UPSERT"],
    },
  });

  return NextResponse.json(data);
}
