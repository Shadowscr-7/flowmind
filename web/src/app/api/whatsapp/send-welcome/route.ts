/**
 * POST /api/whatsapp/send-welcome
 * Sends the onboarding welcome message to a user's WhatsApp number.
 * Called after phone is saved (registration or settings update).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;

async function sendWA(phone: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return;
  await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVO_KEY },
    body: JSON.stringify({ number: phone, text }),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, name } = await req.json().catch(() => ({}));
  if (!phone) return NextResponse.json({ error: "Missing phone" }, { status: 400 });

  const userName = name ?? "👋";

  const welcome =
    `🎉 *¡Bienvenido a FlowMind, ${userName}!*\n\n` +
    `Soy tu asistente financiero personal. Desde acá podés manejar *todas tus finanzas* hablando de forma natural.\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `🚀 *¿Qué podés hacer?*\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `💸 *Registrar gastos*\n` +
    `_"Gasté 500 en el super"_\n` +
    `_"Pagué el alquiler 15000"_\n\n` +
    `💰 *Registrar ingresos*\n` +
    `_"Cobré el sueldo 45000"_\n\n` +
    `🔄 *Transferencias entre cuentas*\n` +
    `_"Pasé 5000 del banco al efectivo"_\n\n` +
    `📸 *Escanear tickets*\n` +
    `_Mandá una foto de cualquier factura y la registro automáticamente_\n\n` +
    `🎤 *Notas de voz*\n` +
    `_Mandá un audio y lo proceso igual_\n\n` +
    `📊 *Consultar tus finanzas*\n` +
    `_"¿Cómo estoy este mes?"_\n` +
    `_"¿En qué gasté más?"_\n\n` +
    `🤖 *Análisis IA*\n` +
    `_"Dame un análisis de mis finanzas"_\n\n` +
    `🔔 *Configurar alertas*\n` +
    `_"Avisame si gasto más de 10000 en comida"_\n\n` +
    `🎯 *Metas de ahorro*\n` +
    `_"Quiero ahorrar 50000 para vacaciones"_\n\n` +
    `🎫 *Soporte*\n` +
    `_"Quiero hacer un reclamo"_\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⚙️ *Configuración inicial recomendada*\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `Para sacarle el máximo provecho, te recomiendo:\n\n` +
    `*1️⃣ Crear tus cuentas*\n` +
    `Decime: _"Quiero crear una cuenta en [banco/efectivo/ahorro]"_\n` +
    `O desde la app → Cuentas\n\n` +
    `*2️⃣ Configurar presupuestos*\n` +
    `Entrá a la app → Presupuestos y definí límites por categoría\n\n` +
    `*3️⃣ Activar alertas inteligentes*\n` +
    `Decime: _"Quiero un resumen semanal"_ o configuralo en Alertas\n\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `Escribí *ayuda* en cualquier momento para ver todos los comandos.\n\n` +
    `¡Empecemos! 💪 ¿Querés crear tu primera cuenta?`;

  try {
    await sendWA(phone, welcome);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("send-welcome error:", e);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
