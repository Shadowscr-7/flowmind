/**
 * whatsapp-webhook — Supabase Edge Function
 *
 * Receives Evolution API webhook events and processes WhatsApp messages
 * from FlowMind users, allowing them to register expenses/income by text or photo.
 *
 * Flow:
 *   1. Evolution API calls this webhook when a message arrives
 *   2. We look up the user by their WhatsApp phone number (stored in profiles.whatsapp_phone)
 *   3. We route to the appropriate ingest function (text or image)
 *   4. We save the transaction via confirm-transaction
 *   5. We reply to the user via Evolution API confirming the transaction
 *
 * Required secrets (set in Supabase dashboard):
 *   EVOLUTION_API_URL   — e.g. https://evo.yourserver.com
 *   EVOLUTION_API_KEY   — global API key for Evolution
 *   EVOLUTION_INSTANCE  — the instance name to send replies from
 *
 * Webhook URL to configure in Evolution:
 *   https://<project>.supabase.co/functions/v1/whatsapp-webhook
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getServiceClient,
  jsonResponse,
  errorResponse,
  corsHeaders,
  callLLM,
  PARSE_TRANSACTION_PROMPT,
  type TransactionDraft,
} from "../_shared/utils.ts";

const EVO_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const EVO_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const body = await req.json();

    // Only handle messages.upsert events
    if (body.event !== "messages.upsert") {
      return jsonResponse({ received: true });
    }

    const msgData = body.data;
    if (!msgData) return jsonResponse({ received: true });

    // Skip outbound messages (fromMe) and group messages
    if (msgData.key?.fromMe === true) return jsonResponse({ received: true });
    const remoteJid: string = msgData.key?.remoteJid ?? "";
    if (remoteJid.endsWith("@g.us")) return jsonResponse({ received: true });

    // Extract phone (strip @s.whatsapp.net)
    const rawPhone = remoteJid.replace(/@.*/, "");
    const phoneWithPlus = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
    const phoneWithoutPlus = rawPhone.replace(/^\+/, "");

    // Find user by whatsapp_phone in profiles
    const db = getServiceClient();
    const { data: profile } = await db
      .from("profiles")
      .select("id, display_name, currency_default, plan, ai_usage_count, ai_usage_reset_at")
      .or(`whatsapp_phone.eq.${phoneWithPlus},whatsapp_phone.eq.${phoneWithoutPlus}`)
      .single();

    if (!profile) {
      // User not registered — send onboarding message
      await sendWhatsApp(
        rawPhone,
        `👋 Hola! Para usar FlowMind por WhatsApp necesitás registrar tu número en la app web.\n\nAndá a Configuración → WhatsApp y vinculá este número.`
      );
      return jsonResponse({ received: true });
    }

    const userId = profile.id;

    // Determine message type: text, image, or audio
    const messageContent = msgData.message;
    const textContent =
      messageContent?.conversation ??
      messageContent?.extendedTextMessage?.text ?? null;
    const hasImage =
      !!messageContent?.imageMessage ?? !!messageContent?.documentMessage;
    const hasAudio =
      !!messageContent?.audioMessage ?? !!messageContent?.pttMessage;

    // ── Check AI quota ──────────────────────────────────────────────────────
    const now = new Date();
    const isPro = profile.plan === "pro";
    const freeLimit = 10;
    const proLimit = 9999;
    const limit = isPro ? proLimit : freeLimit;

    // Reset monthly usage if needed
    let usageCount = profile.ai_usage_count ?? 0;
    if (profile.ai_usage_reset_at) {
      const resetAt = new Date(profile.ai_usage_reset_at);
      if (now > resetAt) {
        usageCount = 0;
        await db
          .from("profiles")
          .update({ ai_usage_count: 0, ai_usage_reset_at: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString() })
          .eq("id", userId);
      }
    }

    if (usageCount >= limit) {
      await sendWhatsApp(rawPhone, `⚠️ Agotaste tu cuota de IA (${limit} consultas/mes). ${isPro ? "Contactá soporte." : "Actualizá a Pro para consultas ilimitadas."}`);
      return jsonResponse({ received: true });
    }

    // ── Get user's default account ──────────────────────────────────────────
    const { data: accounts } = await db
      .from("accounts")
      .select("id, name, currency")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    const defaultAccount = accounts?.[0];
    if (!defaultAccount) {
      await sendWhatsApp(rawPhone, `❌ No tenés cuentas configuradas en FlowMind. Creá una desde la app web primero.`);
      return jsonResponse({ received: true });
    }

    let draft: TransactionDraft | null = null;
    let rawPayload: Record<string, unknown> = {};

    // ── Route by message type ───────────────────────────────────────────────

    if (textContent) {
      // TEXT: parse with ingest-text logic
      if (textContent.trim().toLowerCase() === "ayuda" || textContent.trim() === "?") {
        await sendWhatsApp(rawPhone, helpMessage(profile.display_name));
        return jsonResponse({ received: true });
      }

      const contextMessage = `Fecha actual: ${now.toISOString().split("T")[0]}\n\nTexto del usuario: "${textContent}"`;
      const llmResponse = await callLLM(PARSE_TRANSACTION_PROMPT, contextMessage);
      const parsed: TransactionDraft = JSON.parse(llmResponse);
      draft = { ...parsed, account_id: defaultAccount.id } as unknown as TransactionDraft;
      rawPayload = { source: "whatsapp_text", original_text: textContent, llm_response: llmResponse };

    } else if (hasImage) {
      // IMAGE: download from Evolution and call ingest-receipt logic
      try {
        const mediaBase64 = await downloadMediaFromEvolution(remoteJid, msgData.key?.id ?? "");
        if (!mediaBase64) throw new Error("No se pudo descargar la imagen");

        // Call ingest-receipt edge function as service (bypass auth by using service key)
        const receiptRes = await fetch(`${SUPABASE_URL}/functions/v1/ingest-receipt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "x-user-id": userId,
          },
          body: JSON.stringify({ image_base64: mediaBase64, account_id: defaultAccount.id }),
        });

        if (receiptRes.ok) {
          const receiptJson = await receiptRes.json();
          draft = receiptJson.draft ?? null;
          rawPayload = receiptJson.raw_payload ?? {};
        }
      } catch (imgErr) {
        console.error("Image processing error:", imgErr);
        await sendWhatsApp(rawPhone, "❌ No pude procesar la imagen. Intentá enviando un texto describiendo el gasto.");
        return jsonResponse({ received: true });
      }

    } else if (hasAudio) {
      await sendWhatsApp(rawPhone, "🎤 Por ahora solo proceso texto e imágenes. Mandame un mensaje de texto con el gasto.");
      return jsonResponse({ received: true });
    } else {
      return jsonResponse({ received: true });
    }

    if (!draft) {
      await sendWhatsApp(rawPhone, "❓ No entendí el mensaje. Intentá con algo como: *Gasté 500 en el super* o *Cobré 25000 de sueldo*");
      return jsonResponse({ received: true });
    }

    // ── Resolve category ────────────────────────────────────────────────────
    let categoryId: string | null = null;
    if ((draft as unknown as Record<string, unknown>).category) {
      const catName = (draft as unknown as Record<string, unknown>).category as string;
      const { data: cat } = await db
        .from("categories")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", catName)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    // ── Save transaction via confirm-transaction ────────────────────────────
    const { data: savedTx, error: txError } = await db
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: defaultAccount.id,
        type: draft.type,
        amount: draft.amount,
        currency: draft.currency || profile.currency_default || "UYU",
        date: draft.date || now.toISOString(),
        merchant: draft.merchant ?? null,
        category_id: categoryId,
        notes: draft.notes ?? null,
        source: "whatsapp",
        confidence: draft.confidence ?? 0.9,
        is_confirmed: true,
        raw_payload_json: rawPayload,
      })
      .select()
      .single();

    if (txError || !savedTx) {
      console.error("Transaction save error:", txError);
      await sendWhatsApp(rawPhone, "❌ Hubo un error al guardar la transacción. Intentá de nuevo.");
      return jsonResponse({ received: true });
    }

    // ── Update AI usage count ───────────────────────────────────────────────
    await db
      .from("profiles")
      .update({ ai_usage_count: usageCount + 1 })
      .eq("id", userId);

    // ── Send confirmation ───────────────────────────────────────────────────
    const emoji = draft.type === "income" ? "💰" : draft.type === "transfer" ? "🔄" : "💸";
    const typeLabel = draft.type === "income" ? "Ingreso" : draft.type === "transfer" ? "Transferencia" : "Gasto";
    const currency = draft.currency || profile.currency_default || "UYU";
    const amountStr = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2 }).format(draft.amount);

    const confirmMsg =
      `${emoji} *${typeLabel} registrado* en ${defaultAccount.name}\n\n` +
      `📌 *${draft.merchant ?? "Sin descripción"}*\n` +
      `💵 ${currency} ${amountStr}\n` +
      `📅 ${new Date(draft.date || now).toLocaleDateString("es-UY")}\n` +
      (draft.notes ? `📝 ${draft.notes}\n` : "") +
      `\n_Confianza: ${Math.round((draft.confidence ?? 0.9) * 100)}%_\n\n` +
      `Enviá otro gasto o ingreso cuando quieras 👍`;

    await sendWhatsApp(rawPhone, confirmMsg);

    return jsonResponse({ received: true, transaction_id: savedTx.id });

  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return errorResponse(`Error: ${(err as Error).message}`, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function helpMessage(name: string | null): string {
  return (
    `👋 Hola${name ? ` ${name}` : ""}! Así podés registrar movimientos:\n\n` +
    `💸 *Gastos:*\n` +
    `  • _"Gasté 500 en el super"_\n` +
    `  • _"Almuerzo 350 pesos"_\n` +
    `  • _"Nafta 1200"_\n\n` +
    `💰 *Ingresos:*\n` +
    `  • _"Cobré 25000 de sueldo"_\n` +
    `  • _"Ingresé 5000 por freelance"_\n\n` +
    `📸 *Ticket/Factura:*\n` +
    `  Mandá una foto y la proceso automáticamente\n\n` +
    `_Todos los registros se guardan en tu cuenta de FlowMind web._`
  );
}

async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) {
    console.warn("Evolution API not configured — skipping send");
    return;
  }
  try {
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: to, text }),
    });
  } catch (err) {
    console.error("sendWhatsApp error:", err);
  }
}

async function downloadMediaFromEvolution(remoteJid: string, messageId: string): Promise<string | null> {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return null;
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
