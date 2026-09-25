-- ═════════════════════════════════════════════════════════════════════════════
-- Vores Kok — bookkeeping for the one-time import from Mors Opskrifter.
-- Lives in the `legacy_import` schema, which is NOT exposed through the Data
-- API and is only used by scripts/migration (direct, privileged connection).
-- ═════════════════════════════════════════════════════════════════════════════
create schema if not exists legacy_import;
revoke all on schema legacy_import from public, anon, authenticated;

create table legacy_import.runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source_sha256 text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  dry_run boolean not null default false,
  report jsonb
);

-- legacy row → new row, per household. Makes the import idempotent.
create table legacy_import.id_map (
  household_id uuid not null references public.households (id) on delete cascade,
  entity text not null check (entity in ('category', 'recipe', 'ingredient', 'step', 'media', 'user')),
  legacy_id text not null,
  new_id uuid,
  run_id uuid references legacy_import.runs (id) on delete set null,
  primary key (household_id, entity, legacy_id)
);

-- Legacy accounts. ASP.NET Identity password hashes cannot be moved to
-- Supabase Auth, so people re-join by invite; this keeps who-was-who.
create table legacy_import.users (
  household_id uuid not null references public.households (id) on delete cascade,
  legacy_id text not null,
  user_name text,
  display_name text,
  email text,
  legacy_role text,
  matched_user_id uuid references auth.users (id) on delete set null,
  invite_id uuid references public.household_invites (id) on delete set null,
  primary key (household_id, legacy_id)
);

-- Every legacy favorite is preserved here, whether or not the person has an
-- account yet. Applied to public.favorites once the user is matched.
create table legacy_import.favorites (
  household_id uuid not null references public.households (id) on delete cascade,
  legacy_user_id text not null,
  legacy_recipe_id int not null,
  applied_at timestamptz,
  primary key (household_id, legacy_user_id, legacy_recipe_id)
);

alter table legacy_import.runs enable row level security;
alter table legacy_import.id_map enable row level security;
alter table legacy_import.users enable row level security;
alter table legacy_import.favorites enable row level security;
revoke all on all tables in schema legacy_import from public, anon, authenticated;

-- Applies pending legacy favorites for users that now exist (safe to re-run).
create or replace function legacy_import.apply_favorites(p_household_id uuid)
returns int
language plpgsql
set search_path = ''
as $$
declare n int;
begin
  with pending as (
    select f.legacy_user_id, f.legacy_recipe_id, u.matched_user_id, r.id as recipe_id
    from legacy_import.favorites f
    join legacy_import.users u on u.household_id = f.household_id and u.legacy_id = f.legacy_user_id
    join public.recipes r on r.household_id = f.household_id and r.legacy_id = f.legacy_recipe_id
    where f.household_id = p_household_id and f.applied_at is null and u.matched_user_id is not null
  ), ins as (
    insert into public.favorites (user_id, recipe_id, household_id)
    select matched_user_id, recipe_id, p_household_id from pending
    on conflict do nothing
    returning 1
  )
  update legacy_import.favorites f set applied_at = now()
  from pending p
  where f.household_id = p_household_id and f.legacy_user_id = p.legacy_user_id and f.legacy_recipe_id = p.legacy_recipe_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function legacy_import.apply_favorites(uuid) from public, anon, authenticated;
