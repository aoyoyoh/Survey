// ════════════════════════════════════════════════════
//  S41 Financial Clinic — LINE Webhook Edge Function
//
//  วิธีใช้: ตั้ง Webhook URL ใน LINE OA Manager → Settings → Messaging API
//  URL: https://lpqcglmpkuasgjgzqdyp.supabase.co/functions/v1/line-webhook
//
//  เมื่อสมาชิกทีม add @186dtxnp แล้วพิมพ์ข้อความอะไรก็ได้ →
//  bot ตอบกลับด้วย userId ของคนนั้น → ส่ง userId ให้ Aoy ใส่ใน Secrets
// ════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LINE_CHANNEL_TOKEN = Deno.env.get("LINE_CHANNEL_TOKEN");

async function replyMessage(replyToken: string, text: string): Promise<void> {
  if (!LINE_CHANNEL_TOKEN) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LINE_CHANNEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

serve(async (req) => {
  // LINE ส่ง GET มา verify webhook — ตอบ 200 เสมอ
  if (req.method === "GET") {
    return new Response("OK", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const events = body.events || [];

    for (const event of events) {
      // รับเฉพาะ message events จาก user
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const userId    = event.source?.userId || "ไม่พบ";
      const replyToken = event.replyToken;
      const text      = (event.message?.text || "").trim().toLowerCase();

      // ตอบกลับด้วย userId เสมอ (ไม่ว่าจะพิมพ์อะไร)
      const reply =
        `🆔 LINE User ID ของคุณ:\n` +
        `${userId}\n\n` +
        `📋 copy ข้อความด้านบนส่งให้ Aoy เพื่อใส่ใน Supabase Secrets นะคะ\n\n` +
        `ขั้นตอน:\n` +
        `Aoy → Supabase Dashboard\n` +
        `→ Edge Functions → survey-lead\n` +
        `→ Manage secrets\n` +
        `→ เพิ่ม LINE_USER_[ชื่อคุณ] = ${userId}`;

      await replyMessage(replyToken, reply);

      console.log(`[S41 Webhook] userId captured: ${userId}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[S41 Webhook Error]", err);
    // LINE ต้องการ 200 เสมอ ไม่งั้นจะ retry
    return new Response("OK", { status: 200 });
  }
});
