import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;

function db() {
  return createClient(SB_URL, SB_SERVICE_KEY);
}

// ─── Log WhatsApp message ─────────────────────────────────────────────────────
async function logMsg(params: {
  userId?: string | null;
  phone: string;
  direction: "inbound" | "outbound";
  messageType?: "text" | "audio" | "image";
  content?: string | null;
  intent?: string | null;
  transactionId?: string | null;
}) {
  try {
    await db().from("whatsapp_messages").insert({
      user_id: params.userId ?? null,
      phone: params.phone,
      direction: params.direction,
      message_type: params.messageType ?? "text",
      content: params.content ?? null,
      intent: params.intent ?? null,
      transaction_id: params.transactionId ?? null,
    });
  } catch (e) {
    console.error("logMsg error:", e);
  }
}

// ─── Send WhatsApp message ────────────────────────────────────────────────────
async function sendWA(to: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return;
  try {
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: to, text }),
    });
  } catch (e) {
    console.error("sendWA error:", e);
  }
}

// ─── Download media from Evolution as base64 ─────────────────────────────────
async function downloadMedia(remoteJid: string, messageId: string): Promise<string | null> {
  try {
    const res = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ message: { key: { remoteJid, id: messageId } } }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.base64 ?? null;
  } catch {
    return null;
  }
}

// ─── OpenAI helpers ───────────────────────────────────────────────────────────
async function gpt(system: string, user: string | object[], model = "gpt-4o-mini"): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content ?? "";
}

