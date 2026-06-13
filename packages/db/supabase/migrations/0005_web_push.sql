-- 0005_web_push.sql
-- Web Push subscriptions (browser PushSubscription endpoint + keys). Separate from
-- push_tokens (which is for native Expo tokens). Powers PWA notifications.

create table web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index web_push_subscriptions_parent_idx on web_push_subscriptions (parent_id);

alter table web_push_subscriptions enable row level security;
create policy wps_owner on web_push_subscriptions for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));
