-- 0004_feedback.sql
-- Per-tip helpful / not-helpful signal (T4.2.3). Feeds later recommendation reranking.

create table tip_feedback (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  tip_id text not null,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  unique (parent_id, child_id, tip_id)
);
create index tip_feedback_parent_idx on tip_feedback (parent_id);

alter table tip_feedback enable row level security;
create policy tip_feedback_owner on tip_feedback for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));
