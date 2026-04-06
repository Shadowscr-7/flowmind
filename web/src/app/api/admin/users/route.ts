/**
 * Admin users API
 * GET    /api/admin/users          — list all users
 * POST   /api/admin/users          — create user (pro plan, no payment)
 * PATCH  /api/admin/users          — ban / unban user
 * DELETE /api/admin/users          — delete user permanently
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

function serviceDb() {
  return createClient(SB_URL, SB_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

  const supabase = serviceDb();

  // Get all auth users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const authUsers = authData.users ?? [];

  // Get all profiles for display_name
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, plan, created_at, ai_usage_count");

  const profileMap = new Map((profiles ?? []).map((p: { id: string; display_name: string | null; plan: string; ai_usage_count: number }) => [p.id, p]));

  const users = authUsers.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      display_name: profile?.display_name ?? null,
      plan: profile?.plan ?? "pro",
      ai_usage_count: profile?.ai_usage_count ?? 0,
      banned: !!u.banned_until,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at ?? null,
    };
  });

  // Sort: newest first
  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password, display_name } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }

  const supabase = serviceDb();

  // Create user in Supabase Auth (email confirmed automatically)
  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update profile with display_name if provided (profile auto-created by trigger)
  if (display_name && newUser.user) {
    await supabase
      .from("profiles")
      .update({ display_name })
      .eq("id", newUser.user.id);
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: newUser.user?.id,
      email: newUser.user?.email,
      display_name: display_name ?? null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action } = await req.json(); // action: "ban" | "unban"
  if (!id || !action) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });

  const supabase = serviceDb();

  const { error } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: action === "ban" ? "876000h" : "none",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const supabase = serviceDb();
  const { error } = await supabase.auth.admin.deleteUser(id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
