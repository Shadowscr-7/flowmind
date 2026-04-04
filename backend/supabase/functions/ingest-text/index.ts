import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getSupabaseClient,
  callLLM,
  checkAiQuota,
  incrementAiUsage,
  PARSE_TRANSACTION_PROMPT,
  jsonResponse,
  errorResponse,
  corsHeaders,
  type TransactionDraft,
} from "../_shared/utils.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabase = getSupabaseClient(req);

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    // Check AI quota
    const quota = await checkAiQuota(supabase, user.id, 1);
    if (!quota.allowed) {
      return quota.response!;
    }

    const { text, account_id } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return errorResponse("El texto no puede estar vacío");
    }

    // Get current date for context
    const now = new Date();
    const contextMessage = `Fecha actual: ${now.toISOString().split("T")[0]}\n\nTexto del usuario: "${text}"`;

    // Call LLM
    const llmResponse = await callLLM(PARSE_TRANSACTION_PROMPT, contextMessage);
    const parsed: TransactionDraft = JSON.parse(llmResponse);

    // Increment AI usage
    await incrementAiUsage(supabase, user.id, quota.currentCount, 1);

    return jsonResponse({
      success: true,
      draft: {
        ...parsed,
        account_id: account_id || null,
      },
      raw_payload: {
        source: "text",
        original_text: text,
        llm_response: llmResponse,
      },
    });
  } catch (error) {
    console.error("ingest-text error:", error);
    return errorResponse(`Error al procesar texto: ${error.message}`, 500);
  }
});
