-- ═════════════════════════════════════════════════════════════════════════════
-- Vores Kok — Phase 2: meal planning, shopping lists, pantry ("Mit køkken").
--
-- Same model as the recipe domain: every row carries household_id, children
-- use composite FKs (parent_id, household_id), RLS checks membership via
-- private.has_household_role. Shopping and meal-plan tables are published
-- for Supabase Realtime; PostgreSQL stays the source of truth.
-- ═════════════════════════════════════════════════════════════════════════════

create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.pantry_location_kind as enum ('fridge', 'freezer', 'cupboard', 'pantry', 'spices', 'other');

-- ─── Meal planning ───────────────────────────────────────────────────────────
-- One continuous plan per household (entries keyed by date + slot). A separate
-- meal_plans table would only add a level with no behaviour today; named plans
-- ("Jul 2026") can be added later without migrating entries.
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date date not null,
  slot public.meal_slot not null default 'dinner',
  position int not null default 0,
  recipe_id uuid,
  title text check (title is null or char_length(btrim(title)) between 1 and 200),
  servings int check (servings is null or servings between 1 and 1000),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipe_id is not null or title is not null),
  check (plan_date between date '2000-01-01' and date '2100-12-31'),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete set null (recipe_id)
);
create index meal_plan_entries_household_date_idx on public.meal_plan_entries (household_id, plan_date, slot, position);
create index meal_plan_entries_recipe_household_idx on public.meal_plan_entries (recipe_id, household_id);
create index meal_plan_entries_created_by_idx on public.meal_plan_entries (created_by);

-- A deleted recipe must leave a readable title behind in the plan. Runs
-- before the recipe row disappears (the FK then sets recipe_id to null).
create or replace function private.recipes_before_delete_keep_plan_title()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.meal_plan_entries set title = coalesce(title, old.title)
  where recipe_id = old.id and household_id = old.household_id;
  return old;
end $$;
revoke all on function private.recipes_before_delete_keep_plan_title() from public;
create trigger recipes_keep_plan_title before delete on public.recipes
  for each row execute function private.recipes_before_delete_keep_plan_title();

-- ─── Shopping ────────────────────────────────────────────────────────────────
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create index shopping_lists_household_idx on public.shopping_lists (household_id, archived_at);
create index shopping_lists_created_by_idx on public.shopping_lists (created_by);

create table public.shopping_list_items (
  -- Clients may generate ids (offline adds are replayed idempotently).
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  household_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  name_normalized text generated always as (private.normalize_text(name)) stored,
  quantity numeric(12, 4) check (quantity is null or quantity > 0),
  unit text check (unit is null or char_length(unit) <= 40),
  unit_code text references public.units (code),
  category text not null default 'other' check (category ~ '^[a-z_]{1,30}$'),
  note text check (note is null or char_length(note) <= 500),
  checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  position int not null default 0,
  -- Provenance: which recipes / plan entries contributed (for "why is this here?").
  source_recipe_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade
);
create index shopping_list_items_list_idx on public.shopping_list_items (list_id, household_id, checked, category, position);
create index shopping_list_items_household_idx on public.shopping_list_items (household_id);
create index shopping_list_items_unit_code_idx on public.shopping_list_items (unit_code);
create index shopping_list_items_checked_by_idx on public.shopping_list_items (checked_by);
create index shopping_list_items_created_by_idx on public.shopping_list_items (created_by);

create or replace function private.shopping_item_checked()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.checked and (tg_op = 'INSERT' or not old.checked) then
    new.checked_at := now();
    new.checked_by := auth.uid();
  elsif not new.checked then
    new.checked_at := null;
    new.checked_by := null;
  end if;
  return new;
end $$;
create trigger shopping_list_items_checked before insert or update of checked on public.shopping_list_items
  for each row execute function private.shopping_item_checked();

-- Touch the parent list so list overviews can sort by activity.
create or replace function private.touch_shopping_list()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.shopping_lists set updated_at = now() where id = coalesce(new.list_id, old.list_id);
  return null;
end $$;
revoke all on function private.touch_shopping_list() from public;
create trigger shopping_list_items_touch_list after insert or update or delete on public.shopping_list_items
  for each row execute function private.touch_shopping_list();

-- ─── Pantry / Mit køkken ─────────────────────────────────────────────────────
create table public.pantry_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind public.pantry_location_kind not null default 'other',
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index pantry_locations_household_name_uq on public.pantry_locations (household_id, lower(btrim(name)));

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  location_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  name_normalized text generated always as (private.normalize_text(name)) stored,
  quantity numeric(12, 4) check (quantity is null or quantity > 0),
  unit text check (unit is null or char_length(unit) <= 40),
  unit_code text references public.units (code),
  best_before date,
  opened_on date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (location_id, household_id) references public.pantry_locations (id, household_id) on delete cascade
);
create index pantry_items_location_idx on public.pantry_items (location_id, household_id);
create index pantry_items_household_best_before_idx on public.pantry_items (household_id, best_before);
create index pantry_items_name_trgm_idx on public.pantry_items using gin (name_normalized extensions.gin_trgm_ops);
create index pantry_items_unit_code_idx on public.pantry_items (unit_code);
create index pantry_items_created_by_idx on public.pantry_items (created_by);

