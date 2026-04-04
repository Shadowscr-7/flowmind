import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";

/**
 * recurring-run — Cron Edge Function
 *
 * Runs on a schedule (daily at 6 AM) to:
 * 1. Find all active recurring_rules where next_occurrence <= today
 * 2. Create the corresponding transaction for each rule
 * 3. Advance the next_occurrence date
 * 4. Deactivate rules past their end_date
 * 5. Send push notification for each generated transaction
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  // Guard: only allow cron (service_role) invocations
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }

  try {
    // Use service role to bypass RLS (this is a server-side cron job)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Find all active rules due today or overdue
    const { data: rules, error: fetchError } = await supabase
      .from("recurring_rules")
      .select("*")
      .eq("is_active", true)
      .lte("next_occurrence", today);

    if (fetchError) {
      console.error("Error fetching recurring rules:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recurring transactions due", processed: 0 }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    let errors = 0;

    for (const rule of rules) {
      try {
        // Check if past end_date → deactivate
        if (rule.end_date && rule.end_date < today) {
          await supabase
            .from("recurring_rules")
            .update({ is_active: false })
            .eq("id", rule.id);
          continue;
        }

        // Create the transaction
        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: rule.user_id,
            account_id: rule.account_id,
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            date: rule.next_occurrence,
            merchant: rule.merchant,
            category_id: rule.category_id,
            notes: rule.notes ? `${rule.notes} (recurrente)` : "Transacción recurrente",
            source: "recurring",
            confidence: 1.0,
            is_confirmed: true,
            is_recurring: true,
            recurring_frequency: rule.frequency,
            transfer_to_account_id: rule.transfer_to_account_id,
          });

        if (txError) {
          console.error(`Error creating transaction for rule ${rule.id}:`, txError);
          errors++;
          continue;
        }

        // Calculate next occurrence
        const current = new Date(rule.next_occurrence);
        let next: Date;

        switch (rule.frequency) {
          case "daily":
            next = new Date(current);
            next.setDate(next.getDate() + 1);
            break;
          case "weekly":
            next = new Date(current);
            next.setDate(next.getDate() + 7);
            break;
          case "yearly":
            next = new Date(current);
            next.setFullYear(next.getFullYear() + 1);
            break;
          case "monthly":
          default:
            next = new Date(current);
            next.setMonth(next.getMonth() + 1);
            // Handle month overflow (e.g., Jan 31 → Feb 28)
            if (rule.day_of_period) {
              const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
              next.setDate(Math.min(rule.day_of_period, maxDay));
            }
            break;
        }

        const nextStr = next.toISOString().split("T")[0];

        // Check if next occurrence is past end_date → deactivate after this one
        const shouldDeactivate = rule.end_date && nextStr > rule.end_date;

        await supabase
          .from("recurring_rules")
          .update({
            next_occurrence: nextStr,
            is_active: !shouldDeactivate,
          })
          .eq("id", rule.id);

        // Send push notification
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("fcm_token")
            .eq("id", rule.user_id)
            .single();

          if (profile?.fcm_token) {
            // Create in-app notification
            await supabase.from("notifications").insert({
              user_id: rule.user_id,
              type: "recurring",
              title: "Transacción recurrente registrada",
              body: `Se registró ${rule.type === "income" ? "ingreso" : "gasto"} recurrente: ${rule.merchant || ""} $${rule.amount}`,
              data: { rule_id: rule.id, amount: rule.amount, type: rule.type },
            });
          }
        } catch (_pushErr) {
          // Non-blocking — transaction was created successfully
        }

        processed++;
      } catch (ruleErr) {
        console.error(`Error processing rule ${rule.id}:`, ruleErr);
        errors++;
      }
    }

    console.log(`Recurring run complete: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ processed, errors, total: rules.length }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("recurring-run error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  }
});
