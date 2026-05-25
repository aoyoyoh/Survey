// ════════════════════════════════════════════════════
//  S41 Financial Clinic — Survey Lead Edge Function
//  LINE Messaging API version (LINE Notify ปิดตัวแล้ว)
//
//  Supabase Secrets ที่ต้องตั้ง:
//    LINE_CHANNEL_TOKEN  — Channel Access Token จาก LINE Developers Console
//    LINE_USER_AOY       — LINE userId ของ Aoy (Uxxxxxxxxxx)
//    LINE_USER_AOR       — LINE userId ของ Aor
//    LINE_USER_OUM       — LINE userId ของ Oum
//    LINE_USER_KUNG      — LINE userId ของ Kung
//    LINE_USER_YOK       — LINE userId ของ Yok
//    LINE_USER_BELLE     — LINE userId ของ Belle
//    DASHBOARD_URL       — URL ของ CFP Dashboard
// ════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── LINE user IDs ของแต่ละคนในทีม ──────────────────────
// วิธีหา userId: แต่ละคน add @186dtxnp แล้วพิมพ์ "id"
// bot จะตอบกลับด้วย userId ของตัวเอง
const LINE_USER_IDS: Record<string, string | undefined> = {
  aoy:    Deno.env.get("LINE_USER_AOY"),
  aor:    Deno.env.get("LINE_USER_AOR"),
  oum:    Deno.env.get("LINE_USER_OUM"),
  kung:   Deno.env.get("LINE_USER_KUNG"),
  yok:    Deno.env.get("LINE_USER_YOK"),
  belle:  Deno.env.get("LINE_USER_BELLE"),
  direct: Deno.env.get("LINE_USER_AOY"), // default → Aoy
};

const LINE_CHANNEL_TOKEN = Deno.env.get("LINE_CHANNEL_TOKEN");

// ── ส่ง push message ผ่าน LINE Messaging API ───────────
async function sendLinePush(userId: string, text: string): Promise<void> {
  if (!LINE_CHANNEL_TOKEN) {
    console.warn("[S41] LINE_CHANNEL_TOKEN not set — skipping LINE push");
    return;
  }
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LINE_CHANNEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[S41] LINE push failed:", res.status, err);
  }
}

// ── Format LINE message ──────────────────────────────────
function formatLineMsg(lead: any, cfp: any, ref: string, intent: string): string {
  const r = cfp.scores || {};
  const icon = (s: number) => s >= 70 ? "✅" : s >= 40 ? "⚠️" : "❌";

  const intentLabel: Record<string, string> = {
    self_planning:  "🧭 DIY · ลูกค้าเปิด Dashboard เอง",
    requested_call: "💬 ขอปรึกษาทีม · ติดต่อกลับด่วน",
    view_only:      "✨ ดูผลอย่างเดียว",
  };
  const intentLine = intentLabel[intent] || intent;

  const priorities = (cfp.priorities || [])
    .slice(0, 3)
    .map((p: any, i: number) => `   ${i + 1}. ${p.dimension} (${p.score}/100)`)
    .join("\n");

  const lines = [
    `[S41] 🔔 Lead ใหม่! (ref: ${ref})`,
    `Intent: ${intentLine}`,
    ``,
    `👤 ${lead.name}`,
    `📱 ${lead.phone}`,
    lead.email    ? `📧 ${lead.email}` : null,
    lead.line     ? `💬 Line: ${lead.line}` : null,
    ``,
    `🎯 ${cfp.archetype?.name || "-"}  ${cfp.archetype?.tag || ""}`,
    ``,
    `💰 รายได้: ${cfp.income?.range || "-"} บาท/เดือน`,
    `   Surplus: ~${(cfp.surplus?.monthly || 0).toLocaleString()} บาท/เดือน`,
    `   ฐานภาษี: ${cfp.income?.taxBracket || "-"}`,
    ``,
    `📊 5 มิติ:`,
    `   ${icon(r.emergency || 0)} เงินสำรอง ${r.emergency ?? "-"}/100`,
    `   ${icon(r.protection || 0)} ความคุ้มครอง ${r.protection ?? "-"}/100`,
    `   ${icon(r.cashflow || 0)} กระแสเงินสด ${r.cashflow ?? "-"}/100`,
    `   ${icon(r.savings || 0)} การออม/ลงทุน ${r.savings ?? "-"}/100`,
    `   ${icon(r.planning || 0)} การวางแผน ${r.planning ?? "-"}/100`,
    ``,
    `🏆 Priority สูงสุด:`,
    priorities,
    ``,
    `🛡️ ประกัน: สุขภาพ ${cfp.insurance?.health || "-"} | ชีวิต ${cfp.insurance?.life || "-"}`,
    `❤️  ชีวิตที่ดีคือ: ${cfp.lifeValues || "-"}`,
    `💬 Pain Point: ${cfp.painPoint || "-"}`,
    `✨ ต้องการ: ${cfp.customerWants || "-"}`,
  ];

  return lines.filter(l => l !== null).join("\n");
}

