-- 0006_notify_prefs.sql
-- Per-parent daily reminder controls: when (send_hour), whether (daily_enabled),
-- and what topics (categories). Read by the daily-push cron.

alter table notification_prefs
  add column if not exists daily_enabled boolean not null default true,
  add column if not exists send_hour int not null default 8 check (send_hour between 0 and 23),
  add column if not exists categories text[] not null default '{}';
