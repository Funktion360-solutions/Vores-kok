-- ═════════════════════════════════════════════════════════════════════════════
-- Vores Kok — Recipe domain: people (family history), categories, tags, units,
-- recipes, ingredients, steps, media, stories, favorites, notes, versions.
--
-- Every household-scoped child table carries household_id and a composite FK
-- (parent_id, household_id) → parent(id, household_id). This makes it
-- impossible for a row to reference a parent in another household, and lets
-- RLS policies check household_id directly (fast, no joins).
-- ═════════════════════════════════════════════════════════════════════════════

create type public.recipe_difficulty as enum ('easy', 'medium', 'hard');
create type public.recipe_source_type as enum ('manual', 'legacy_import', 'url', 'text', 'image', 'pdf', 'scan', 'other');
create type public.media_kind as enum ('photo', 'original_scan', 'historical_photo', 'document');
create type public.note_visibility as enum ('private', 'household');
create type public.unit_kind as enum ('mass', 'volume', 'count', 'other');

-- ─── Ingredient-name normalization (mirrors packages/domain normalizeIngredientName) ─
create or replace function private.normalize_text(v text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(v, ''))), '\s+', ' ', 'g'), '')
$$;

-- ─── Units (global reference data, not household data) ───────────────────────
create table public.units (
  code text primary key check (code ~ '^[a-zæøå_]{1,20}$'),
  label text not null,
  label_plural text not null,
  kind public.unit_kind not null,
  -- Factor to the base unit of the kind: grams for mass, millilitres for volume.
  to_base numeric,
  aliases text[] not null default '{}',
  sort_order int not null default 0,
  check ((kind in ('mass', 'volume')) = (to_base is not null))
);
comment on table public.units is 'Reference units. Readable by every signed-in user: contains no household data.';

insert into public.units (code, label, label_plural, kind, to_base, aliases, sort_order) values
  ('mg',    'mg',    'mg',    'mass',   0.001,  '{milligram}', 10),
  ('g',     'g',     'g',     'mass',   1,      '{gram,gr,gr.}', 11),
  ('kg',    'kg',    'kg',    'mass',   1000,   '{kilo,kilogram}', 12),
  ('ml',    'ml',    'ml',    'volume', 1,      '{milliliter}', 20),
  ('cl',    'cl',    'cl',    'volume', 10,     '{centiliter}', 21),
  ('dl',    'dl',    'dl',    'volume', 100,    '{deciliter}', 22),
  ('l',     'l',     'l',     'volume', 1000,   '{liter,ltr}', 23),
  ('tsk',   'tsk',   'tsk',   'volume', 5,      '{tsk.,teske,teskefuld,tl}', 24),
  ('spsk',  'spsk',  'spsk',  'volume', 15,     '{spsk.,spiseske,spiseskefuld,sp}', 25),
  ('knsp',  'knsp',  'knsp',  'other',  null,   '{knsp.,knivspids}', 30),
  ('stk',   'stk',   'stk',   'count',  null,   '{stk.,styk,styk.}', 40),
  ('fed',   'fed',   'fed',   'count',  null,   '{}', 41),
  ('skive', 'skive', 'skiver','count',  null,   '{skiver}', 42),
  ('bundt', 'bundt', 'bundter','count', null,   '{bundter,bdt}', 43),
  ('dåse',  'dåse',  'dåser', 'count',  null,   '{dåser,ds}', 44),
  ('pose',  'pose',  'poser', 'count',  null,   '{poser}', 45),
  ('pakke', 'pakke', 'pakker','count',  null,   '{pakker,pk}', 46),
  ('glas',  'glas',  'glas',  'count',  null,   '{}', 47),
  ('håndfuld','håndfuld','håndfulde','other', null, '{håndfulde}', 50),
  ('drys',  'drys',  'drys',  'other',  null,   '{}', 51),
  ('cup',   'cup',   'cups',  'volume', 240,    '{cups,kop,kopper}', 60),
  ('oz',    'oz',    'oz',    'mass',   28.3495,'{ounce,ounces}', 61),
  ('lb',    'lb',    'lb',    'mass',   453.592,'{pound,pounds,lbs}', 62);

-- ─── People (family history — not app users) ─────────────────────────────────
create table public.people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  relation text check (relation is null or char_length(relation) <= 120),
  birth_year int check (birth_year is null or birth_year between 1500 and 2200),
  death_year int check (death_year is null or death_year between 1500 and 2200),
  bio text check (bio is null or char_length(bio) <= 10000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  check (death_year is null or birth_year is null or death_year >= birth_year)
);
create index people_household_idx on public.people (household_id);

