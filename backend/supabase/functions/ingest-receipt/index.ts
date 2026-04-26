import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import {
  getSupabaseClient,
  callLLM,
  callVisionOCR,
  checkAiQuota,
  checkMediaUsageLimit,
  incrementAiUsage,
  PARSE_RECEIPT_PROMPT,
  jsonResponse,
  errorResponse,
  corsHeaders,
  type TransactionDraft,
} from "../_shared/utils.ts";

// Heuristic extraction from OCR text
function extractReceiptHeuristics(ocrText: string): {
  totalGuess: number | null;
  dateGuess: string | null;
  vendorGuess: string | null;
} {
  let totalGuess: number | null = null;
  let dateGuess: string | null = null;
  let vendorGuess: string | null = null;

  // Extract total — look for "TOTAL" keyword followed by number
  const totalPatterns = [
    /TOTAL\s*[\$S\/]*\s*([\d.,]+)/i,
    /TOTAL\s*A\s*PAGAR\s*[\$S\/]*\s*([\d.,]+)/i,
    /IMPORTE\s*TOTAL\s*[\$S\/]*\s*([\d.,]+)/i,
    /MONTO\s*[\$S\/]*\s*([\d.,]+)/i,
  ];
  for (const pattern of totalPatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const numStr = match[1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        totalGuess = val;
        break;
      }
    }
  }

  // Extract date
  const datePatterns = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    /(\d{2})[\/\-](\d{2})[\/\-](\d{2})/,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
  ];
  for (const pattern of datePatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      dateGuess = match[0];
      break;
    }
  }

  // Extract vendor — usually first non-empty line
  const lines = ocrText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2);
  if (lines.length > 0) {
    // Skip lines that look like addresses or numbers
    for (const line of lines.slice(0, 3)) {
      if (!/^\d+$/.test(line) && !/^(RUC|RUT|NIT|RFC)/.test(line)) {
        vendorGuess = line.substring(0, 60);
        break;
      }
    }
  }

  return { totalGuess, dateGuess, vendorGuess };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabase = getSupabaseClient(req);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const mediaLimit = await checkMediaUsageLimit(supabase, user.id, "image", "mobile");
    if (!mediaLimit.allowed) {
      return mediaLimit.response!;
    }

    // Check AI quota (receipt uses 2 calls: Vision OCR + LLM)
    const quota = await checkAiQuota(supabase, user.id, 2);
    if (!quota.allowed) {
      return quota.response!;
    }

    // Get image from form data
    const formData = await req.formData();
    const imageFile = formData.get("image");
    if (!imageFile || !(imageFile instanceof File)) {
      return errorResponse("Se requiere una imagen del ticket");
    }

    // Step 1: Upload image to storage
    const imageBuffer = await imageFile.arrayBuffer();
    const imageName = `${user.id}/${Date.now()}_${imageFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(imageName, imageBuffer, {
        contentType: imageFile.type || "image/jpeg",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return errorResponse("Error al subir imagen");
    }

    // Step 2: OCR with Google Vision
    const imageBase64 = base64Encode(new Uint8Array(imageBuffer));
    const ocrText = await callVisionOCR(imageBase64);

    if (!ocrText || ocrText.trim().length === 0) {
      return errorResponse("No se pudo leer texto del ticket");
    }

    // Step 3: Heuristic extraction
    const heuristics = extractReceiptHeuristics(ocrText);

    // Step 4: LLM consolidation
    const now = new Date();
    const contextMessage = `Fecha actual: ${now.toISOString().split("T")[0]}\n\nTexto OCR del ticket:\n---\n${ocrText}\n---\n\nDatos extraídos por heurística:\n- Total: ${heuristics.totalGuess}\n- Fecha: ${heuristics.dateGuess}\n- Comercio: ${heuristics.vendorGuess}`;

    const llmResponse = await callLLM(PARSE_RECEIPT_PROMPT, contextMessage);
    const parsed: TransactionDraft = JSON.parse(llmResponse);

    // Step 5: Create receipt record
    const { data: receipt } = await supabase
      .from("receipts")
      .insert({
        user_id: user.id,
        image_path: imageName,
        ocr_text: ocrText.substring(0, 5000), // limit storage
        vendor_guess: heuristics.vendorGuess || parsed.merchant,
        total_guess: heuristics.totalGuess || parsed.amount,
        date_guess: heuristics.dateGuess,
        raw_ocr_json: { heuristics, ocrTextLength: ocrText.length },
      })
      .select()
      .single();

    // Increment AI usage (2 calls: Vision + LLM)
    await incrementAiUsage(supabase, user.id, quota.currentCount, 2);

    const accountId = formData.get("account_id");

    return jsonResponse({
      success: true,
      receipt_id: receipt?.id,
      draft: {
        ...parsed,
        account_id: accountId || null,
        receipt_id: receipt?.id,
      },
      heuristics,
      raw_payload: {
        source: "receipt",
        ocr_text_preview: ocrText.substring(0, 200),
        image_path: imageName,
        llm_response: llmResponse,
      },
    });
  } catch (error) {
    console.error("ingest-receipt error:", error);
    return errorResponse(`Error al procesar ticket: ${error.message}`, 500);
  }
});
