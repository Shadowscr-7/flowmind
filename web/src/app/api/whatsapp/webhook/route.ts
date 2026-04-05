import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;
const EVO_URL = process.env.EVOLUTION_API_URL!;
const EVO_KEY = process.env.EVOLUTION_API_KEY!;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://app.flowmind.ai";

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
      max_tokens: 800,
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

// ─── Intent classification ────────────────────────────────────────────────────
interface RecentTx {
  id: string;
  type: string;
  amount: number;
  currency: string;
  merchant: string | null;
  date: string;
  account_name: string | null;
}

interface AccountInfo {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

interface IntentResult {
  intent: "TRANSACTION" | "QUERY" | "HELP" | "CORRECTION" | "ACCOUNT_CREATION" | "TRANSFER";
  transaction: {
    type: "expense" | "income";
    amount: number;
    currency: string;
    merchant: string | null;
    date: string;
    category: string | null;
    notes: string | null;
  } | null;
  transfer: {
    amount: number;
    currency: string;
    from_account: string | null;
    to_account: string | null;
    date: string;
    notes: string | null;
  } | null;
  query_type: "balance" | "monthly_summary" | "category_breakdown" | "recent" | "general" | null;
  correction: {
    action: "change_account" | "delete" | "change_amount" | "rename_account";
    account_name: string | null;
    new_amount: number | null;
    new_name: string | null;
  } | null;
  account_creation: {
    name: string | null;
    type: "bank" | "cash" | "savings" | "investment" | null;
    currency: string | null;
  } | null;
}

async function classifyMessage(
  text: string,
  currency: string,
  recentTxs: RecentTx[] = [],
  userAccounts: AccountInfo[] = []
): Promise<IntentResult> {
  const today = new Date().toISOString().split("T")[0];

  const recentContext = recentTxs.length > 0
    ? `\nÚLTIMOS MOVIMIENTOS:\n` + recentTxs.map((t, i) =>
        `  ${i + 1}. ${t.type === "income" ? "Ingreso" : "Gasto"} ${t.currency} ${t.amount}` +
        `${t.merchant ? ` (${t.merchant})` : ""} — cuenta: ${t.account_name ?? "?"}, fecha: ${t.date}`
      ).join("\n")
    : "";

  const accountsContext = userAccounts.length > 0
    ? `\nCUENTAS DEL USUARIO:\n` + userAccounts.map(a =>
        `  - ${a.name} (${a.type}, saldo: ${a.currency} ${a.balance})`
      ).join("\n")
    : "\nEl usuario NO tiene cuentas configuradas aún.";

  const system = `Eres FlowMind AI, asistente financiero personal. Procesás mensajes de WhatsApp en español rioplatense.
Fecha hoy: ${today}. Moneda por defecto del usuario: ${currency}.
${recentContext}
${accountsContext}

Analizá el INTENTO REAL del usuario aunque use lenguaje coloquial, indirecto o impreciso.
Respondé ÚNICAMENTE con JSON válido (sin texto extra, sin markdown):

{
  "intent": "TRANSACTION" | "QUERY" | "HELP" | "CORRECTION" | "ACCOUNT_CREATION" | "TRANSFER",
  "transaction": { "type": "expense"|"income", "amount": number, "currency": string, "merchant": string|null, "date": "YYYY-MM-DD", "category": string|null, "notes": string|null } | null,
  "transfer": { "amount": number, "currency": string, "from_account": string|null, "to_account": string|null, "date": "YYYY-MM-DD", "notes": string|null } | null,
  "query_type": "balance"|"monthly_summary"|"category_breakdown"|"recent"|"general" | null,
  "correction": { "action": "change_account"|"delete"|"change_amount"|"rename_account", "account_name": string|null, "new_amount": number|null, "new_name": string|null } | null,
  "account_creation": { "name": string|null, "type": "bank"|"cash"|"savings"|"investment"|null, "currency": string|null } | null
}

── INTENTS ──────────────────────────────────────────────────────────────────

TRANSACTION — movimiento que sale o entra del patrimonio total del usuario.
  expense: dinero que sale hacia afuera (comercios, personas, servicios)
    "gasté 500 en el super" → expense 500
    "pagué el alquiler 15000" → expense 15000
    "le mandé 3000 a Juan" → expense 3000 (pago a otra persona = sale del patrimonio)
    "le pagué a María 800" → expense 800
    "almorcé y pagué 350" → expense 350
  income: dinero que entra desde afuera
    "cobré el sueldo 45000" → income 45000
    "me pagaron 8000 por un trabajo" → income 8000

TRANSFER — dinero que se mueve entre cuentas PROPIAS del usuario (el total no cambia).
  from_account: cuenta de origen (nombre o null si no especificado)
  to_account: cuenta destino (nombre o null si no especificado)
  Ejemplos:
    "pasé 5000 del banco al efectivo" → from: "banco", to: "efectivo"
    "moví 10000 de ahorro a corriente" → from: "ahorro", to: "corriente"
    "saqué 10000 del cajero" → retiro = from: banco/cuenta bancaria, to: efectivo
    "retiré plata del BROU" → from: "BROU", to: efectivo (null si no especifica destino)
    "transferí 20000 a mi cuenta Santander" → from: null (no especifica origen), to: "Santander"
    "moví plata entre cuentas" → from: null, to: null (preguntar ambos)
  IMPORTANTE: Si el usuario dice "transferí a [nombre de persona]" → es TRANSACTION expense, NO transfer.
  IMPORTANTE: Un retiro del cajero siempre es TRANSFER (de cuenta bancaria a efectivo).

QUERY — consultas sobre finanzas.
  "cuánto gasté?" → monthly_summary
  "cómo estoy?" → general
  "cuál es mi saldo?" → balance
  "en qué gasté más?" → category_breakdown
  "mostrá los últimos movimientos" → recent

CORRECTION — corregir algo ya registrado.
  "eso no era del efectivo, es de Santander" → change_account "Santander"
  "ese ingreso ponelo en el Itaú" → change_account "Itaú"
  "me equivoqué de cuenta" → change_account (account_name: null)
  "borrá el último" → delete
  "el monto era 800 no 500" → change_amount 800
  "no es Santandiar, es Santander" → rename_account, new_name: "Santander"

ACCOUNT_CREATION — crear o agregar una cuenta propia.
  "quiero crear una cuenta en Santander" → name: "Santander", type: "bank"
  "agregar mi cuenta BROU" → name: "BROU", type: "bank"
  "quiero agregar mi efectivo" → name: "Efectivo", type: "cash"
  "tengo una caja de ahorro en Itaú" → name: "Itaú", type: "savings"

HELP — saludos, preguntas de uso, contenido no relacionado.

── REGLAS DE DESEMPATE ──────────────────────────────────────────────────────
- "transferí a [persona]" → TRANSACTION expense (no TRANSFER)
- "saqué del cajero" / "retiré del banco" → TRANSFER
- "pasé/moví plata entre cuentas" → TRANSFER
- Si menciona dos cuentas propias → TRANSFER
- Si menciona un comercio o persona externa → TRANSACTION`;

  const raw = await gpt(system, text, "gpt-4o");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { intent: "HELP", transaction: null, query_type: null, correction: null, account_creation: null };
  try {
    return JSON.parse(match[0]) as IntentResult;
  } catch {
    return { intent: "HELP", transaction: null, query_type: null, correction: null, account_creation: null };
  }
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

// ─── Resolve category ID ──────────────────────────────────────────────────────
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

// ─── Extract account correction during confirmation ───────────────────────────
async function extractConfirmationResponse(
  text: string,
  current: { name: string | null; type: string | null; currency: string | null }
): Promise<{ confirmed: boolean; cancelled: boolean; name?: string; type?: string; currency?: string }> {
  const raw = await gpt(
    `El usuario está confirmando la creación de esta cuenta:
Nombre: ${current.name ?? "sin nombre"}
Tipo: ${current.type ?? "desconocido"}
Moneda: ${current.currency ?? "desconocida"}

El usuario respondió: "${text}"

Respondé SOLO JSON:
{
  "confirmed": true|false,
  "cancelled": true|false,
  "name": string|null,
  "type": "bank"|"cash"|"savings"|"investment"|null,
  "currency": string|null
}

- confirmed=true si el usuario dice sí/ok/dale/correcto/perfecto/claro/si/yes
- cancelled=true si dice no/cancelar/olvidalo/no quiero
- Si corrige datos (ej: "no, el nombre es Santander"): confirmed=false, cancelled=false, name: "Santander"
- Solo incluí los campos que cambian, null para el resto`,
    text,
    "gpt-4o"
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { confirmed: false, cancelled: false };
  try { return JSON.parse(match[0]); } catch { return { confirmed: false, cancelled: false }; }
}

// ─── Insert transfer between accounts ────────────────────────────────────────
async function insertTransfer(
  userId: string,
  fromAccountId: string,
  fromAccountName: string,
  toAccountId: string,
  toAccountName: string,
  amount: number,
  currency: string,
  date: string,
  notes: string | null,
  sendReply: (text: string, opts?: { intent?: string }) => Promise<void>
) {
  const { error } = await db().from("transactions").insert({
    user_id: userId,
    account_id: fromAccountId,
    transfer_to_account_id: toAccountId,
    type: "transfer",
    amount,
    currency,
    date,
    notes: notes ?? null,
    source: "whatsapp",
    confidence: 0.95,
    is_confirmed: true,
  });

  if (error) {
    await sendReply("❌ Error al registrar la transferencia. Intentá de nuevo.");
    return;
  }

  const fmt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(amount);
  await sendReply(
    `🔄 *Transferencia registrada*\n\n` +
    `📤 De: *${fromAccountName}*\n` +
    `📥 A: *${toAccountName}*\n` +
    `💵 ${currency} ${fmt}\n` +
    `📅 ${date}\n` +
    (notes ? `📝 ${notes}\n` : "") +
    `\n✅ Ambas cuentas actualizadas`,
    { intent: "TRANSFER" }
  );
}

// ─── Resolve account from name (fuzzy match) ──────────────────────────────────
function matchAccount(name: string | null, accounts: AccountInfo[]): AccountInfo | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  // Exact match first
  const exact = accounts.find(a => a.name.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  const partial = accounts.find(a => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()));
  if (partial) return partial;
  // Type-based match (e.g. "efectivo" → type cash)
  if (["efectivo", "cash", "billetera"].some(k => lower.includes(k))) {
    return accounts.find(a => a.type === "cash") ?? null;
  }
  if (["banco", "bank", "corriente", "cajero"].some(k => lower.includes(k))) {
    return accounts.find(a => a.type === "bank") ?? null;
  }
  if (["ahorro", "saving"].some(k => lower.includes(k))) {
    return accounts.find(a => a.type === "savings") ?? null;
  }
  return null;
}

// ─── Account type helpers ─────────────────────────────────────────────────────
const ACCOUNT_TYPES: Record<string, string> = {
  "1": "bank", "banco": "bank", "bank": "bank", "bancaria": "bank", "corriente": "bank",
  "2": "cash", "efectivo": "cash", "cash": "cash", "billetera": "cash",
  "3": "savings", "ahorro": "savings", "ahorros": "savings", "caja": "savings", "saving": "savings",
  "4": "investment", "inversión": "investment", "inversion": "investment", "inversiones": "investment",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Banco / Cuenta corriente",
  cash: "Efectivo / Billetera",
  savings: "Caja de ahorro",
  investment: "Inversiones",
};

function resolveAccountType(input: string): string | null {
  return ACCOUNT_TYPES[input.toLowerCase().trim()] ?? null;
}

// ─── Main webhook handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.event !== "messages.upsert") return NextResponse.json({ received: true });

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
      void logMsg({ userId, phone: rawPhone, direction: "outbound", messageType: "text",
        content: text, intent: opts?.intent ?? null, transactionId: opts?.transactionId ?? null });
    };