async function whisper(audioBase64: string): Promise<string> {
  const binary = Buffer.from(audioBase64, "base64");
  const blob = new Blob([binary], { type: "audio/ogg" });
  const form = new FormData();
  form.append("file", blob, "audio.ogg");
  form.append("model", "whisper-1");
  form.append("language", "es");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper error: ${await res.text()}`);
  return (await res.json()).text ?? "";
}

// ─── Intent + extraction ──────────────────────────────────────────────────────
interface IntentResult {
  intent: "TRANSACTION" | "QUERY" | "HELP" | "CORRECTION";
  transaction: {
    type: "expense" | "income";
    amount: number;
    currency: string;
    merchant: string | null;
    date: string;
    category: string | null;
    notes: string | null;
  } | null;
  query_type: "balance" | "monthly_summary" | "category_breakdown" | "recent" | "general" | null;
  correction: {
    action: "change_account" | "delete" | "change_amount";
    account_name: string | null;
    new_amount: number | null;
  } | null;
}

interface RecentTx {
  id: string;
  type: string;
  amount: number;
  currency: string;
  merchant: string | null;
  date: string;
  account_name: string | null;
}

async function classifyMessage(text: string, currency: string, recentTxs: RecentTx[] = []): Promise<IntentResult> {
  const today = new Date().toISOString().split("T")[0];

  const recentContext = recentTxs.length > 0
    ? `\nÚLTIMOS MOVIMIENTOS REGISTRADOS (del más reciente al más antiguo):\n` +
      recentTxs.map((t, i) =>
        `${i + 1}. ${t.type === "income" ? "Ingreso" : "Gasto"} de ${t.currency} ${t.amount}` +
        `${t.merchant ? ` en ${t.merchant}` : ""}` +
        ` (cuenta: ${t.account_name ?? "desconocida"}, fecha: ${t.date})`
      ).join("\n")
    : "";

  const system = `Eres FlowMind AI procesando mensajes de WhatsApp de finanzas personales.
Fecha hoy: ${today}. Moneda por defecto: ${currency}.
${recentContext}

Tu tarea es entender el INTENTO real del usuario aunque use lenguaje coloquial, informal o indirecto en español.
Respondé SOLO con JSON válido, sin texto adicional:
{
  "intent": "TRANSACTION" | "QUERY" | "HELP" | "CORRECTION",
  "transaction": {
    "type": "expense" | "income",
    "amount": number,
    "currency": "${currency}",
    "merchant": string | null,
    "date": "YYYY-MM-DD",
    "category": string | null,
    "notes": string | null
  } | null,
  "query_type": "balance" | "monthly_summary" | "category_breakdown" | "recent" | "general" | null,
  "correction": {
    "action": "change_account" | "delete" | "change_amount",
    "account_name": string | null,
    "new_amount": number | null
  } | null
}

TRANSACTION: el usuario registra un movimiento de dinero.
  Ejemplos: "gasté 500 en el super", "pagué el alquiler", "cobré el sueldo", "me depositaron 45000", "almorcé y pagué 350"

QUERY: el usuario pregunta sobre sus finanzas.
  Ejemplos: "cuánto gasté?", "cómo estoy?", "dame un resumen", "en qué gasté más?", "cuál es mi balance?"

CORRECTION: el usuario quiere corregir, mover, eliminar o modificar un movimiento ya registrado.
  Puede referirse al último movimiento de forma implícita o explícita.
  Ejemplos:
  - "eso no era del efectivo, es de Santander" → change_account, account_name: "Santander"
  - "el dinero que registré en efectivo es en realidad de mi cuenta Santander" → change_account, account_name: "Santander"
  - "ese ingreso ponelo en el banco" → change_account, account_name: "banco"
  - "me equivoqué de cuenta, era la del Itaú" → change_account, account_name: "Itaú"
  - "borrá eso" / "eliminá el último" / "no era correcto" → delete
  - "el monto estaba mal, eran 800" → change_amount, new_amount: 800
  - "en realidad fueron 1200 no 1000" → change_amount, new_amount: 1200

HELP: saludos, ayuda general, preguntas sobre cómo funciona, contenido no financiero.

Ante la duda entre CORRECTION y HELP: si el usuario menciona cuentas, montos anteriores o hace referencia a algo ya registrado, elegí CORRECTION.`;

  const raw = await gpt(system, text, "gpt-4o");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { intent: "HELP", transaction: null, query_type: null, correction: null };
  return JSON.parse(match[0]) as IntentResult;
}

// ─── Fetch user financial context ─────────────────────────────────────────────
async function getUserContext(userId: string, currency: string) {
  const supabase = db();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [{ data: accounts }, { data: monthTxs }, { data: recentTxs }, { data: budgets }] =
    await Promise.all([
      supabase.from("accounts").select("name, balance, currency").eq("user_id", userId),
      supabase.from("transactions").select("type, amount, currency, category_id, categories(name)")
        .eq("user_id", userId).gte("date", firstOfMonth).lte("date", today),
      supabase.from("transactions").select("type, amount, currency, merchant, date, categories(name)")
        .eq("user_id", userId).order("date", { ascending: false }).limit(5),
      supabase.from("budgets").select("amount, currency, categories(name)").eq("user_id", userId),
    ]);

  const totalBalance = (accounts ?? []).reduce((s, a) => s + (a.balance ?? 0), 0);
  const monthIncome = (monthTxs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = (monthTxs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const catMap: Record<string, number> = {};
  for (const t of monthTxs ?? []) {
    if (t.type === "expense") {
      const name = (t.categories as unknown as { name: string } | null)?.name ?? "Sin categoría";
      catMap[name] = (catMap[name] ?? 0) + t.amount;
    }
  }
  const topCats = Object.entries(catMap).sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([n, v]) => `${n}: ${currency} ${v.toFixed(0)}`).join(", ");

  const recentStr = (recentTxs ?? []).map((t) => {
    const cat = (t.categories as unknown as { name: string } | null)?.name ?? "";
    const sign = t.type === "income" ? "+" : "-";
    return `${sign}${t.currency} ${t.amount} ${t.merchant ?? cat} (${t.date?.split("T")[0] ?? ""})`;
  }).join("\n");

  const budgetStr = (budgets ?? []).map((b) => {
    const cat = (b.categories as unknown as { name: string } | null)?.name ?? "Sin cat";
    return `${cat}: límite ${b.currency} ${b.amount}`;
  }).join(", ");

  return {
    balanceLine: `Balance total: ${currency} ${totalBalance.toFixed(2)} (${(accounts ?? []).map((a) => `${a.name}: ${a.currency} ${a.balance}`).join(", ")})`,
    monthLine: `Este mes — Ingresos: ${currency} ${monthIncome.toFixed(2)} | Gastos: ${currency} ${monthExpense.toFixed(2)} | Neto: ${currency} ${(monthIncome - monthExpense).toFixed(2)}`,
    topCatsLine: `Top categorías de gasto: ${topCats || "sin datos"}`,
    recentLine: `Últimas transacciones:\n${recentStr || "ninguna"}`,
    budgetLine: `Presupuestos: ${budgetStr || "no configurados"}`,
  };
}

async function answerQuery(question: string, ctx: Awaited<ReturnType<typeof getUserContext>>, userName: string) {
  const system = `Sos FlowMind AI, asistente financiero personal de ${userName}.
Respondé de forma amigable y concisa (máx 200 palabras) en español usando los datos del usuario.
Usá emojis moderadamente. Formato WhatsApp (negrita con *, listas con -).

DATOS DEL USUARIO:
${ctx.balanceLine}
${ctx.monthLine}
${ctx.topCatsLine}
${ctx.recentLine}
${ctx.budgetLine}`;
  return await gpt(system, question);
}

// ─── Resolve category ID by name ──────────────────────────────────────────────
async function resolveCategoryId(userId: string, categoryName: string | null): Promise<string | null> {
  if (!categoryName) return null;
  const supabase = db();
  const { data } = await supabase
    .from("categories").select("id")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .ilike("name", `%${categoryName}%`)
    .limit(1).single();
  return data?.id ?? null;
}

// ─── Insert transaction ───────────────────────────────────────────────────────
interface TxPayload {
  type: "expense" | "income";
  amount: number;
  currency: string;
  merchant: string | null;
  date: string;
  category: string | null;
  notes: string | null;
  source: string;
}

async function insertTransaction(
  userId: string,
  accountId: string,
  accountName: string,
  tx: TxPayload,
  currency: string,
  rawPhone: string,
  sendReply: (text: string, opts?: { intent?: string; transactionId?: string }) => Promise<void>
) {
  const categoryId = await resolveCategoryId(userId, tx.category);
  const { data: saved, error: txErr } = await db().from("transactions").insert({
    user_id: userId,
    account_id: accountId,
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency ?? currency,
    date: tx.date ?? new Date().toISOString().split("T")[0],
    merchant: tx.merchant ?? null,
    category_id: categoryId,
    notes: tx.notes ?? null,
    source: tx.source,
    confidence: 0.9,
    is_confirmed: true,
  }).select().single();

  if (txErr || !saved) {
    await sendReply("❌ Error al guardar. Intentá de nuevo.");
    return;
  }

  const emoji = tx.type === "income" ? "💰" : "💸";
  const typeLabel = tx.type === "income" ? "Ingreso" : "Gasto";
  const amt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(tx.amount);

  await sendReply(
    `${emoji} *${typeLabel} guardado* en ${accountName}\n\n` +
    `📌 *${tx.merchant ?? tx.category ?? "Sin descripción"}*\n` +
    `💵 ${tx.currency ?? currency} ${amt}\n` +
    `📅 ${tx.date ?? "hoy"}\n` +
    (tx.notes ? `📝 ${tx.notes}\n` : "") +
    `\n✅ Registrado exitosamente`,
    { intent: "TRANSACTION", transactionId: saved.id }
  );
}

// ─── Main webhook handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.event !== "messages.upsert") {
      return NextResponse.json({ received: true });
    }

    const msgData = body.data;
    if (!msgData) return NextResponse.json({ received: true });

    if (msgData.key?.fromMe === true) return NextResponse.json({ received: true });
    const remoteJid: string = msgData.key?.remoteJid ?? "";
    if (remoteJid.endsWith("@g.us")) return NextResponse.json({ received: true });

    const rawPhone = remoteJid.replace(/@.*/, "");
    const phoneWithPlus = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
    const phoneWithoutPlus = rawPhone.replace(/^\+/, "");

    const supabase = db();

    const messageContent = msgData.message;
    const textContent: string | null =
      messageContent?.conversation ?? messageContent?.extendedTextMessage?.text ?? null;
    const hasImage = !!(messageContent?.imageMessage ?? messageContent?.documentMessage);
    const hasAudio = !!(messageContent?.audioMessage ?? messageContent?.pttMessage);
    const inboundType: "text" | "audio" | "image" = hasAudio ? "audio" : hasImage ? "image" : "text";

    // Find user
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, currency_default, plan, ai_usage_count, ai_usage_reset_at")
      .or(`whatsapp_phone.eq.${phoneWithPlus},whatsapp_phone.eq.${phoneWithoutPlus}`)
      .maybeSingle();

    const userId = profile?.id ?? null;

    void logMsg({ userId, phone: rawPhone, direction: "inbound", messageType: inboundType, content: textContent });

    const reply = async (text: string, opts?: { intent?: string; transactionId?: string }) => {
      await sendWA(rawPhone, text);
      void logMsg({
        userId, phone: rawPhone, direction: "outbound", messageType: "text",
        content: text, intent: opts?.intent ?? null, transactionId: opts?.transactionId ?? null,
      });
    };

    if (!profile) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://app.flowmind.ai";
      await reply(
        `👋 ¡Hola! No encontré una cuenta de *FlowMind* asociada a este número (${phoneWithPlus}).\n\n` +
        `*¿Aún no tenés cuenta?*\n` +
        `Registrarte es fácil — al crear tu cuenta podés ingresar este número y empezar a usarme al instante:\n` +
        `👉 ${appUrl}/register\n\n` +
        `*¿Ya tenés cuenta?*\n` +
        `Vinculá este número desde la app:\n` +
        `Configuración → WhatsApp → ingresá *${phoneWithPlus}*\n\n` +
        `Después podés mandarme tus gastos, ingresos y fotos de tickets directamente por acá 💸`
      );
      return NextResponse.json({ received: true });
    }

    const userName = profile.display_name ?? "Usuario";
    const currency = profile.currency_default ?? "UYU";

    // ── Check for pending account selection ───────────────────────────────────
    const { data: pending } = await supabase
      .from("whatsapp_pending")
      .select("*")
      .eq("phone", rawPhone)
      .eq("pending_type", "account_selection")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending && textContent) {
      const choice = parseInt(textContent.trim(), 10);
      const accounts: { id: string; name: string }[] = pending.payload.accounts ?? [];

      if (!isNaN(choice) && choice >= 1 && choice <= accounts.length) {
        const selectedAccount = accounts[choice - 1];
        await supabase.from("whatsapp_pending").delete().eq("id", pending.id);

        // Correction: change account of existing transaction
        if (pending.payload.correction_tx_id) {
          await supabase.from("transactions").update({ account_id: selectedAccount.id }).eq("id", pending.payload.correction_tx_id);
          await reply(`✅ Moví *${pending.payload.correction_label ?? "el movimiento"}* a la cuenta *${selectedAccount.name}*`);
          return NextResponse.json({ received: true });
        }

        // New transaction: complete with selected account
        const txData: TxPayload = pending.payload;
        await insertTransaction(userId!, selectedAccount.id, selectedAccount.name, txData, currency, rawPhone, reply);
        await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 1 }).eq("id", userId);
        return NextResponse.json({ received: true });
      } else {
        const list = accounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
        await reply(`❓ Opción inválida. Respondé con el número de la cuenta:\n\n${list}`);
        return NextResponse.json({ received: true });
      }
    }

    // ── Get all user accounts ─────────────────────────────────────────────────
    const { data: allAccounts } = await supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    // ── No accounts configured ────────────────────────────────────────────────
    if (!allAccounts || allAccounts.length === 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://app.flowmind.ai";
      await reply(
        `⚠️ *No tenés cuentas configuradas aún.*\n\n` +
        `Para empezar a registrar tus movimientos, primero necesitás crear al menos una cuenta (ej: Efectivo, Banco, Billetera).\n\n` +
        `Hacelo fácilmente desde la app:\n` +
        `👉 ${appUrl}/accounts\n\n` +
        `Una vez que tengas una cuenta creada, podés mandarme tus gastos e ingresos directamente por acá 💸`
      );
      return NextResponse.json({ received: true });
    }

    let processedText: string | null = textContent;
    let source = "whatsapp";

    // ── Audio: transcribe first ───────────────────────────────────────────────
    if (hasAudio) {
      const audioB64 = await downloadMedia(remoteJid, msgData.key?.id ?? "");
      if (!audioB64) {
        await reply("❌ No pude procesar el audio. Intentá por texto.");
        return NextResponse.json({ received: true });
      }
      try {
        processedText = await whisper(audioB64);
        source = "whatsapp_voice";
        void logMsg({ userId, phone: rawPhone, direction: "inbound", messageType: "audio", content: processedText });
        await reply(`🎤 _Transcripción: "${processedText}"_\n\nProcesando...`);
      } catch {
        await reply("❌ Error transcribiendo el audio. Intentá por texto.");
        return NextResponse.json({ received: true });
      }
    }

    // ── Image: analyze receipt ────────────────────────────────────────────────
    if (hasImage) {
      const imgB64 = await downloadMedia(remoteJid, msgData.key?.id ?? "");
      if (!imgB64) {
        await reply("❌ No pude descargar la imagen. Intentá de nuevo.");
        return NextResponse.json({ received: true });
      }

      const dataUri = imgB64.startsWith("data:") ? imgB64 : `data:image/jpeg;base64,${imgB64}`;
      const today = new Date().toISOString().split("T")[0];
      const system = `Analizás tickets/facturas y extraés datos. Responde SOLO JSON:
{"type":"expense","amount":number,"currency":"${currency}","merchant":string|null,"date":"YYYY-MM-DD","category":string|null,"notes":string|null}
Si no es un ticket, devolvé {"error":"not_a_receipt"}.
Fecha hoy: ${today}. Moneda default: ${currency}.`;

      try {
        const raw = await gpt(system, [
          { type: "image_url", image_url: { url: dataUri, detail: "high" } },
          { type: "text", text: "Extraé los datos de este ticket/factura." },
        ] as object[]);

        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("no json");
        const parsed = JSON.parse(match[0]);

        if (parsed.error === "not_a_receipt") {
          await reply("🤔 No pude leer un ticket en la imagen. ¿Podés describirlo por texto?");
          return NextResponse.json({ received: true });
        }

        // Account selection for image transactions
        if (allAccounts.length === 1) {
          const acc = allAccounts[0];
          const txPayload: TxPayload = {
            type: parsed.type ?? "expense",
            amount: parsed.amount,
            currency: parsed.currency ?? currency,
            merchant: parsed.merchant ?? null,
            date: parsed.date ?? today,
            category: parsed.category ?? null,
            notes: parsed.notes ?? null,
            source: "whatsapp_image",
          };
          await insertTransaction(userId!, acc.id, acc.name, txPayload, currency, rawPhone, reply);
        } else {
          const accountList = allAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
          const amt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(parsed.amount);
          await supabase.from("whatsapp_pending").insert({
            phone: rawPhone,
            user_id: userId,
            pending_type: "account_selection",
            payload: {
              type: parsed.type ?? "expense",
              amount: parsed.amount,
              currency: parsed.currency ?? currency,
              merchant: parsed.merchant ?? null,
              date: parsed.date ?? today,
              category: parsed.category ?? null,
              notes: parsed.notes ?? null,
              source: "whatsapp_image",
              accounts: allAccounts.map((a) => ({ id: a.id, name: a.name })),
            },
          });
          await reply(
            `🧾 *Ticket detectado:* ${parsed.merchant ?? "Sin comercio"} — ${parsed.currency ?? currency} ${amt}\n\n` +
            `¿En qué cuenta lo registrás?\n\n${accountList}\n\n_Respondé con el número de la cuenta._`
          );
        }

        await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 1 }).eq("id", userId);
        return NextResponse.json({ received: true });
      } catch (e) {
        console.error("Image analysis error:", e);
        await reply("❌ No pude analizar el ticket. Describílo por texto.");
        return NextResponse.json({ received: true });
      }
    }

    // ── Text / transcribed audio ──────────────────────────────────────────────
    if (!processedText?.trim()) {
      return NextResponse.json({ received: true });
    }

    const lowerText = processedText.toLowerCase().trim();
    if (lowerText === "ayuda" || lowerText === "help" || lowerText === "?") {
      await reply(
        `👋 Hola *${userName}*! Podés hacer:\n\n` +
        `💸 *Registrar gastos:*\n  "Gasté 500 en el super"\n  "Almuerzo 350 pesos"\n\n` +
        `💰 *Registrar ingresos:*\n  "Cobré el sueldo 45000"\n  "Ingresé 5000 freelance"\n\n` +
        `📸 *Ticket/Factura:*\n  Mandá una foto y lo proceso\n\n` +
        `🎤 *Audio:*\n  Mandá una nota de voz\n\n` +
        `📊 *Consultas:*\n  "¿Cuánto gasté este mes?"\n  "¿Cómo está mi balance?"\n  "Dame un análisis"`,
        { intent: "HELP" }
      );
      return NextResponse.json({ received: true });
    }

    // Fetch recent transactions for context
    const { data: recentForContext } = await supabase
      .from("transactions")
      .select("id, type, amount, currency, merchant, date, accounts(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentTxs: RecentTx[] = (recentForContext ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      merchant: t.merchant ?? null,
      date: t.date?.split("T")[0] ?? "",
      account_name: (t.accounts as unknown as { name: string } | null)?.name ?? null,
    }));

    const intent = await classifyMessage(processedText, currency, recentTxs);
    await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 1 }).eq("id", userId);

    // ── TRANSACTION ───────────────────────────────────────────────────────────
    if (intent.intent === "TRANSACTION" && intent.transaction) {
      const tx = intent.transaction;

      if (allAccounts.length === 1) {
        // Only one account — use it directly
        const acc = allAccounts[0];
        await insertTransaction(userId!, acc.id, acc.name, { ...tx, source }, currency, rawPhone, reply);
      } else {
        // Multiple accounts — ask user to choose
        const accountList = allAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
        const amt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(tx.amount);
        const typeLabel = tx.type === "income" ? "Ingreso" : "Gasto";
        const emoji = tx.type === "income" ? "💰" : "💸";

        await supabase.from("whatsapp_pending").insert({
          phone: rawPhone,
          user_id: userId,
          pending_type: "account_selection",
          payload: {
            ...tx,
            source,
            accounts: allAccounts.map((a) => ({ id: a.id, name: a.name })),
          },
        });

        await reply(
          `${emoji} *${typeLabel} detectado:* ${tx.merchant ?? tx.category ?? "Sin descripción"} — ${tx.currency ?? currency} ${amt}\n\n` +
          `¿En qué cuenta lo registrás?\n\n${accountList}\n\n_Respondé con el número de la cuenta._`
        );
      }

      return NextResponse.json({ received: true });
    }

    // ── CORRECTION ───────────────────────────────────────────────────────────
    if (intent.intent === "CORRECTION" && intent.correction) {
      const corr = intent.correction;

      // Get last transaction
      const { data: lastTx } = await supabase
        .from("transactions")
        .select("id, type, amount, currency, merchant, category_id, account_id, accounts(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastTx) {
        await reply("🤔 No encontré ningún movimiento reciente para corregir.");
        return NextResponse.json({ received: true });
      }

      const txLabel = lastTx.merchant ?? `${lastTx.type === "income" ? "ingreso" : "gasto"} de ${lastTx.currency} ${lastTx.amount}`;

      if (corr.action === "delete") {
        await supabase.from("transactions").delete().eq("id", lastTx.id);
        await reply(`🗑️ Eliminé el último movimiento: *${txLabel}*`);
        return NextResponse.json({ received: true });
      }

      if (corr.action === "change_amount" && corr.new_amount) {
        await supabase.from("transactions").update({ amount: corr.new_amount }).eq("id", lastTx.id);
        const amt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(corr.new_amount);
        await reply(`✏️ Actualicé el monto de *${txLabel}* a ${lastTx.currency} ${amt}`);
        return NextResponse.json({ received: true });
      }

      if (corr.action === "change_account" && corr.account_name) {
        // Find account by name (fuzzy)
        const { data: matchedAccounts } = await supabase
          .from("accounts")
          .select("id, name")
          .eq("user_id", userId)
          .ilike("name", `%${corr.account_name}%`);

        if (!matchedAccounts || matchedAccounts.length === 0) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://app.flowmind.ai";
          await reply(
            `⚠️ No encontré ninguna cuenta que se llame *${corr.account_name}*.\n\n` +
            `Creala desde la app y después volvé a avisarme:\n` +
            `👉 ${appUrl}/accounts\n\n` +
            `_Una vez creada podés decirme "ese ingreso ponelo en ${corr.account_name}" y lo muevo._`
          );
          return NextResponse.json({ received: true });
        }

        if (matchedAccounts.length === 1) {
          const acc = matchedAccounts[0];
          await supabase.from("transactions").update({ account_id: acc.id }).eq("id", lastTx.id);
          await reply(`✅ Moví *${txLabel}* a la cuenta *${acc.name}*`);
        } else {
          // Multiple matches — ask to confirm
          const list = matchedAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
          await supabase.from("whatsapp_pending").insert({
            phone: rawPhone,
            user_id: userId,
            pending_type: "account_selection",
            payload: {
              correction_tx_id: lastTx.id,
              correction_label: txLabel,
              accounts: matchedAccounts.map((a) => ({ id: a.id, name: a.name })),
            },
          });
          await reply(`¿A cuál de estas cuentas querés mover *${txLabel}*?\n\n${list}\n\n_Respondé con el número._`);
        }
        return NextResponse.json({ received: true });
      }

      await reply("🤔 No entendí qué querés corregir. Podés decirme:\n• \"Borrá el último movimiento\"\n• \"Ese gasto ponelo en [cuenta]\"\n• \"El monto era [número]\"");
      return NextResponse.json({ received: true });
    }

    // ── QUERY ─────────────────────────────────────────────────────────────────
    if (intent.intent === "QUERY") {
      const ctx = await getUserContext(userId!, currency);
      const answer = await answerQuery(processedText, ctx, userName);
      await reply(answer, { intent: "QUERY" });
      await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 2 }).eq("id", userId);
      return NextResponse.json({ received: true });
    }

    // ── HELP/default ──────────────────────────────────────────────────────────
    await reply(
      `🤔 No entendí bien. Podés decirme:\n• Un gasto: _"Gasté 500 en el super"_\n• Un ingreso: _"Cobré 25000"_\n• Una consulta: _"¿Cuánto gasté este mes?"_\n• O enviá una foto de un ticket\n\nEscribí *ayuda* para más info.`,
      { intent: "HELP" }
    );

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
