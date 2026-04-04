import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getSupabaseClient,
  callLLM,
  callWhisper,
  checkAiQuota,
  incrementAiUsage,
  PARSE_TRANSACTION_PROMPT,
  jsonResponse,
  errorResponse,
  corsHeaders,
  type TransactionDraft,
} from "../_shared/utils.ts";

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

    // Check AI quota (voice uses 2 calls: Whisper + LLM)
    const quota = await checkAiQuota(supabase, user.id, 2);
    if (!quota.allowed) {
      return quota.response!;
    }

    // Get audio from form data
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof File)) {
      return errorResponse("Se requiere un archivo de audio");
    }

    // Step 1: Whisper STT
    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type || "audio/m4a",
    });
    const transcript = await callWhisper(audioBlob);

    if (!transcript || transcript.trim().length === 0) {
      return errorResponse("No se pudo transcribir el audio");
    }

    // Step 2: LLM parse
    const now = new Date();
    const contextMessage = `Fecha actual: ${now.toISOString().split("T")[0]}\n\nTexto transcrito de audio del usuario: "${transcript}"`;
    const llmResponse = await callLLM(PARSE_TRANSACTION_PROMPT, contextMessage);
    const parsed: TransactionDraft = JSON.parse(llmResponse);

    // Increment AI usage (2 calls: whisper + LLM)
    await incrementAiUsage(supabase, user.id, quota.currentCount, 2);

    const accountId = formData.get("account_id");

    return jsonResponse({
      success: true,
      transcript,
      draft: {
        ...parsed,
        account_id: accountId || null,
      },
      raw_payload: {
        source: "voice",
        transcript,
        llm_response: llmResponse,
      },
    });
  } catch (error) {
    console.error("ingest-voice error:", error);
    return errorResponse(`Error al procesar audio: ${error.message}`, 500);
  }
});