    // Unknown user
    if (!profile) {
      await reply(
        `👋 ¡Hola! No encontré una cuenta de *FlowMind* asociada a este número (${phoneWithPlus}).\n\n` +
        `*¿Aún no tenés cuenta?*\n👉 ${APP_URL}/register\n\n` +
        `*¿Ya tenés cuenta?*\nVinculá este número desde:\nConfiguración → WhatsApp → ingresá *${phoneWithPlus}*\n\n` +
        `Después podés mandarme tus gastos, ingresos y fotos de tickets directamente por acá 💸`
      );
      return NextResponse.json({ received: true });
    }

    const userName = profile.display_name ?? "Usuario";
    const currency = profile.currency_default ?? "UYU";

    // ── Check for active pending state ────────────────────────────────────────
    const { data: pending } = await supabase
      .from("whatsapp_pending")
      .select("*")
      .eq("phone", rawPhone)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending && textContent) {
      // ── Pending: account selection for transaction ──────────────────────────
      if (pending.pending_type === "account_selection") {
        const choice = parseInt(textContent.trim(), 10);
        const accounts: { id: string; name: string }[] = pending.payload.accounts ?? [];

        if (!isNaN(choice) && choice >= 1 && choice <= accounts.length) {
          const selectedAccount = accounts[choice - 1];
          await supabase.from("whatsapp_pending").delete().eq("id", pending.id);

          if (pending.payload.correction_tx_id) {
            await supabase.from("transactions").update({ account_id: selectedAccount.id }).eq("id", pending.payload.correction_tx_id);
            await reply(`✅ Moví *${pending.payload.correction_label ?? "el movimiento"}* a la cuenta *${selectedAccount.name}*`);
          } else {
            const txData: TxPayload = pending.payload;
            await insertTransaction(userId!, selectedAccount.id, selectedAccount.name, txData, currency, reply);
            await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 1 }).eq("id", userId);
          }
        } else {
          const list = accounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
          await reply(`❓ Opción inválida. Respondé con el número:\n\n${list}`);
        }
        return NextResponse.json({ received: true });
      }

      // ── Pending: transfer — waiting for from account ─────────────────────
      if (pending.pending_type === "transfer_select_from") {
        const choice = parseInt(textContent.trim(), 10);
        const accounts: AccountInfo[] = pending.payload.accounts ?? [];
        if (!isNaN(choice) && choice >= 1 && choice <= accounts.length) {
          const selected = accounts[choice - 1];
          const { amount, currency: txCurrency, to_account_id, to_account_name, date, notes } = pending.payload;
          await supabase.from("whatsapp_pending").delete().eq("id", pending.id);
          if (to_account_id) {
            await insertTransfer(userId!, selected.id, selected.name, to_account_id, to_account_name, amount, txCurrency, date, notes, reply);
          } else {
            // Now ask for destination
            const remaining = accounts.filter(a => a.id !== selected.id);
            const list = remaining.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
            await supabase.from("whatsapp_pending").insert({
              phone: rawPhone, user_id: userId, pending_type: "transfer_select_to",
              payload: { amount, currency: txCurrency, from_account_id: selected.id, from_account_name: selected.name, date, notes, accounts: remaining },
            });
            await reply(`¿A qué cuenta va el dinero?\n\n${list}\n\n_Respondé con el número._`);
          }
        } else {
          const list = (pending.payload.accounts as AccountInfo[]).map((a: AccountInfo, i: number) => `${i + 1}. ${a.name}`).join("\n");
          await reply(`❓ Opción inválida:\n\n${list}`);
        }
        return NextResponse.json({ received: true });
      }

      // ── Pending: transfer — waiting for to account ────────────────────────
      if (pending.pending_type === "transfer_select_to") {
        const choice = parseInt(textContent.trim(), 10);
        const accounts: AccountInfo[] = pending.payload.accounts ?? [];
        if (!isNaN(choice) && choice >= 1 && choice <= accounts.length) {
          const selected = accounts[choice - 1];
          const { amount, currency: txCurrency, from_account_id, from_account_name, date, notes } = pending.payload;
          await supabase.from("whatsapp_pending").delete().eq("id", pending.id);
          await insertTransfer(userId!, from_account_id, from_account_name, selected.id, selected.name, amount, txCurrency, date, notes, reply);
        } else {
          const list = (pending.payload.accounts as AccountInfo[]).map((a: AccountInfo, i: number) => `${i + 1}. ${a.name}`).join("\n");
          await reply(`❓ Opción inválida:\n\n${list}`);
        }
        return NextResponse.json({ received: true });
      }

      // ── Pending: account creation — waiting for confirmation ─────────────
      if (pending.pending_type === "account_creation_confirm") {
        const { name, type, currency: accCurrency } = pending.payload;
        const response = await extractConfirmationResponse(textContent, { name, type, currency: accCurrency });

        if (response.cancelled) {
          await supabase.from("whatsapp_pending").delete().eq("id", pending.id);
          await reply("👍 Cancelé la creación de la cuenta. Avisame cuando quieras intentarlo de nuevo.");
          return NextResponse.json({ received: true });
        }

        // Update fields if user corrected something
        const updatedName = response.name ?? name;
        const updatedType = response.type ?? type;
        const updatedCurrency = response.currency ?? accCurrency;

        if (response.confirmed) {
          await supabase.from("whatsapp_pending").delete().eq("id", pending.id);
          const { data: newAcc, error } = await supabase.from("accounts").insert({
            user_id: userId, name: updatedName ?? "Mi cuenta", type: updatedType ?? "bank",
            currency: updatedCurrency ?? currency, initial_balance: 0, balance: 0,
            is_primary: false,
            icon: updatedType === "bank" ? "bank" : updatedType === "savings" ? "piggy_bank" : "wallet",
            color: "#6366f1",
          }).select().single();

          if (error || !newAcc) {
            await reply(`❌ No pude crear la cuenta. Intentá desde la app: 👉 ${APP_URL}/accounts`);
          } else {
            await reply(
              `✅ *Cuenta creada*\n\n🏦 *${newAcc.name}*\n` +
              `📋 ${ACCOUNT_TYPE_LABELS[updatedType ?? "bank"] ?? updatedType}\n` +
              `💱 ${newAcc.currency}\n\nYa podés usarla para registrar movimientos 🎉`
            );
          }
        } else {
          // Update pending with corrected data and re-confirm
          await supabase.from("whatsapp_pending").update({
            payload: { ...pending.payload, name: updatedName, type: updatedType, currency: updatedCurrency },
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }).eq("id", pending.id);
          await reply(
            `📝 Actualicé los datos. ¿Así está bien?\n\n` +
            `🏦 *${updatedName ?? "Sin nombre"}*\n` +
            `📋 ${ACCOUNT_TYPE_LABELS[updatedType ?? ""] ?? updatedType ?? "?"}\n` +
            `💱 ${updatedCurrency ?? currency}\n\n` +
            `Respondé *sí* para confirmar o decime qué cambiar.`
          );
        }
        return NextResponse.json({ received: true });
      }

      // ── Pending: account creation — waiting for type ──────────────────────
      if (pending.pending_type === "account_creation_type") {
        const resolvedType = resolveAccountType(textContent.trim());
        if (!resolvedType) {
          await reply(
            `❓ No reconocí ese tipo. Elegí una opción:\n\n` +
            `1. Banco / Cuenta corriente\n2. Efectivo / Billetera\n3. Caja de ahorro\n4. Inversiones\n\n` +
            `_Respondé con el número o el nombre._`
          );
          return NextResponse.json({ received: true });
        }
        // Move to confirmation step
        await supabase.from("whatsapp_pending").update({
          pending_type: "account_creation_confirm",
          payload: { ...pending.payload, type: resolvedType },
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }).eq("id", pending.id);
        const { name, currency: accCurrency } = pending.payload;
        const finalCurr = accCurrency ?? currency;
        await reply(
          `Voy a crear esta cuenta:\n\n` +
          `🏦 *${name ?? "Sin nombre"}*\n` +
          `📋 ${ACCOUNT_TYPE_LABELS[resolvedType] ?? resolvedType}\n` +
          `💱 ${finalCurr}\n\n` +
          `¿Está bien así? Respondé *sí* para confirmar o decime si querés cambiar algo.`
        );
        return NextResponse.json({ received: true });
      }

      // ── Pending: account creation — waiting for currency ─────────────────
      if (pending.pending_type === "account_creation_currency") {
        const inputCurrency = textContent.trim().toUpperCase();
        const validCurrencies = ["UYU", "USD", "EUR", "ARS", "BRL"];
        const resolvedCurrency = validCurrencies.find(c => inputCurrency.includes(c)) ?? null;

        if (!resolvedCurrency) {
          await reply(`❓ No reconocí la moneda. Ejemplos: UYU, USD, EUR, ARS\n\n¿En qué moneda es la cuenta?`);
          return NextResponse.json({ received: true });
        }

        await supabase.from("whatsapp_pending").delete().eq("id", pending.id);
        const { name, type } = pending.payload;

        const { data: newAcc, error } = await supabase.from("accounts").insert({
          user_id: userId,
          name: name ?? "Mi cuenta",
          type: type ?? "bank",
          currency: resolvedCurrency,
          initial_balance: 0,
          balance: 0,
          is_primary: false,
          icon: type === "bank" ? "bank" : type === "savings" ? "piggy_bank" : "wallet",
          color: "#6366f1",
        }).select().single();

        if (error || !newAcc) {
          await reply("❌ No pude crear la cuenta. Intentá desde la app: " + APP_URL + "/accounts");
        } else {
          await reply(
            `✅ *Cuenta creada exitosamente*\n\n` +
            `🏦 *${newAcc.name}*\n` +
            `📋 Tipo: ${ACCOUNT_TYPE_LABELS[type] ?? type}\n` +
            `💱 Moneda: ${newAcc.currency}\n\n` +
            `Ya podés registrar movimientos en esta cuenta 🎉`
          );
        }
        return NextResponse.json({ received: true });
      }
    }

    // ── Get all user accounts ─────────────────────────────────────────────────
    const { data: allAccounts } = await supabase
      .from("accounts").select("id, name, type, balance, currency")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    const accountsForClassifier: AccountInfo[] = (allAccounts ?? []).map(a => ({
      id: a.id, name: a.name, type: a.type, balance: a.balance, currency: a.currency
    }));

    let processedText: string | null = textContent;
    let source = "whatsapp";

    // ── Audio: transcribe ─────────────────────────────────────────────────────
    if (hasAudio) {
      const audioB64 = await downloadMedia(remoteJid, msgData.key?.id ?? "");
      if (!audioB64) { await reply("❌ No pude procesar el audio. Intentá por texto."); return NextResponse.json({ received: true }); }
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
      if (!imgB64) { await reply("❌ No pude descargar la imagen."); return NextResponse.json({ received: true }); }

      const dataUri = imgB64.startsWith("data:") ? imgB64 : `data:image/jpeg;base64,${imgB64}`;
      const today = new Date().toISOString().split("T")[0];
      const system = `Analizás tickets/facturas. Respondé SOLO JSON:
{"type":"expense","amount":number,"currency":"${currency}","merchant":string|null,"date":"YYYY-MM-DD","category":string|null,"notes":string|null}
Si no es ticket: {"error":"not_a_receipt"}. Fecha hoy: ${today}.`;

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

        const txPayload: TxPayload = {
          type: parsed.type ?? "expense", amount: parsed.amount,
          currency: parsed.currency ?? currency, merchant: parsed.merchant ?? null,
          date: parsed.date ?? today, category: parsed.category ?? null,
          notes: parsed.notes ?? null, source: "whatsapp_image",
        };

        if (!allAccounts || allAccounts.length === 0) {
          await reply(`⚠️ Detecté un ticket pero no tenés cuentas configuradas.\nCreá una desde la app: 👉 ${APP_URL}/accounts`);
        } else if (allAccounts.length === 1) {
          await insertTransaction(userId!, allAccounts[0].id, allAccounts[0].name, txPayload, currency, reply);
        } else {
          const accountList = allAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
          const amt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(parsed.amount);
          await supabase.from("whatsapp_pending").insert({
            phone: rawPhone, user_id: userId, pending_type: "account_selection",
            payload: { ...txPayload, accounts: allAccounts.map(a => ({ id: a.id, name: a.name })) },
          });
          await reply(
            `🧾 *Ticket:* ${parsed.merchant ?? "Sin comercio"} — ${parsed.currency ?? currency} ${amt}\n\n` +
            `¿En qué cuenta lo registrás?\n\n${accountList}\n\n_Respondé con el número._`
          );
        }
        await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 1 }).eq("id", userId);
        return NextResponse.json({ received: true });
      } catch (e) {
        console.error("Image error:", e);
        await reply("❌ No pude analizar el ticket. Describílo por texto.");
        return NextResponse.json({ received: true });
      }
    }

    if (!processedText?.trim()) return NextResponse.json({ received: true });

    const lowerText = processedText.toLowerCase().trim();
    if (lowerText === "ayuda" || lowerText === "help" || lowerText === "?") {
      await reply(
        `👋 Hola *${userName}*! Soy tu asistente financiero. Podés hablarme de forma natural:\n\n` +
        `💸 *Gastos:* "Gasté 500 en el super" / "Pagué el alquiler 15000"\n` +
        `💰 *Ingresos:* "Cobré el sueldo 45000" / "Me entraron 8000"\n` +
        `📸 *Tickets:* Mandá una foto de cualquier factura\n` +
        `🎤 *Voz:* Mandá una nota de voz\n` +
        `📊 *Consultas:* "¿Cómo estoy este mes?" / "¿En qué gasté más?"\n` +
        `✏️ *Correcciones:* "Ese gasto ponelo en Santander" / "Borrá el último"\n` +
        `🏦 *Cuentas:* "Quiero crear una cuenta en el Itaú"`,
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

    const recentTxs: RecentTx[] = (recentForContext ?? []).map(t => ({
      id: t.id, type: t.type, amount: t.amount, currency: t.currency,
      merchant: t.merchant ?? null, date: t.date?.split("T")[0] ?? "",
      account_name: (t.accounts as unknown as { name: string } | null)?.name ?? null,
    }));

    const intent = await classifyMessage(processedText, currency, recentTxs, accountsForClassifier);
    await supabase.from("profiles").update({ ai_usage_count: (profile.ai_usage_count ?? 0) + 1 }).eq("id", userId);

    // ── ACCOUNT_CREATION ──────────────────────────────────────────────────────
    if (intent.intent === "ACCOUNT_CREATION") {
      const ac = intent.account_creation ?? { name: null, type: null, currency: null };
      const accName: string | null = ac.name ?? null;
      let accType: string | null = ac.type ?? null;
      const accCurrency: string | null = ac.currency ?? null;

      if (!accType) {
        // Ask for type
        await supabase.from("whatsapp_pending").insert({
          phone: rawPhone, user_id: userId, pending_type: "account_creation_type",
          payload: { name: accName, currency: accCurrency ?? currency },
        });
        const nameStr = accName ? ` para *${accName}*` : "";
        await reply(
          `🏦 Voy a crear tu cuenta${nameStr}. ¿Qué tipo de cuenta es?\n\n` +
          `1. Banco / Cuenta corriente\n2. Efectivo / Billetera\n3. Caja de ahorro\n4. Inversiones\n\n` +
          `_Respondé con el número o el nombre._`
        );
        return NextResponse.json({ received: true });
      }

      // Check if needs currency
      const finalCurrency = accCurrency ?? currency;

      // Save confirmation pending
      const finalCurrency2 = accCurrency ?? currency;
      await supabase.from("whatsapp_pending").insert({
        phone: rawPhone, user_id: userId, pending_type: "account_creation_confirm",
        payload: { name: accName, type: accType, currency: finalCurrency2 },
      });
      await reply(
        `Voy a crear esta cuenta:\n\n` +
        `🏦 *${accName ?? "Sin nombre"}*\n` +
        `📋 ${ACCOUNT_TYPE_LABELS[accType] ?? accType}\n` +
        `💱 ${finalCurrency2}\n\n` +
        `¿Está bien así? Respondé *sí* para confirmar o decime si querés cambiar algo.`
      );
      return NextResponse.json({ received: true });
    }

    // ── TRANSACTION ───────────────────────────────────────────────────────────
    if (intent.intent === "TRANSACTION" && intent.transaction) {
      const tx = intent.transaction;

      if (!allAccounts || allAccounts.length === 0) {
        await reply(
          `⚠️ *No tenés cuentas configuradas aún.*\n\n` +
          `Podés crear una ahora mismo diciéndome:\n_"Quiero crear una cuenta en [banco/efectivo]"_\n\n` +
          `O desde la app: 👉 ${APP_URL}/accounts`
        );
        return NextResponse.json({ received: true });
      }

      if (allAccounts.length === 1) {
        await insertTransaction(userId!, allAccounts[0].id, allAccounts[0].name, { ...tx, source }, currency, reply);
      } else {
        const accountList = allAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
        const amt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(tx.amount);
        const emoji = tx.type === "income" ? "💰" : "💸";
        await supabase.from("whatsapp_pending").insert({
          phone: rawPhone, user_id: userId, pending_type: "account_selection",
          payload: { ...tx, source, accounts: allAccounts.map(a => ({ id: a.id, name: a.name })) },
        });
        await reply(
          `${emoji} *${tx.type === "income" ? "Ingreso" : "Gasto"} detectado:* ` +
          `${tx.merchant ?? tx.category ?? "movimiento"} — ${tx.currency ?? currency} ${amt}\n\n` +
          `¿En qué cuenta lo registrás?\n\n${accountList}\n\n_Respondé con el número._`
        );
      }
      return NextResponse.json({ received: true });
    }

    // ── TRANSFER ──────────────────────────────────────────────────────────────
    if (intent.intent === "TRANSFER" && intent.transfer) {
      const tr = intent.transfer;
      const today = new Date().toISOString().split("T")[0];
      const txDate = tr.date ?? today;
      const txCurrency = tr.currency ?? currency;
      const fmt = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(tr.amount);

      if (!allAccounts || allAccounts.length < 2) {
        await reply(
          `⚠️ Necesitás al menos *2 cuentas* para registrar una transferencia.\n\n` +
          `Creá otra cuenta diciéndome: _"Quiero crear una cuenta en [banco/efectivo]"_\n` +
          `O desde la app: 👉 ${APP_URL}/accounts`
        );
        return NextResponse.json({ received: true });
      }

      const fromAcc = matchAccount(tr.from_account, allAccounts);
      const toAcc = matchAccount(tr.to_account, allAccounts);

      // Both resolved
      if (fromAcc && toAcc && fromAcc.id !== toAcc.id) {
        await insertTransfer(userId!, fromAcc.id, fromAcc.name, toAcc.id, toAcc.name, tr.amount, txCurrency, txDate, tr.notes, reply);
        return NextResponse.json({ received: true });
      }

      // Need to ask for from
      if (!fromAcc) {
        const eligible = toAcc ? allAccounts.filter(a => a.id !== toAcc.id) : allAccounts;
        const list = eligible.map((a, i) => `${i + 1}. ${a.name} (${txCurrency} ${a.balance})`).join("\n");
        await supabase.from("whatsapp_pending").insert({
          phone: rawPhone, user_id: userId, pending_type: "transfer_select_from",
          payload: {
            amount: tr.amount, currency: txCurrency, date: txDate, notes: tr.notes,
            to_account_id: toAcc?.id ?? null, to_account_name: toAcc?.name ?? null,
            accounts: eligible,
          },
        });
        await reply(
          `🔄 Transferencia de *${txCurrency} ${fmt}*${toAcc ? ` → *${toAcc.name}*` : ""}\n\n` +
          `¿De qué cuenta sale el dinero?\n\n${list}\n\n_Respondé con el número._`
        );
        return NextResponse.json({ received: true });
      }

      // Need to ask for to
      if (!toAcc) {
        const eligible = allAccounts.filter(a => a.id !== fromAcc.id);
        const list = eligible.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
        await supabase.from("whatsapp_pending").insert({
          phone: rawPhone, user_id: userId, pending_type: "transfer_select_to",
          payload: {
            amount: tr.amount, currency: txCurrency, date: txDate, notes: tr.notes,
            from_account_id: fromAcc.id, from_account_name: fromAcc.name,
            accounts: eligible,
          },
        });
        await reply(
          `🔄 Transferencia de *${fromAcc.name}* — *${txCurrency} ${fmt}*\n\n` +
          `¿A qué cuenta va el dinero?\n\n${list}\n\n_Respondé con el número._`
        );
        return NextResponse.json({ received: true });
      }

      // Same account error
      await reply(`⚠️ La cuenta de origen y destino no pueden ser la misma (*${fromAcc.name}*).`);
      return NextResponse.json({ received: true });
    }

    // ── CORRECTION ────────────────────────────────────────────────────────────
    if (intent.intent === "CORRECTION" && intent.correction) {
      const corr = intent.correction;

      // Get last transaction (or search by amount if specified)
      let lastTxQuery = supabase
        .from("transactions")
        .select("id, type, amount, currency, merchant, category_id, account_id, accounts(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: lastTx } = await lastTxQuery.maybeSingle();

      if (!lastTx) {
        await reply("🤔 No encontré ningún movimiento reciente para corregir. Registrá algo primero.");
        return NextResponse.json({ received: true });
      }

      const txLabel = lastTx.merchant ??
        `${lastTx.type === "income" ? "ingreso" : "gasto"} de ${lastTx.currency} ${lastTx.amount}`;

      // ── Rename last created account ─────────────────────────────────────────
      if (corr.action === "rename_account" && corr.new_name) {
        const { data: lastAcc } = await supabase
          .from("accounts").select("id, name")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();

        if (!lastAcc) {
          await reply("🤔 No encontré ninguna cuenta reciente para renombrar.");
          return NextResponse.json({ received: true });
        }
        await supabase.from("accounts").update({ name: corr.new_name }).eq("id", lastAcc.id);
        await reply(`✅ Renombré la cuenta *${lastAcc.name}* a *${corr.new_name}*`);
        return NextResponse.json({ received: true });
      }

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

      if (corr.action === "change_account") {
        if (!corr.account_name) {
          // No account name specified — show list
          if (!allAccounts || allAccounts.length === 0) {
            await reply(`⚠️ No tenés otras cuentas. Creá una diciéndome "quiero crear una cuenta".`);
            return NextResponse.json({ received: true });
          }
          const list = allAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
          await supabase.from("whatsapp_pending").insert({
            phone: rawPhone, user_id: userId, pending_type: "account_selection",
            payload: { correction_tx_id: lastTx.id, correction_label: txLabel,
              accounts: allAccounts.map(a => ({ id: a.id, name: a.name })) },
          });
          await reply(`¿A qué cuenta querés mover *${txLabel}*?\n\n${list}\n\n_Respondé con el número._`);
          return NextResponse.json({ received: true });
        }

        // Search account by name
        const { data: matchedAccounts } = await supabase
          .from("accounts").select("id, name")
          .eq("user_id", userId)
          .ilike("name", `%${corr.account_name}%`);

        if (!matchedAccounts || matchedAccounts.length === 0) {
          await reply(
            `⚠️ No encontré ninguna cuenta que se llame *${corr.account_name}*.\n\n` +
            `¿Querés que te ayude a crearla? Decime:\n` +
            `_"Quiero crear una cuenta ${corr.account_name}"_\n\n` +
            `O desde la app: 👉 ${APP_URL}/accounts`
          );
          return NextResponse.json({ received: true });
        }

        if (matchedAccounts.length === 1) {
          await supabase.from("transactions").update({ account_id: matchedAccounts[0].id }).eq("id", lastTx.id);
          await reply(`✅ Moví *${txLabel}* a la cuenta *${matchedAccounts[0].name}*`);
        } else {
          const list = matchedAccounts.map((a, i) => `${i + 1}. ${a.name}`).join("\n");
          await supabase.from("whatsapp_pending").insert({
            phone: rawPhone, user_id: userId, pending_type: "account_selection",
            payload: { correction_tx_id: lastTx.id, correction_label: txLabel,
              accounts: matchedAccounts.map(a => ({ id: a.id, name: a.name })) },
          });
          await reply(`¿A cuál de estas cuentas querés mover *${txLabel}*?\n\n${list}\n\n_Respondé con el número._`);
        }
        return NextResponse.json({ received: true });
      }

      await reply("🤔 ¿Qué querés corregir del último movimiento?\n• \"Ponelo en [cuenta]\"\n• \"El monto era [número]\"\n• \"Borrá el último\"");
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

    // ── HELP / default ────────────────────────────────────────────────────────
    // Let GPT generate a helpful response instead of a static message
    const helpAnswer = await gpt(
      `Sos FlowMind AI, asistente financiero personal de ${userName} en WhatsApp.
Respondé de forma amigable y corta (máx 3 líneas) en español. No inventes datos financieros.
Si el usuario pregunta algo que podés ayudar (cuentas, gastos, ingresos, presupuesto) explicá cómo.
Si es algo fuera de tu alcance, decilo amablemente y recordá lo que sí podés hacer.`,
      processedText
    );
    await reply(helpAnswer, { intent: "HELP" });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ received: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