-- ─── Categories & tags ───────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  icon text not null default 'cookie' check (icon ~ '^[a-z0-9-]{1,40}$'),
  sort_order int not null default 0,
  legacy_id int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index categories_household_name_uq on public.categories (household_id, lower(btrim(name)));

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index tags_household_name_uq on public.tags (household_id, lower(btrim(name)));

-- ─── Recipes ─────────────────────────────────────────────────────────────────
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  category_id uuid,
  cuisine text check (cuisine is null or char_length(cuisine) <= 80),
  meal_types text[] not null default '{}'
    check (meal_types <@ array['breakfast','brunch','lunch','dinner','dessert','snack','baking','drink','side']::text[]),
  servings int check (servings is null or servings between 1 and 1000),
  -- What "servings" counts: null/'personer' = people; otherwise e.g. 'stk', 'kranse', 'boller'.
  yield_unit text check (yield_unit is null or char_length(yield_unit) <= 40),
  prep_minutes int check (prep_minutes is null or prep_minutes between 0 and 20160),
  cook_minutes int check (cook_minutes is null or cook_minutes between 0 and 20160),
  -- Optional explicit total (e.g. includes rising/resting). Falls back to prep+cook.
  total_minutes int check (total_minutes is null or total_minutes between 0 and 40320),
  difficulty public.recipe_difficulty,
  notes text check (notes is null or char_length(notes) <= 20000),
  -- Provenance
  source_type public.recipe_source_type not null default 'manual',
  source_name text check (source_name is null or char_length(source_name) <= 200),
  source_url text check (source_url is null or (source_url ~* '^https?://' and char_length(source_url) <= 2000)),
  source_text text check (source_text is null or char_length(source_text) <= 100000),
  -- Family origin
  origin_person_id uuid,
  origin_text text check (origin_text is null or char_length(origin_text) <= 300),
  origin_year int check (origin_year is null or origin_year between 1500 and 2200),
  origin_year_approx boolean not null default true,
  -- Legacy (Mors Opskrifter) fields preserved verbatim
  legacy_id int,
  legacy_author text check (legacy_author is null or char_length(legacy_author) <= 100),
  legacy_last_modified timestamptz,
  legacy_category_icon text,
  archived_at timestamptz,
  version int not null default 1 check (version >= 1),
  search_vector tsvector,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id) references public.categories (id, household_id)
    on delete set null (category_id),
  foreign key (origin_person_id, household_id) references public.people (id, household_id)
    on delete set null (origin_person_id)
);
create unique index recipes_household_legacy_uq on public.recipes (household_id, legacy_id) where legacy_id is not null;
create index recipes_household_title_idx on public.recipes (household_id, lower(title));
create index recipes_household_updated_idx on public.recipes (household_id, updated_at desc);
create index recipes_category_idx on public.recipes (category_id);
create index recipes_origin_person_idx on public.recipes (origin_person_id);
create index recipes_search_idx on public.recipes using gin (search_vector);
create index recipes_title_trgm_idx on public.recipes using gin (lower(title) extensions.gin_trgm_ops);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  position int not null check (position >= 0),
  section text check (section is null or char_length(section) <= 120),
  quantity numeric(12, 4) check (quantity is null or quantity > 0),
  quantity_max numeric(12, 4) check (quantity_max is null or (quantity is not null and quantity_max >= quantity)),
  unit text check (unit is null or char_length(unit) <= 40),
  unit_code text references public.units (code),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  name_normalized text generated always as (private.normalize_text(name)) stored,
  preparation text check (preparation is null or char_length(preparation) <= 200),
  original_text text check (original_text is null or char_length(original_text) <= 500),
  is_optional boolean not null default false,
  is_scalable boolean not null default true,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  unique (recipe_id, position) deferrable initially deferred
);
create index recipe_ingredients_household_idx on public.recipe_ingredients (household_id);
create index recipe_ingredients_name_trgm_idx on public.recipe_ingredients using gin (name_normalized extensions.gin_trgm_ops);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  position int not null check (position >= 0),
  section text check (section is null or char_length(section) <= 120),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  timer_seconds int check (timer_seconds is null or timer_seconds between 1 and 172800),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  unique (recipe_id, position) deferrable initially deferred
);
create index recipe_steps_household_idx on public.recipe_steps (household_id);

create table public.recipe_tags (
  recipe_id uuid not null,
  tag_id uuid not null,
  household_id uuid not null,
  primary key (recipe_id, tag_id),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (tag_id, household_id) references public.tags (id, household_id) on delete cascade
);
create index recipe_tags_tag_idx on public.recipe_tags (tag_id);
create index recipe_tags_household_idx on public.recipe_tags (household_id);

