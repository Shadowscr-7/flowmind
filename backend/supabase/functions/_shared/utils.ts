// Shared utilities for edge functions
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TransactionDraft {
  type: "expense" | "income";
  amount: number;
  currency: string;
  date: string;
  merchant: string | null;
  category: string;
  confidence: number;
  needs_user_confirmation: boolean;
  notes?: string;
}

export interface ParseResponse {
  success: boolean;
  draft?: TransactionDraft;
  error?: string;
  raw_payload?: Record<string, unknown>;
}

export function getSupabaseClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: authHeader ?? "" },
      },
    }
  );
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    status,
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Check AI usage quota. Resets monthly.
 * Returns null if quota OK, or an error Response (429) if exceeded.
 * @param supabase Authenticated Supabase client
 * @param userId User's UUID
 * @param aiCallCount How many AI calls this operation will consume (default 1)
 */
export async function checkAiQuota(
  supabase: SupabaseClient,
  userId: string,
  aiCallCount = 1
): Promise<{ allowed: boolean; response?: Response; currentCount: number }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, ai_usage_count, ai_usage_reset_at")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { allowed: true, currentCount: 0 };
  }

  const resetDate = new Date(profile.ai_usage_reset_at);
  const now = new Date();
  const quota = profile.plan === "pro" ? 500 : 50;

  // Reset counter if new month
  if (
    now.getMonth() !== resetDate.getMonth() ||
    now.getFullYear() !== resetDate.getFullYear()
  ) {
    await supabase
      .from("profiles")
      .update({ ai_usage_count: 0, ai_usage_reset_at: now.toISOString() })
      .eq("id", userId);
    return { allowed: true, currentCount: 0 };
  }

  if (profile.ai_usage_count + aiCallCount > quota) {
    return {
      allowed: false,
      response: errorResponse(
        "Límite de IA alcanzado este mes. Actualiza a Pro para más.",
        429
      ),
      currentCount: profile.ai_usage_count,
    };
  }

  return { allowed: true, currentCount: profile.ai_usage_count };
}

export function proUpgradeUrl(): string {
  const appUrl = Deno.env.get("APP_URL") ?? "https://app.flowmind.ai";
  return `${appUrl}/register?plan=monthly`;
}

export async function checkMediaUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  kind: "audio" | "image",
  channel = "mobile"
): Promise<{ allowed: boolean; response?: Response }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  if (profile?.plan === "pro") return { allowed: true };

  const limit = kind === "audio" ? 2 : 3;
  const label = kind === "audio" ? "audios" : "fotos";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await supabase
    .from("plan_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", monthStart);

  if ((count ?? 0) >= limit) {
    return {
      allowed: false,
      response: jsonResponse({
        success: false,
        code: "FREE_PLAN_MEDIA_LIMIT",
        limit,
        kind,
        upgrade_url: proUpgradeUrl(),
        error: `Tu plan Free permite hasta ${limit} ${label} por mes y ya excediste el limite. Para seguir enviando, pasate a Pro mensual o anual.`,
      }, 429),
    };
  }

  await supabase.from("plan_usage_events").insert({
    user_id: userId,
    kind,
    channel,
  });

  return { allowed: true };
}

/**
 * Increment AI usage counter after successful AI call
 */
export async function incrementAiUsage(
  supabase: SupabaseClient,
  userId: string,
  currentCount: number,
  increment = 1
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ ai_usage_count: currentCount + increment })
    .eq("id", userId);
}

// LLM call helper
export async function callLLM(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Whisper STT helper
export async function callWhisper(audioBlob: Blob): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.m4a");
  formData.append("model", "whisper-1");
  formData.append("language", "es");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Whisper API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.text;
}

// Google Vision OCR helper
export async function callVisionOCR(imageBase64: string): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_CLOUD_API_KEY not configured");

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Vision API error: ${await response.text()}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0]?.textAnnotations;
  return annotations?.[0]?.description ?? "";
}

// Transaction parsing prompt
export const PARSE_TRANSACTION_PROMPT = `Eres un asistente financiero. Tu tarea es extraer información de transacciones financieras del texto proporcionado.

DEBES responder ÚNICAMENTE con un JSON válido con este schema exacto:
{
  "type": "expense" | "income",
  "amount": number,
  "currency": "UYU" | "ARS" | "USD" | "EUR" | "BRL" | "MXN",
  "date": "YYYY-MM-DDTHH:mm:ss",
  "merchant": string | null,
  "category": string,
  "confidence": number (0-1),
  "needs_user_confirmation": boolean,
  "notes": string | null
}

Reglas:
- Si no se especifica moneda, asumir UYU
- Si no se especifica fecha, usar la fecha actual
- Si no se puede determinar tipo, asumir "expense"
- "category" debe ser una de: Supermercado, Restaurante, Transporte, Salud, Entretenimiento, Hogar, Ropa, Educación, Otros gastos, Salario, Freelance, Ventas, Otros ingresos
- "confidence" indica qué tan seguro estás de la extracción (0.0 a 1.0)
- Si la confianza es < 0.7, poner needs_user_confirmation: true
- NUNCA incluir texto adicional, solo el JSON`;

// Receipt parsing prompt (after OCR)
export const PARSE_RECEIPT_PROMPT = `Eres un asistente financiero experto en leer tickets de compra. Te doy el texto extraído por OCR de un ticket/factura.

Extrae la información y responde ÚNICAMENTE con este JSON:
{
  "type": "expense",
  "amount": number (el TOTAL de la compra),
  "currency": "UYU" | "ARS" | "USD" | "EUR",
  "date": "YYYY-MM-DDTHH:mm:ss" | null,
  "merchant": string (nombre del comercio) | null,
  "category": string,
  "confidence": number (0-1),
  "needs_user_confirmation": true,
  "notes": string (resumen breve de items si es posible) | null
}

Reglas:
- Busca el TOTAL final (no subtotales ni IVA por separado)
- Si hay múltiples montos, usa el mayor que parezca ser el total
- Si no identificas la moneda, asumir UYU
- Para el merchant, busca nombre del comercio, RUT o razón social
- SIEMPRE poner needs_user_confirmation: true en tickets
- Sé conservador con confidence en tickets borrosos`;
