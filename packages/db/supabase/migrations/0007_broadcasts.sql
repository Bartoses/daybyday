-- 0007_broadcasts.sql
-- Admin-scheduled push broadcasts (custom messages). Only the service-role admin
-- API writes/reads these (RLS on, no client policies = locked to service role).

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text,
  audience text not null default 'all',
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'canceled')),
  created_by uuid references parents(id) on delete set null,
  sent_at timestamptz,
  sent_count int,
  created_at timestamptz not null default now()
);
create index broadcasts_due_idx on broadcasts (status, scheduled_for);

alter table broadcasts enable row level security;