-- ─── Family stories ──────────────────────────────────────────────────────────
create table public.recipe_stories (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  title text check (title is null or char_length(title) <= 200),
  body text not null check (char_length(btrim(body)) between 1 and 50000),
  person_id uuid,
  told_by text check (told_by is null or char_length(told_by) <= 120),
  approx_year int check (approx_year is null or approx_year between 1500 and 2200),
  historical_context text check (historical_context is null or char_length(historical_context) <= 10000),
  position int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (person_id, household_id) references public.people (id, household_id) on delete set null (person_id)
);
create index recipe_stories_recipe_idx on public.recipe_stories (recipe_id);
create index recipe_stories_household_idx on public.recipe_stories (household_id);
create index recipe_stories_person_idx on public.recipe_stories (person_id);

-- ─── Media ───────────────────────────────────────────────────────────────────
create table public.recipe_media (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  story_id uuid,
  kind public.media_kind not null default 'photo',
  -- Object key in the private `household-media` bucket; always prefixed by household.
  storage_path text not null unique check (char_length(storage_path) <= 500),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf')),
  byte_size int check (byte_size is null or byte_size between 1 and 26214400),
  width int check (width is null or width between 1 and 20000),
  height int check (height is null or height between 1 and 20000),
  caption text check (caption is null or char_length(caption) <= 1000),
  approx_year int check (approx_year is null or approx_year between 1500 and 2200),
  is_cover boolean not null default false,
  position int not null default 0,
  legacy_path text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (storage_path like household_id::text || '/%'),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (story_id, household_id) references public.recipe_stories (id, household_id) on delete set null (story_id)
);
create index recipe_media_recipe_idx on public.recipe_media (recipe_id, position);
create index recipe_media_household_idx on public.recipe_media (household_id);
create index recipe_media_story_idx on public.recipe_media (story_id);
create unique index recipe_media_one_cover_uq on public.recipe_media (recipe_id) where is_cover;

-- ─── Personal interaction ────────────────────────────────────────────────────
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null,
  household_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index favorites_recipe_idx on public.favorites (recipe_id);
create index favorites_household_idx on public.favorites (household_id);

create table public.recipe_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  visibility public.note_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index recipe_notes_recipe_idx on public.recipe_notes (recipe_id);
create index recipe_notes_user_idx on public.recipe_notes (user_id);
create index recipe_notes_household_idx on public.recipe_notes (household_id);

-- ─── Version history (append-only, written by private.snapshot_recipe) ───────
create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  version int not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recipe_id, version),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index recipe_versions_household_idx on public.recipe_versions (household_id);

-- ─── Triggers ────────────────────────────────────────────────────────────────
create trigger people_touch before update on public.people for each row execute function private.touch_updated_at();
create trigger categories_touch before update on public.categories for each row execute function private.touch_updated_at();
create trigger recipes_touch before update on public.recipes for each row execute function private.touch_updated_at();
create trigger recipe_stories_touch before update on public.recipe_stories for each row execute function private.touch_updated_at();
create trigger recipe_notes_touch before update on public.recipe_notes for each row execute function private.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['people','categories','tags','recipes','recipe_ingredients','recipe_steps',
                           'recipe_tags','recipe_stories','recipe_media','favorites','recipe_notes','recipe_versions']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.prevent_household_change()',
                   t || '_fixed_household', t);
  end loop;
end $$;

-- Recipe notes/favorites may not be reassigned to another user.
create or replace function private.prevent_user_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger recipe_notes_fixed_user before update on public.recipe_notes for each row execute function private.prevent_user_change();

-- Recipe creators are stamped server-side; clients cannot forge them.
create or replace function private.stamp_created_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
create trigger recipes_stamp before insert on public.recipes for each row execute function private.stamp_created_by();
create trigger people_stamp before insert on public.people for each row execute function private.stamp_created_by();
create trigger recipe_stories_stamp before insert on public.recipe_stories for each row execute function private.stamp_created_by();
create trigger recipe_media_stamp before insert on public.recipe_media for each row execute function private.stamp_created_by();

