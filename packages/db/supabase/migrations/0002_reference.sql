-- 0002_reference.sql
-- Reference/enum tables seeded from the legacy APP_CONFIG (Config.js).
-- These are world-readable; the engine and app read them. (T1.2.3)

create table stages (
  key text primary key,
  label text not null,
  min_age_days int not null,
  max_age_days int not null,
  sort_order int not null
);

create table categories (
  key text primary key,
  label text not null,
  is_family_category boolean not null default true,
  sort_order int not null
);

create table milestone_prompts (
  key text primary key,
  label text not null,
  prompt text not null,
  min_age_days int not null,
  max_age_days int not null,
  topic text not null,
  not_yet_tip text not null,
  sort_order int not null
);
