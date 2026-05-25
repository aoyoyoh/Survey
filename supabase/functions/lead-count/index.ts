// ════════════════════════════════════════════════════
//  S41 Financial Clinic — Public Lead Count Endpoint
//  Returns total number of survey leads (for "social proof"
//  counter on Welcome screen). Counts only — never returns
//  any personal data.
//
//  Deploy:  supabase functions deploy lead-count
// ════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "https://lpqcglmpkuasgjgzqdyp.supabase.co",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY")!
    );

    /* head=true returns no rows — only the count header */
    const { count, error } = await supabase
      .from("survey_leads")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return new Response(
      JSON.stringify({ count: count ?? 0 }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // cache 5 min
        },
      }
    );

  } catch (err: any) {
    console.error("[lead-count]", err);
    return new Response(
      JSON.stringify({ count: null, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
