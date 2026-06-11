-- 0001_core_schema.sql
-- DaybyDay Phase-1 core tables. Mirrors docs/07-DATABASE-DESIGN.md.
-- All family-scoped tables get RLS in 0003_rls.sql.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- Reusable updated_at trigger ---------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- parents ----------------------------------------------------------------------
create table parents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text,
  phone text,
  normalized_phone text unique,
  email text,
  timezone text not null default 'America/Denver',
  onboarding_step text not null default 'NEW'
    check (onboarding_step in ('NEW','WAITING_ONBOARDING_CHOICE','WAITING_NAME',
      'WAITING_CHILD_NAME','WAITING_CHILD_BIRTHDATE','ASK_ADD_CHILD','ONBOARDED')),
  focus_area text,
  status text not null default 'active' check (status in ('active','unsubscribed')),
  sms_opt_in boolean not null default false,
  preferred_send_hour int default 8 check (preferred_send_hour between 0 and 23),
  referral_code text unique,
  referred_by uuid references parents(id),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index parents_normalized_phone_idx on parents (normalized_phone);
create trigger parents_set_updated_at before update on parents
  for each row execute function set_updated_at();

-- children ---------------------------------------------------------------------
create table children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  name text not null,
  birthdate date,
  due_date date,
  gender text,
  photo_url text,
  status text not null default 'active',
  enrollment_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_has_date check (birthdate is not null or due_date is not null)
);
create index children_parent_id_idx on children (parent_id);
create trigger children_set_updated_at before update on children
  for each row execute function set_updated_at();

-- caregivers (multi-caregiver / Family plan) -----------------------------------
create table caregivers (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('owner','caregiver','viewer')),
  invited_email text,
  invited_phone text,
  status text not null default 'active' check (status in ('invited','active','revoked')),
  created_at timestamptz not null default now(),
  unique (child_id, parent_id)
);
create index caregivers_parent_id_idx on caregivers (parent_id);
create index caregivers_child_id_idx on caregivers (child_id);

-- content_items (the cleaned Knowledge sheet) ----------------------------------
create table content_items (
  id uuid primary key default gen_random_uuid(),
  tip_id text unique not null,
  category text not null check (category in
    ('sleep','feeding','development','learning_play','emotional','behavior','safety')),
  subcategory text,
  age_min_days int not null,
  age_max_days int not null,
  stage text,
  developmental_leap_phase text,
  insight text not null,
  action_tip text not null,
  reassurance text not null,
  sms_tip text,
  follow_up_prompt text,
  common_misunderstanding text,
  signs_of_healthy_development text,
  when_to_consult_doctor text,
  development_focus text,
  keywords text[] not null default '{}',
  difficulty_level text not null default 'easy' check (difficulty_level in ('easy','medium','hard')),
  rotation_group text,
  priority_weight numeric not null default 1,
  cooldown_days int not null default 21,
  message_type text not null default 'daily',
  milestone_key text,
  checkin_question text,
  reply_options text,
  youtube_resource_title text,
  youtube_resource_link text,
  book_resource text,
  research_reference text,
  evidence_level text,
  content_tone text,
  language text not null default 'en',
  localization_region text,
  active boolean not null default true,
  last_review_date date,
  reviewer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_age_order check (age_min_days <= age_max_days)
);
create index content_items_lookup_idx on content_items (active, category, age_min_days, age_max_days);
create index content_items_keywords_idx on content_items using gin (keywords);
create trigger content_items_set_updated_at before update on content_items
  for each row execute function set_updated_at();

-- messages (delivery + selection audit; powers cooldown/novelty/rotation) -------
create table messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  tip_id text,
  category_family text,
  message_type text not null,
  request_type text,
  channel text not null default 'push' check (channel in ('push','sms','email','in_app')),
  insight_rendered text,
  action_rendered text,
  reassurance_rendered text,
  message_text text,
  send_status text not null default 'pending' check (send_status in ('pending','sent','failed')),
  send_date date not null,
  sent_at timestamptz,
  twilio_sid text,
  error text,
  created_at timestamptz not null default now()
);
-- Idempotent daily send (replaces wasDailyMessageSentToday).
create unique index messages_daily_unique_idx
  on messages (parent_id, child_id, send_date)
  where message_type = 'daily';
create index messages_child_recent_idx on messages (child_id, created_at desc);

-- milestones -------------------------------------------------------------------
create table milestones (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  milestone_key text not null,
  label text,
  achieved_on date,
  note text,
  photo_url text,
  created_at timestamptz not null default now(),
  unique (child_id, milestone_key)
);

-- questions (free-text queue; pre-assistant + assistant fallback) ---------------
create table questions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  question text not null,
  status text not null default 'new' check (status in ('new','answered','archived')),
  answer_content_id uuid references content_items(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger questions_set_updated_at before update on questions
  for each row execute function set_updated_at();

-- notification_prefs -----------------------------------------------------------
create table notification_prefs (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade unique,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  email_enabled boolean not null default true,
  quiet_hours_start int check (quiet_hours_start between 0 and 23),
  quiet_hours_end int check (quiet_hours_end between 0 and 23),
  per_child jsonb not null default '{}'::jsonb
);

-- push_tokens ------------------------------------------------------------------
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  expo_token text not null unique,
  platform text check (platform in ('ios','android','web')),
  created_at timestamptz not null default now()
);

-- consents (TCPA + audit; preserves opt-in provenance) -------------------------
create table consents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  channel text not null check (channel in ('sms','email','push')),
  consent_text text,
  source text,
  method text,
  granted boolean not null,
  occurred_at timestamptz not null default now(),
  ip text,
  raw jsonb
);
create index consents_parent_idx on consents (parent_id);

-- subscriptions (billing) ------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium','family')),
  period text check (period in ('monthly','annual')),
  status text not null default 'active'
    check (status in ('active','trialing','past_due','canceled')),
  provider text check (provider in ('revenuecat','stripe')),
  provider_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_parent_idx on subscriptions (parent_id);
create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();