-- Default locations for every household (new and existing).
create or replace function private.create_default_pantry_locations(p_household_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.pantry_locations (household_id, name, kind, position) values
    (p_household_id, 'Køleskab', 'fridge', 0),
    (p_household_id, 'Fryser', 'freezer', 1),
    (p_household_id, 'Køkkenskab', 'cupboard', 2),
    (p_household_id, 'Spisekammer', 'pantry', 3),
    (p_household_id, 'Krydderiskuffe', 'spices', 4)
  on conflict do nothing
$$;
revoke all on function private.create_default_pantry_locations(uuid) from public;

create or replace function private.households_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.create_default_pantry_locations(new.id);
  return null;
end $$;
revoke all on function private.households_after_insert() from public;
create trigger households_default_pantry after insert on public.households
  for each row execute function private.households_after_insert();

do $$
declare h uuid;
begin
  for h in select id from public.households loop
    perform private.create_default_pantry_locations(h);
  end loop;
end $$;

-- ─── Common triggers ─────────────────────────────────────────────────────────
create trigger meal_plan_entries_touch before update on public.meal_plan_entries for each row execute function private.touch_updated_at();
create trigger shopping_lists_touch before update on public.shopping_lists for each row execute function private.touch_updated_at();
create trigger shopping_list_items_touch before update on public.shopping_list_items for each row execute function private.touch_updated_at();
create trigger pantry_items_touch before update on public.pantry_items for each row execute function private.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['meal_plan_entries','shopping_lists','shopping_list_items','pantry_locations','pantry_items'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.prevent_household_change()', t || '_fixed_household', t);
    execute format('alter table public.%I enable row level security', t);
    -- Kitchen data is shared household work: members write, viewers read.
    execute format($f$
      create policy %1$I on public.%2$I for select to authenticated using (private.has_household_role(household_id, 'viewer'));
      create policy %3$I on public.%2$I for insert to authenticated with check (private.has_household_role(household_id, 'member'));
      create policy %4$I on public.%2$I for update to authenticated
        using (private.has_household_role(household_id, 'member')) with check (private.has_household_role(household_id, 'member'));
      create policy %5$I on public.%2$I for delete to authenticated using (private.has_household_role(household_id, 'member'));
    $f$, t || '_select', t, t || '_insert', t || '_update', t || '_delete');
  end loop;
end $$;

create trigger meal_plan_entries_stamp before insert on public.meal_plan_entries for each row execute function private.stamp_created_by();
create trigger shopping_lists_stamp before insert on public.shopping_lists for each row execute function private.stamp_created_by();
create trigger shopping_list_items_stamp before insert on public.shopping_list_items for each row execute function private.stamp_created_by();
create trigger pantry_items_stamp before insert on public.pantry_items for each row execute function private.stamp_created_by();

-- Viewers may tick items off while shopping (common family case) — but only
-- the checked flag. Enforced by a column-scoped RPC instead of a broad policy.
create or replace function public.set_shopping_item_checked(p_item_id uuid, p_checked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_household uuid;
begin
  select household_id into v_household from public.shopping_list_items where id = p_item_id;
  if v_household is null or not private.has_household_role(v_household, 'viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.shopping_list_items set checked = p_checked where id = p_item_id;
end
$$;
revoke all on function public.set_shopping_item_checked(uuid, boolean) from public, anon;
grant execute on function public.set_shopping_item_checked(uuid, boolean) to authenticated;

-- Atomic upsert of many items (used by "add recipe/plan to list" after
-- client-side aggregation, and by offline replay). Invoker rights: RLS applies.
create or replace function public.upsert_shopping_items(p_list_id uuid, p_items jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  n int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'items must be an array of at most 500' using errcode = '22023';
  end if;
  select household_id into v_household from public.shopping_lists where id = p_list_id;
  if v_household is null then
    raise exception 'list not found' using errcode = 'P0002';
  end if;
  insert into public.shopping_list_items as i (id, list_id, household_id, name, quantity, unit, unit_code, category, note, position, source_recipe_ids, checked)
  select coalesce(private.try_uuid(x ->> 'id'), gen_random_uuid()), p_list_id, v_household, btrim(x ->> 'name'),
         (x ->> 'quantity')::numeric, nullif(x ->> 'unit', ''), nullif(x ->> 'unit_code', ''),
         coalesce(nullif(x ->> 'category', ''), 'other'), nullif(x ->> 'note', ''),
         coalesce((x ->> 'position')::int, 0),
         coalesce(array(select private.try_uuid(v) from jsonb_array_elements_text(coalesce(x -> 'source_recipe_ids', '[]')) v where private.try_uuid(v) is not null), '{}'),
         coalesce((x ->> 'checked')::boolean, false)
  from jsonb_array_elements(p_items) x
  on conflict (id) do update set
    name = excluded.name, quantity = excluded.quantity, unit = excluded.unit, unit_code = excluded.unit_code,
    category = excluded.category, note = excluded.note, source_recipe_ids = excluded.source_recipe_ids
  where i.list_id = p_list_id;
  get diagnostics n = row_count;
  return n;
end
$$;
revoke all on function public.upsert_shopping_items(uuid, jsonb) from public, anon;
grant execute on function public.upsert_shopping_items(uuid, jsonb) to authenticated;

-- ─── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shopping_list_items, public.shopping_lists, public.meal_plan_entries;
  end if;
end $$;
alter table public.shopping_list_items replica identity full;
alter table public.meal_plan_entries replica identity full;

revoke all on public.meal_plan_entries, public.shopping_lists, public.shopping_list_items, public.pantry_locations, public.pantry_items from anon;
