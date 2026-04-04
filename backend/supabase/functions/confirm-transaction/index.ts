import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  getSupabaseClient,
  jsonResponse,
  errorResponse,
  corsHeaders,
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

    const body = await req.json();
    const {
      type,
      amount,
      currency,
      date,
      merchant,
      category_id,
      account_id,
      notes,
      source,
      confidence,
      raw_payload,
      receipt_id,
      is_recurring,
      recurring_frequency,
      recurring_day,
      recurring_end_date,
      transfer_to_account_id,
    } = body;

    // Validate required fields
    if (!type || !amount || !account_id) {
      return errorResponse("Faltan campos obligatorios: type, amount, account_id");
    }

    if (!["expense", "income", "transfer"].includes(type)) {
      return errorResponse("Tipo inválido. Debe ser: expense, income, transfer");
    }

    if (typeof amount !== "number" || amount <= 0) {
      return errorResponse("El monto debe ser un número positivo");
    }

    // Verify account belongs to user
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, user_id")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return errorResponse("Cuenta no encontrada o no pertenece al usuario");
    }

    // Insert transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id,
        type,
        amount,
        currency: currency || "UYU",
        date: date || new Date().toISOString(),
        merchant: merchant || null,
        category_id: category_id || null,
        notes: notes || null,
        source: source || "manual",
        confidence: confidence || 1.0,
        raw_payload_json: raw_payload || null,
        is_confirmed: true,
        is_recurring: is_recurring || false,
        recurring_frequency: is_recurring ? (recurring_frequency || "monthly") : null,
        recurring_day: is_recurring ? (recurring_day || null) : null,
        recurring_end_date: is_recurring ? (recurring_end_date || null) : null,
        ...(transfer_to_account_id ? { transfer_to_account_id } : {}),
      })
      .select()
      .single();

    if (txError) {
      console.error("Transaction insert error:", txError);
      return errorResponse("Error al guardar la transacción");
    }

    // Create recurring rule if transaction is recurring
    if (is_recurring && transaction) {
      const freq = recurring_frequency || "monthly";
      const txDate = new Date(date || new Date().toISOString());
      let nextOccurrence: Date;

      switch (freq) {
        case "daily":
          nextOccurrence = new Date(txDate);
          nextOccurrence.setDate(nextOccurrence.getDate() + 1);
          break;
        case "weekly":
          nextOccurrence = new Date(txDate);
          nextOccurrence.setDate(nextOccurrence.getDate() + 7);
          break;
        case "yearly":
          nextOccurrence = new Date(txDate);
          nextOccurrence.setFullYear(nextOccurrence.getFullYear() + 1);
          break;
        case "monthly":
        default:
          nextOccurrence = new Date(txDate);
          nextOccurrence.setMonth(nextOccurrence.getMonth() + 1);
          break;
      }

      const { error: ruleError } = await supabase
        .from("recurring_rules")
        .insert({
          user_id: user.id,
          source_transaction_id: transaction.id,
          account_id,
          category_id: category_id || null,
          type,
          amount,
          currency: currency || "UYU",
          merchant: merchant || null,
          notes: notes || null,
          frequency: freq,
          day_of_period: recurring_day || txDate.getDate(),
          next_occurrence: nextOccurrence.toISOString().split("T")[0],
          end_date: recurring_end_date || null,
          transfer_to_account_id: transfer_to_account_id || null,
        });

      if (ruleError) {
        console.error("Recurring rule insert error:", ruleError);
        // Non-blocking — transaction was already created successfully
      }
    }

    // Link receipt if exists
    if (receipt_id) {
      await supabase
        .from("receipts")
        .update({ transaction_id: transaction.id })
        .eq("id", receipt_id)
        .eq("user_id", user.id);
    }

    return jsonResponse({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("confirm-transaction error:", error);
    return errorResponse(`Error: ${error.message}`, 500);
  }
});
