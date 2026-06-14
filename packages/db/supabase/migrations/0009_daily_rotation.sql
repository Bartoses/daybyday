-- 0009_daily_rotation.sql
-- Marks which content_items belong to the curated daily-tip pool. The daily-tip
-- rotation (stage-relative cooldown + least-seen-first) draws ONLY from rows with
-- daily_eligible = true, so the curated set is the pool without deleting the
-- legacy library (those rows stay, just dormant: daily_eligible defaults false).

alter table content_items
  add column if not exists daily_eligible boolean not null default false;

-- The rotation loads the active daily pool and filters by stage in memory.
create index if not exists content_items_daily_pool_idx
  on content_items (stage)
  where active and daily_eligible;
