// ════════════════════════════════════════════════════
//  S41 Financial Clinic — Get Lead by ID
//
//  GET /functions/v1/get-lead?id=UUID
//  → returns the cfp_intake JSON snapshot for prefilling the
//    Premium Dashboard. Used in Phase 2 (Supabase fetch instead
//    of URL base64).
//
//  Security: leadId is a UUID (128-bit random) — hard to guess.
//  For MVP, no extra auth. Can be tightened later with magic-link tokens.
// ════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id || !UUID_RE.test(id)) {
      return json({ error: "Invalid or missing leadId" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "https://lpqcglmpkuasgjgzqdyp.supabase.co",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY")!
    );

    const { data, error } = await supabase
      .from("survey_leads")
      .select("id, name, phone, email, line_id, intent, archetype_key, archetype_name, archetype_tag, score_emergency, score_protection, score_cashflow, score_savings, score_planning, income_monthly, income_range, tax_bracket, surplus_monthly, surplus_annual, life_values, pain_point, customer_want, insurance_health, insurance_life, insurance_overall, priorities, cfp_intake, created_at")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return json({ error: "Lead not found" }, 404);
      }
      throw error;
    }

    /* Build prefill payload — same shape as old URL base64 + extra fields */
    const prefill = {
      v: "2",
      leadId: data.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      lineId: data.line_id,
      income: Number(data.income_monthly) || 0,
      archetype: {
        key: data.archetype_key,
        name: data.archetype_name,
        tag: data.archetype_tag,
      },
      scores: {
        emergency: data.score_emergency,
        protection: data.score_protection,
        cashflow: data.score_cashflow,
        savings: data.score_savings,
        planning: data.score_planning,
      },
      painPoint: data.pain_point,
      customerWants: data.customer_want,
      lifeValues: data.life_values,
      insurance: {
        health: data.insurance_health,
        life: data.insurance_life,
        overall: data.insurance_overall,
      },
      intent: data.intent,
      surveyVersion: data.cfp_intake?.surveyVersion || "4.1",
      completedAt: data.created_at,
      /* full cfpIntake snapshot (for advanced use in Dashboard) */
      cfpIntake: data.cfp_intake,
    };

    return json(prefill, 200);

  } catch (err: any) {
    console.error("[get-lead]", err);
    return json({ error: err.message || "Server error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
