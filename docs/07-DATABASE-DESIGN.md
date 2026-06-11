# 07 — Database Design (Supabase / Postgres)

Target: a clean, typed, indexed Postgres schema that (a) preserves every concept in the
Sheets model, (b) collapses the 190-column Knowledge sheet into one typed `content_items`
table, and (c) enables RLS so families only see their own data.

Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` timestamps, `created_at` /
`updated_at` everywhere, soft-delete via `deleted_at` where useful, `snake_case`.

---

## 1. Entity-relationship overview
```
auth.users (Supabase)
   │ 1:1
parents ──1:N── children ──1:N── milestones
   │              │
   │              └──1:N── messages (delivery + selection log)
   │
   ├──1:N── caregivers (M:N parents↔children via roles)
   ├──1:N── questions
   ├──1:N── saved_items ──N:1── content_items
   ├──1:N── collections ──1:N── collection_items
   ├──1:N── notification_prefs
   ├──1:N── consents (TCPA/audit)
   ├──1:N── subscriptions (billing)
   └──1:N── family_memory (AI, Phase 3)

content_items ──1:N── content_embeddings (pgvector, Phase 3)
assistant_threads ──1:N── assistant_messages (Phase 3)
```

---

## 2. Core tables

### `parents`
```sql
create table parents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  name text,
  phone text,                       -- E.164
  normalized_phone text unique,
  email text,
  timezone text not null default 'America/Denver',
  onboarding_step text not null default 'NEW',   -- FSM, see §6
  focus_area text,                  -- daily_guidance | sleep_support | big_feelings
  status text not null default 'active',          -- active | unsubscribed
  sms_opt_in boolean not null default false,
  preferred_send_hour int default 8,
  referral_code text unique,
  referred_by uuid references parents(id),
  preferences jsonb not null default '{}'::jsonb, -- last_daily_child_id, last_*_category, pending_* slots
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on parents (normalized_phone);
```
*Migration note:* the Sheet's `preferences` JSON blob (pending-state slots, rotation memory)
maps directly to `preferences jsonb`. Opt-in provenance → `consents` (below), not inline columns.

### `children`
```sql
create table children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  name text not null,
  birthdate date,                   -- null while pregnancy (use due_date)
  due_date date,                    -- pregnancy-aware
  gender text,                      -- optional
  photo_url text,
  status text not null default 'active',
  enrollment_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (birthdate is not null or due_date is not null)
);
create index on children (parent_id);
```
Age-in-days is **derived** (`current_date - birthdate`) in a view/function, not stored —
fixes the Sheet's stale calculated columns.

### `caregivers` (multi-caregiver, Family plan)
```sql
create table caregivers (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  parent_id uuid not null references parents(id) on delete cascade,  -- the caregiver account
  role text not null default 'caregiver',     -- owner | caregiver | viewer
  invited_email text,
  invited_phone text,
  status text not null default 'active',       -- invited | active | revoked
  created_at timestamptz not null default now(),
  unique (child_id, parent_id)
);
```

### `content_items` (the cleaned Knowledge sheet)
```sql
create table content_items (
  id uuid primary key default gen_random_uuid(),
  tip_id text unique not null,                 -- preserve existing stable ids
  category text not null,                      -- canonical: sleep|feeding|development|learning_play|emotional|behavior|safety
  subcategory text,
  age_min_days int not null,
  age_max_days int not null,
  stage text,                                  -- newborn..early_school_age (derivable)
  developmental_leap_phase text,
  insight text not null,                       -- was insight_explanation/insight/summary
  action_tip text not null,                    -- was action_tip/action/tip
  reassurance text not null,                   -- was parent_reassurance/encouragement/reassurance
  sms_tip text,
  follow_up_prompt text,
  common_misunderstanding text,
  signs_of_healthy_development text,
  when_to_consult_doctor text,
  development_focus text,
  keywords text[],
  difficulty_level text not null default 'easy',   -- easy|medium|hard
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
  check (age_min_days <= age_max_days)
);
create index on content_items (active, category, age_min_days, age_max_days);
create index on content_items using gin (keywords);
```
*Migration:* a one-time importer reads the Knowledge sheet, applies the same candidate-name
fallback (`knowledge.js normalizeKnowledgeRow_`) and `canonicalizeTopic_` mapping, dedupes,
and inserts typed rows. `__unused__*` columns dropped. **This is the single most valuable
migration; verify row counts + spot-check content parity.**

### `messages` (delivery + selection audit — powers cooldown/novelty/rotation)
```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  tip_id text,                                 -- references content_items.tip_id (loose)
  category_family text,
  message_type text not null,                  -- daily | followup | checkin | milestone | onboarding | share | system
  request_type text,                           -- another_tip | sleep | play | feeding | behavior | daily
  channel text not null default 'push',        -- push | sms | email | in_app
  insight_rendered text,
  action_rendered text,
  reassurance_rendered text,
  message_text text,
  send_status text not null default 'pending', -- pending | sent | failed
  send_date date not null,                     -- local day key (timezone-aware)
  sent_at timestamptz,
  twilio_sid text,
  error text,
  created_at timestamptz not null default now()
);
create unique index on messages (parent_id, child_id, send_date, message_type)
  where message_type = 'daily';                -- idempotent daily send (was wasDailyMessageSentToday)
