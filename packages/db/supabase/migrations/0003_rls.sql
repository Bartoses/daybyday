-- 0003_rls.sql
-- Row-Level Security. Family-scoped tables are locked to the owner parent + active
-- caregivers; reference + content tables are world-readable (active only). (T1.2.2)

-- Helper: the set of parent ids the current auth user controls (self + caregiver-of).
create or replace function current_parent_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from parents where auth_user_id = auth.uid();
$$;

-- Helper: child ids visible to the current user (own children + active caregiver links).
create or replace function visible_child_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id
  from children c
  where c.parent_id in (select id from parents where auth_user_id = auth.uid())
  union
  select cg.child_id
  from caregivers cg
  join parents p on p.id = cg.parent_id
  where p.auth_user_id = auth.uid() and cg.status = 'active';
$$;

-- parents ----------------------------------------------------------------------
alter table parents enable row level security;
create policy parents_self_select on parents for select
  using (auth_user_id = auth.uid());
create policy parents_self_update on parents for update
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy parents_self_insert on parents for insert
  with check (auth_user_id = auth.uid());

-- children ---------------------------------------------------------------------
alter table children enable row level security;
create policy children_visible_select on children for select
  using (id in (select visible_child_ids()));
create policy children_owner_write on children for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));

-- caregivers -------------------------------------------------------------------
alter table caregivers enable row level security;
create policy caregivers_related_select on caregivers for select
  using (parent_id in (select current_parent_ids())
      or child_id in (select visible_child_ids()));
create policy caregivers_owner_write on caregivers for all
  using (child_id in (
    select id from children where parent_id in (select current_parent_ids())))
  with check (child_id in (
    select id from children where parent_id in (select current_parent_ids())));

-- per-parent rows: messages, milestones, questions, prefs, tokens, consents, subs
alter table messages enable row level security;
create policy messages_owner on messages for select
  using (parent_id in (select current_parent_ids()));

alter table milestones enable row level security;
create policy milestones_visible on milestones for all
  using (child_id in (select visible_child_ids()))
  with check (child_id in (select visible_child_ids()));

alter table questions enable row level security;
create policy questions_owner on questions for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));

alter table notification_prefs enable row level security;
create policy notif_owner on notification_prefs for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));

alter table push_tokens enable row level security;
create policy push_owner on push_tokens for all
  using (parent_id in (select current_parent_ids()))
  with check (parent_id in (select current_parent_ids()));

alter table consents enable row level security;
create policy consents_owner_select on consents for select
  using (parent_id in (select current_parent_ids()));

alter table subscriptions enable row level security;
create policy subs_owner_select on subscriptions for select
  using (parent_id in (select current_parent_ids()));

-- Reference + content: world-readable -----------------------------------------
alter table content_items enable row level security;
create policy content_public_read on content_items for select
  using (active = true);

alter table stages enable row level security;
create policy stages_public_read on stages for select using (true);

alter table categories enable row level security;
create policy categories_public_read on categories for select using (true);

alter table milestone_prompts enable row level security;
create policy milestone_prompts_public_read on milestone_prompts for select using (true);

-- NOTE: the Node API uses the service-role key for cron/SMS/assistant orchestration,
-- which bypasses RLS by design. All client traffic is RLS-constrained.