// ── Main handler ─────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { lead, cfpIntake, ref, intent: intentFromBody } = body;

    if (!lead?.name || !lead?.phone) {
      throw new Error("ชื่อและเบอร์โทรจำเป็นต้องกรอก");
    }

    /* intent อาจอยู่ใน body หรือใน cfpIntake — รองรับทั้งสองรูปแบบ */
    const intent = (intentFromBody || cfpIntake?.intent || "self_planning") as
      "view_only" | "self_planning" | "requested_call";

    const agentKey = (ref || "direct").toLowerCase();

    // ── 1. Save to Supabase ───────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "https://lpqcglmpkuasgjgzqdyp.supabase.co",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY")!
    );

    const scores = cfpIntake.scores || {};

    const { data: savedLead, error: dbError } = await supabase
      .from("survey_leads")
      .insert({
        name:              lead.name,
        phone:             lead.phone,
        email:             lead.email || null,
        line_id:           lead.line || null,
        ref_agent:         agentKey,
        intent:            intent,
        archetype_key:     cfpIntake.archetype?.key,
        archetype_name:    cfpIntake.archetype?.name,
        archetype_tag:     cfpIntake.archetype?.tag,
        score_emergency:   scores.emergency,
        score_protection:  scores.protection,
        score_cashflow:    scores.cashflow,
        score_savings:     scores.savings,
        score_planning:    scores.planning,
        income_monthly:    cfpIntake.income?.monthly,
        income_range:      cfpIntake.income?.range,
        tax_bracket:       cfpIntake.income?.taxBracket,
        surplus_monthly:   cfpIntake.surplus?.monthly,
        surplus_annual:    cfpIntake.surplus?.annual,
        life_values:       cfpIntake.lifeValues,
        pain_point:        cfpIntake.painPoint,
        customer_want:     cfpIntake.customerWants,
        insurance_health:  cfpIntake.insurance?.health,
        insurance_life:    cfpIntake.insurance?.life,
        insurance_overall: cfpIntake.insurance?.overall,
        priorities:        cfpIntake.priorities,
        cfp_intake:        cfpIntake,
        status:            "new",
        assigned_agent:    agentKey,
      })
      .select()
      .single();

    if (dbError) throw new Error(`DB error: ${dbError.message}`);

    // ── 2. LINE push message → agent ──────────────────────
    const userId = LINE_USER_IDS[agentKey] || LINE_USER_IDS["direct"];
    if (userId) {
      const msg = formatLineMsg(lead, cfpIntake, agentKey, intent);
      await sendLinePush(userId, msg);
    } else {
      console.warn(`[S41] No LINE userId for agent "${agentKey}" — lead saved but no LINE notification sent`);
    }

    // ── 3. Magic Link email (ถ้ามี email) ─────────────────
    if (lead.email) {
      const dashboardUrl = Deno.env.get("DASHBOARD_URL") || "https://YOUR-DASHBOARD.com";
      try {
        await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: lead.email,
          options: {
            redirectTo: `${dashboardUrl}/p1?lead_id=${savedLead.id}`,
          },
        });
      } catch (emailErr) {
        console.warn("[S41] Magic link email failed:", emailErr);
        // non-blocking — don't fail the whole request
      }
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: savedLead.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[S41 Edge Function Error]", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