-- ─── Search vector maintenance ───────────────────────────────────────────────
-- SECURITY DEFINER: recomputes a derived column from rows the caller has just
-- been allowed (by RLS) to write. It only updates search_vector.
create or replace function private.refresh_recipe_search(p_recipe_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.recipes r set search_vector =
      setweight(to_tsvector('danish', extensions.unaccent(coalesce(r.title, ''))), 'A')
   || setweight(to_tsvector('danish', extensions.unaccent(coalesce((
        select string_agg(i.name, ' ') from public.recipe_ingredients i where i.recipe_id = r.id), ''))), 'B')
   || setweight(to_tsvector('danish', extensions.unaccent(coalesce(r.description, '') || ' '
        || coalesce(r.cuisine, '') || ' ' || coalesce(r.origin_text, '') || ' ' || coalesce(r.legacy_author, '')
        || ' ' || coalesce((select c.name from public.categories c where c.id = r.category_id), ''))), 'C')
   || setweight(to_tsvector('danish', extensions.unaccent(coalesce(r.notes, ''))), 'D')
  where r.id = p_recipe_id
$$;
revoke all on function private.refresh_recipe_search(uuid) from public;

create or replace function private.recipes_search_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_recipe_search(new.id);
  return null;
end $$;
revoke all on function private.recipes_search_trigger() from public;

create trigger recipes_search_ins after insert on public.recipes
  for each row execute function private.recipes_search_trigger();
create trigger recipes_search_upd after update of title, description, notes, cuisine, origin_text, category_id, legacy_author
  on public.recipes for each row execute function private.recipes_search_trigger();

create or replace function private.ingredients_search_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  for v_id in
    select distinct recipe_id from (
      select recipe_id from new_rows
      union all
      select recipe_id from old_rows
    ) x
  loop
    perform private.refresh_recipe_search(v_id);
  end loop;
  return null;
end $$;
revoke all on function private.ingredients_search_trigger() from public;

create or replace function private.ingredients_search_ins()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  for v_id in select distinct recipe_id from new_rows loop
    perform private.refresh_recipe_search(v_id);
  end loop;
  return null;
end $$;
create or replace function private.ingredients_search_del()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  for v_id in select distinct o.recipe_id from old_rows o join public.recipes r on r.id = o.recipe_id loop
    perform private.refresh_recipe_search(v_id);
  end loop;
  return null;
end $$;
revoke all on function private.ingredients_search_ins() from public;
revoke all on function private.ingredients_search_del() from public;

create trigger recipe_ingredients_search_ins after insert on public.recipe_ingredients
  referencing new table as new_rows for each statement execute function private.ingredients_search_ins();
create trigger recipe_ingredients_search_upd after update on public.recipe_ingredients
  referencing new table as new_rows old table as old_rows for each statement execute function private.ingredients_search_trigger();
create trigger recipe_ingredients_search_del after delete on public.recipe_ingredients
  referencing old table as old_rows for each statement execute function private.ingredients_search_del();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.units enable row level security;
alter table public.people enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.recipe_stories enable row level security;
alter table public.recipe_media enable row level security;
alter table public.favorites enable row level security;
alter table public.recipe_notes enable row level security;
alter table public.recipe_versions enable row level security;

-- Units are public reference data (no household information).
create policy units_select on public.units for select to authenticated using (true);

-- Standard household content: viewer reads, member writes, admin deletes
-- (for recipes / people / categories / tags); members may delete child rows
-- (ingredients, steps, tags links, media, stories) as part of editing.
do $$
declare
  t text;
  del_role text;
begin
  foreach t in array array['people','categories','tags','recipes','recipe_ingredients','recipe_steps',
                           'recipe_tags','recipe_stories','recipe_media']
  loop
    del_role := case when t in ('people','categories','tags','recipes') then 'admin' else 'member' end;
    execute format($f$
      create policy %1$I on public.%2$I for select to authenticated
        using (private.has_household_role(household_id, 'viewer'));
      create policy %3$I on public.%2$I for insert to authenticated
        with check (private.has_household_role(household_id, 'member'));
      create policy %4$I on public.%2$I for update to authenticated
        using (private.has_household_role(household_id, 'member'))
        with check (private.has_household_role(household_id, 'member'));
      create policy %5$I on public.%2$I for delete to authenticated
        using (private.has_household_role(household_id, %6$L));
    $f$, t || '_select', t, t || '_insert', t || '_update', t || '_delete', del_role);
  end loop;
end $$;

-- Favorites are personal, but only for recipes in households you belong to.
create policy favorites_select on public.favorites for select to authenticated
  using (user_id = (select auth.uid()) and private.has_household_role(household_id, 'viewer'));
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and private.has_household_role(household_id, 'viewer'));
create policy favorites_delete on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- Notes: private notes are only visible to the author; household notes to all
-- members. Viewers may keep private notes; sharing requires member+.
create policy recipe_notes_select on public.recipe_notes for select to authenticated
  using (
    private.has_household_role(household_id, 'viewer')
    and (user_id = (select auth.uid()) or visibility = 'household')
  );
create policy recipe_notes_insert on public.recipe_notes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.has_household_role(household_id, 'viewer')
    and (visibility = 'private' or private.has_household_role(household_id, 'member'))
  );
create policy recipe_notes_update on public.recipe_notes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and private.has_household_role(household_id, 'viewer')
    and (visibility = 'private' or private.has_household_role(household_id, 'member'))
  );
create policy recipe_notes_delete on public.recipe_notes for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_household_role(household_id, 'admin'));

-- Version history: readable by the household; append-only via private.snapshot_recipe.
create policy recipe_versions_select on public.recipe_versions for select to authenticated
  using (private.has_household_role(household_id, 'viewer'));