create index on messages (child_id, created_at desc);   -- recent history for cooldown
```

### `milestones`
```sql
create table milestones (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  milestone_key text not null,                 -- first_smile, first_roll, ...
  label text,
  achieved_on date,
  note text,
  photo_url text,
  created_at timestamptz not null default now(),
  unique (child_id, milestone_key)
);
```

### `questions` (free-text queue; pre-assistant + assistant fallback)
```sql
create table questions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  question text not null,
  status text not null default 'new',          -- new | answered | archived
  answer_content_id uuid references content_items(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 3. Engagement / product tables

### `saved_items`, `collections`, `collection_items`
```sql
create table saved_items (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  content_id uuid references content_items(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (parent_id, content_id)
);
create table collections (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table collection_items (
  collection_id uuid not null references collections(id) on delete cascade,
  content_id uuid not null references content_items(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, content_id)
);
```

### `notification_prefs`
```sql
create table notification_prefs (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  email_enabled boolean not null default true,
  quiet_hours_start int,                       -- 0-23 local
  quiet_hours_end int,
  per_child jsonb not null default '{}'::jsonb,
  unique (parent_id)
);
```

### `consents` (TCPA + audit — preserve opt-in provenance)
```sql
create table consents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  channel text not null,                       -- sms | email | push
  consent_text text,
  source text,                                 -- sms_start | web_signup | google_form
  method text,
  granted boolean not null,
  occurred_at timestamptz not null default now(),
  ip text,
  raw jsonb
);
```

### `subscriptions` (billing)
```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  plan text not null default 'free',           -- free | premium | family
  period text,                                 -- monthly | annual
  status text not null default 'active',       -- active | trialing | past_due | canceled
  provider text,                               -- revenuecat | stripe
  provider_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `push_tokens`
```sql
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  expo_token text not null,
  platform text,                               -- ios | android | web
  created_at timestamptz not null default now(),
  unique (expo_token)
);
```

---

## 4. AI tables (Phase 3)

### `content_embeddings` (pgvector)
```sql
create extension if not exists vector;
create table content_embeddings (
  content_id uuid primary key references content_items(id) on delete cascade,
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index on content_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

### `assistant_threads` / `assistant_messages`
```sql
create table assistant_threads (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  created_at timestamptz not null default now()
);
create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references assistant_threads(id) on delete cascade,
  role text not null,                          -- user | assistant
  content text not null,
  citations jsonb,                             -- content_ids used
  safety_flag text,                            -- null | escalated | blocked
  created_at timestamptz not null default now()
);
```

### `family_memory`
```sql
create table family_memory (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  kind text not null,                          -- preference | concern | context | medical_sensitive
  key text,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 5. Row-Level Security (sketch)
Enable RLS on all family-scoped tables. Pattern:
```sql
alter table children enable row level security;
create policy children_self on children
  using (parent_id in (select id from parents where auth_user_id = auth.uid())
      or id in (select child_id from caregivers c
                join parents p on p.id = c.parent_id
                where p.auth_user_id = auth.uid() and c.status = 'active'));
```
`content_items` / `content_embeddings` are world-readable (active only); everything
parent/child-scoped is locked to the owner + active caregivers. The Node API uses the service
role for cron/SMS/assistant orchestration.

## 6. State enums (port from `APP_CONFIG`)
- `parents.onboarding_step`: `NEW → WAITING_ONBOARDING_CHOICE → WAITING_NAME →
  WAITING_CHILD_NAME → WAITING_CHILD_BIRTHDATE → ASK_ADD_CHILD → ONBOARDED`.
- `parents.status`: `active | unsubscribed`.
- categories (canonical): `sleep, feeding, development, learning_play, emotional, behavior, safety`.
- stages: `newborn, early_baby, growing_baby, exploring_baby, new_toddler, curious_toddler,
  preschooler, early_school_age` (day ranges from `APP_CONFIG.stages`).

## 7. Migration plan (Sheets → Postgres)
1. **content_items** — importer with candidate-name fallback + canonicalization + dedupe. Verify counts.
2. parents / children / messages / milestones / questions — only if any real rows exist
   (currently **0 users**, so this is a no-op; the importer is built and tested but runs empty).
3. consents — synthesize from opt-in provenance columns if/when users exist.
4. Validation: row-count parity for content; spot-check 20 random tips render identically
   through the ported engine vs. the old Apps Script output.
