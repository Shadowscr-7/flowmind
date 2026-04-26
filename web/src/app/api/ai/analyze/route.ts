import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ALLOWED_TYPES = ["expense", "income", "transfer"] as const;
const ALLOWED_CURRENCIES = ["UYU", "USD", "EUR", "ARS", "BRL"];
const MAX_INPUT_LENGTH = 8000;

function monthlyStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function upgradeUrl(req: NextRequest) {
  return new URL("/register?plan=monthly", req.url).toString();
}

function buildSystemPrompt(type: string, categories: { id: string; name: string }[], currency: string): string {
  const typeLabel = type === "expense" ? "GASTO" : "INGRESO";
  const catList = categories
    .map((c) => `  - id:"${c.id}" → ${c.name}`)
    .join("\n");

  return `Eres un asistente financiero experto. Extraés datos de transacciones.
El usuario YA confirmó que es un ${typeLabel}. NO cambies el tipo.
Moneda por defecto si no se especifica: ${currency}.
Fecha de hoy: ${new Date().toISOString().split("T")[0]}.

Responde ÚNICAMENTE con JSON válido:
{
  "amount": number,
  "currency": "UYU" | "ARS" | "USD" | "EUR" | "BRL",
  "merchant": string | null,
  "date": "YYYY-MM-DD",
  "category_id": string | null,
  "notes": string | null
}

Categorías disponibles (elegí la más apropiada o null):
${catList}

Reglas:
- En tickets/facturas: usá el TOTAL final (no subtotales)
- Si no se especifica fecha → hoy
- notes: descripción breve de lo que se compró/recibió, máx 80 chars
- Devolvé SOLO el JSON, sin texto adicional`;
}

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "IA no disponible" }, { status: 500 });
  }

  // Require authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    mode: "text" | "image";
    origin?: "text" | "image" | "audio";
    input: string;
    type: "expense" | "income" | "transfer";
    currency: string;
    categories: { id: string; name: string }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { mode, origin = mode, input, type, currency = "UYU", categories = [] } = body;

  if (!input || !type) {
    return NextResponse.json({ error: "Faltan parámetros: input, type" }, { status: 400 });
  }
  if (!["text", "image"].includes(mode)) {
    return NextResponse.json({ error: "mode inválido" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "type inválido" }, { status: 400 });
  }
  if (!ALLOWED_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: "currency inválida" }, { status: 400 });
  }
  if (typeof input !== "string" || input.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: "input demasiado largo" }, { status: 400 });
  }
  if (!Array.isArray(categories)) {
    return NextResponse.json({ error: "categories inválido" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.plan !== "pro" && (origin === "audio" || origin === "image")) {
    const kind = origin === "audio" ? "audio" : "image";
    const limit = origin === "audio" ? 2 : 3;
    const label = origin === "audio" ? "audios" : "fotos";
    const { count } = await supabase
      .from("plan_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", kind)
      .gte("created_at", monthlyStartIso());

    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        {
          code: "FREE_PLAN_MEDIA_LIMIT",
          limit,
          kind,
          upgradeUrl: upgradeUrl(req),
          error: `Tu plan Free permite hasta ${limit} ${label} por mes y ya excediste el limite. Para seguir enviando, pasate a Pro mensual o anual.`,
        },
        { status: 429 }
      );
    }

    await supabase.from("plan_usage_events").insert({
      user_id: user.id,
      kind,
      channel: "web",
    });
  }

  const systemPrompt = buildSystemPrompt(type, categories, currency);

  // Build message content based on mode
  type TextContent = { type: "text"; text: string };
  type ImageContent = { type: "image_url"; image_url: { url: string; detail: "high" } };
  type MessageContent = TextContent | ImageContent;

  let userContent: string | MessageContent[];

  if (mode === "image") {
    // OpenAI vision: image_url with base64 data URI
    const dataUri = input.startsWith("data:") ? input : `data:image/jpeg;base64,${input}`;
    userContent = [
      {
        type: "image_url",
        image_url: { url: dataUri, detail: "high" },
      },
      {
        type: "text",
        text: `Analizá este ${type === "expense" ? "ticket/factura/comprobante de gasto" : "comprobante de ingreso"} y extraé los datos.`,
      },
    ];
  } else {
    userContent = input;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 512,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenAI error:", err);
    return NextResponse.json({ error: "Error en la API de IA" }, { status: 502 });
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content ?? "";

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Respuesta inesperada de la IA" }, { status: 500 });
  }

  try {
    const draft = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json({ error: "No se pudo parsear la respuesta" }, { status: 500 });
  }
}
