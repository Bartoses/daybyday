-- seed.sql — reference data ported verbatim from Config.js APP_CONFIG. (T1.2.3)
-- Applied by `supabase db reset`. Idempotent via upserts.

-- Stages (APP_CONFIG.stages) ----------------------------------------------------
insert into stages (key, label, min_age_days, max_age_days, sort_order) values
  ('newborn',          'Newborn',          0,    56,   1),
  ('early_baby',       'Early Baby',       57,   120,  2),
  ('growing_baby',     'Growing Baby',     121,  210,  3),
  ('exploring_baby',   'Exploring Baby',   211,  365,  4),
  ('new_toddler',      'New Toddler',      366,  540,  5),
  ('curious_toddler',  'Curious Toddler',  541,  1095, 6),
  ('preschooler',      'Preschooler',      1096, 1825, 7),
  ('early_school_age', 'Early School Age', 1826, 3650, 8)
on conflict (key) do update set
  label = excluded.label,
  min_age_days = excluded.min_age_days,
  max_age_days = excluded.max_age_days,
  sort_order = excluded.sort_order;

-- Categories (canonicalizeTopic_ output; familyCategories flagged) ---------------
insert into categories (key, label, is_family_category, sort_order) values
  ('development',   'Development',           true,  1),
  ('sleep',         'Sleep',                 true,  2),
  ('learning_play', 'Learning & Play',       true,  3),
  ('feeding',       'Feeding',               true,  4),
  ('behavior',      'Behavior',              true,  5),
  ('emotional',     'Emotional Development', true,  6),
  ('safety',        'Safety',                true,  7)
on conflict (key) do update set
  label = excluded.label,
  is_family_category = excluded.is_family_category,
  sort_order = excluded.sort_order;

-- Milestone prompts (APP_CONFIG.milestonePrompts) -------------------------------
insert into milestone_prompts (key, label, prompt, min_age_days, max_age_days, topic, not_yet_tip, sort_order) values
  ('first_smile', 'first smile', 'Has {child_name} smiled at you yet?', 28, 120, 'emotional',
   'That is still ahead for many babies. Keep leaning into face-to-face time, soft talking, and short playful pauses.', 1),
  ('first_roll', 'first roll', 'Has {child_name} rolled over yet?', 90, 240, 'development',
   'That is still very normal. A little supervised floor time and reaching play can help build toward it.', 2),
  ('first_crawl', 'first crawl', 'Has {child_name} started crawling yet?', 180, 360, 'development',
   'Many babies get there on their own timeline. Floor play, reaching, and chances to pivot are enough for today.', 3),
  ('first_stand', 'first stand', 'Is {child_name} pulling up to stand yet?', 240, 420, 'development',
   'That skill often comes with repetition. A stable surface and plenty of free movement time are enough for now.', 4),
  ('first_step', 'first step', 'Has {child_name} taken first steps yet?', 300, 540, 'development',
   'Walking can come in a wide range. Cruising, squatting, and playful practice all count as progress.', 5),
  ('first_word', 'first word', 'Has {child_name} said a first word yet?', 270, 600, 'learning_play',
   'Language builds slowly. Keep naming familiar people, routines, and favorite objects through the day.', 6)
on conflict (key) do update set
  label = excluded.label,
  prompt = excluded.prompt,
  min_age_days = excluded.min_age_days,
  max_age_days = excluded.max_age_days,
  topic = excluded.topic,
  not_yet_tip = excluded.not_yet_tip,
  sort_order = excluded.sort_order;
