-- ════════════════════════════════════════════════════
--  S41 Financial Clinic — Survey Leads Table
--  วิธีใช้: เปิด Supabase Dashboard → SQL Editor → วาง + Run
-- ════════════════════════════════════════════════════

create table if not exists survey_leads (
  id             uuid        default gen_random_uuid() primary key,
  created_at     timestamptz default now(),

  -- ── ข้อมูลติดต่อ ──────────────────────────────────
  name           text        not null,
  phone          text        not null,
  email          text,
  line_id        text,

  -- ── Referral (ทีมคนไหนส่ง link มา) ───────────────
  ref_agent      text        default 'direct',

  -- ── Intent (ผู้ใช้เลือกขั้นตอนถัดไปอะไร) ─────────
  -- view_only       = ไม่ส่งข้อมูล · ดูผล + แชร์เท่านั้น (จะไม่บันทึกในตารางนี้)
  -- self_planning   = ส่งข้อมูล + เปิด Dashboard ตอบ 5 ข้อต่อเอง (DIY)
  -- requested_call  = ส่งข้อมูล + นัดทีม S41 ปรึกษาเชิงลึก
  intent         text        default 'self_planning'
                  check (intent in ('view_only','self_planning','requested_call')),

  -- ── Archetype ─────────────────────────────────────
  archetype_key  text,
  archetype_name text,
  archetype_tag  text,

  -- ── คะแนน 5 มิติ ──────────────────────────────────
  score_emergency  int,
  score_protection int,
  score_cashflow   int,
  score_savings    int,
  score_planning   int,

  -- ── ข้อมูลการเงิน ─────────────────────────────────
  income_monthly   numeric,
  income_range     text,
  tax_bracket      text,
  surplus_monthly  numeric,
  surplus_annual   numeric,

  -- ── Context ───────────────────────────────────────
  life_values    text,
  pain_point     text,
  customer_want  text,

  -- ── ประกัน ────────────────────────────────────────
  insurance_health   text,
  insurance_life     text,
  insurance_overall  text,

  -- ── JSON เต็ม (สำหรับ prefill CFP Dashboard) ──────
  priorities   jsonb,
  cfp_intake   jsonb,

  -- ── Status (ทีม S41 update) ───────────────────────
  status         text    default 'new',   -- new / contacted / meeting_set / client
  assigned_agent text,
  notes          text,
  magic_link_sent boolean default false
);

-- ── Row Level Security ────────────────────────────────
alter table survey_leads enable row level security;

-- Service role (Edge Function) เข้าถึงได้ทั้งหมด
create policy "service_role_all" on survey_leads
  using (true) with check (true);

-- ── Index เพิ่มความเร็วค้นหา ──────────────────────────
create index if not exists idx_survey_leads_ref     on survey_leads(ref_agent);
create index if not exists idx_survey_leads_status  on survey_leads(status);
create index if not exists idx_survey_leads_created on survey_leads(created_at desc);
create index if not exists idx_survey_leads_intent  on survey_leads(intent);

-- ════════════════════════════════════════════════════
--  MIGRATION (สำหรับ table ที่มีอยู่แล้ว — ไม่ต้องลบของเดิม)
--  รัน statement ด้านล่างถ้า upgrade จากเวอร์ชันเก่า
-- ════════════════════════════════════════════════════
-- alter table survey_leads
--   add column if not exists intent text default 'self_planning'
--   check (intent in ('view_only','self_planning','requested_call'));
-- create index if not exists idx_survey_leads_intent on survey_leads(intent);

