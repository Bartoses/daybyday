-- 0008_day_chat.sql
-- Conversation history for the "Day" AI assistant. Stores both sides of each
-- exchange so the chat survives reload and so the server can count a parent's
-- assistant replies per day for the free-tier limit. Family-scoped via RLS;
-- the Node API uses the service-role key and scopes by parent_id explicitly.

create table day_chat_messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  child_id uuid references children(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- History reads (most-recent-first) and the daily assistant-message count both
-- filter by parent_id and order/range on created_at.
create index day_chat_messages_parent_created_idx
  on day_chat_messages (parent_id, created_at desc);

alter table day_chat_messages enable row level security;
create policy day_chat_owner on day_chat_messages for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));
