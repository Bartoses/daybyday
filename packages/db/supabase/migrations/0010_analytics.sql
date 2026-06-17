-- 0010_analytics.sql
-- Lightweight product-analytics events — feature opens and actions the existing
-- tables don't already capture (e.g. screen views, funnel steps). Powers the
-- admin usage dashboard. One row per tracked interaction.

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_created_idx on analytics_events (created_at desc);
create index analytics_events_name_created_idx on analytics_events (name, created_at desc);

alter table analytics_events enable row level security;
create policy analytics_owner on analytics_events for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));
