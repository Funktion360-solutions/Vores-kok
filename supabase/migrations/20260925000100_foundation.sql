-- ═════════════════════════════════════════════════════════════════════════════
-- Vores Kok — Foundation: extensions, enums, private helpers, identity, households
--
-- Security model (see docs/security/rls.md):
--   * Every table in `public` has RLS enabled.
--   * The authorization boundary is the household. Membership + role is read
--     from public.household_members — never from JWT/user metadata.
--   * Privileged helpers live in the `private` schema, which is NOT exposed
--     through the Data API. SECURITY DEFINER is used only where documented.
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ─── Enums ───────────────────────────────────────────────────────────────────
create type public.household_role as enum ('owner', 'admin', 'member', 'viewer');

-- ─── Generic helpers ─────────────────────────────────────────────────────────
create or replace function private.role_rank(r public.household_role)
returns int
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case r
    when 'owner' then 4
    when 'admin' then 3
    when 'member' then 2
    when 'viewer' then 1
  end
$$;

create or replace function private.try_uuid(v text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return v::uuid;
exception when others then
  return null;
end
$$;

-- Keeps updated_at current. Ignores changes that only touch derived columns
-- (search_vector) so background refreshes do not look like user edits.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'search_vector' - 'updated_by')
     is distinct from (to_jsonb(old) - 'updated_at' - 'search_vector' - 'updated_by') then
    new.updated_at := now();
    if to_jsonb(new) ? 'updated_by' and auth.uid() is not null then
      new := jsonb_populate_record(new, jsonb_build_object('updated_by', auth.uid()));
    end if;
  end if;
  return new;
end
$$;

-- Rows may never move between households (prevents cross-household smuggling
-- through UPDATE even if a policy were misconfigured).
create or replace function private.prevent_household_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end
$$;

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 500),
  locale text not null default 'da' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Application profile for a Supabase Auth user. Not used for authorization.';

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Creates a profile when an auth user is created. SECURITY DEFINER because it
-- runs in the auth transaction as supabase_auth_admin, which has no rights on
-- public.profiles. Only the display name is taken from user metadata (never
-- authorization data).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null then
    v_name := coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Kok');
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, left(v_name, 80))
  on conflict (id) do nothing;
  return new;
end
$$;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ─── Households ──────────────────────────────────────────────────────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_touch before update on public.households
  for each row execute function private.touch_updated_at();

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_role not null default 'member',
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- ─── Membership helpers ──────────────────────────────────────────────────────
-- SECURITY DEFINER is required: policies on household_members (and every
-- household-scoped table) must look up membership without re-entering RLS on
-- household_members, which would recurse. The function only answers a yes/no
-- question about the *calling* user (auth.uid()), lives in the non-exposed
-- `private` schema and pins search_path.
create or replace function private.has_household_role(p_household_id uuid, p_min_role public.household_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
      and private.role_rank(m.role) >= private.role_rank(p_min_role)
  )
$$;
revoke all on function private.has_household_role(uuid, public.household_role) from public;
grant execute on function private.has_household_role(uuid, public.household_role) to authenticated, service_role;

create or replace function private.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members other on other.household_id = me.household_id
    where me.user_id = (select auth.uid())
      and other.user_id = p_user_id
  )
$$;
revoke all on function private.shares_household_with(uuid) from public;
grant execute on function private.shares_household_with(uuid) to authenticated, service_role;

-- ─── Invites ─────────────────────────────────────────────────────────────────
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  role public.household_role not null default 'member' check (role <> 'owner'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token_hash text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index household_invites_household_idx on public.household_invites (household_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- profiles: see yourself and people you share a household with; edit yourself.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_household_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- households: members read; admins rename; owners delete. Creation goes
-- through public.create_household() so the owner membership is atomic.
create policy households_select on public.households for select to authenticated
  using (private.has_household_role(id, 'viewer'));
create policy households_update on public.households for update to authenticated
  using (private.has_household_role(id, 'admin'))
  with check (private.has_household_role(id, 'admin'));
create policy households_delete on public.households for delete to authenticated
  using (private.has_household_role(id, 'owner'));

-- household_members: members can see who else is in their household.
-- All mutations go through RPCs with explicit role rules (below).
create policy household_members_select on public.household_members for select to authenticated
  using (private.has_household_role(household_id, 'viewer'));

-- invites: only admins+ see invites (token hashes are never returned in plain).
create policy household_invites_select on public.household_invites for select to authenticated
  using (private.has_household_role(household_id, 'admin'));

-- ─── Household RPCs ──────────────────────────────────────────────────────────
-- SECURITY DEFINER: creating a household needs to insert the first owner
-- membership, which no client policy permits (no one is admin yet).
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then
    raise exception 'invalid household name' using errcode = '22023';
  end if;
  if (select count(*) from public.household_members where user_id = v_uid and role = 'owner') >= 10 then
    raise exception 'household limit reached' using errcode = '54000';
  end if;
  insert into public.households (name, created_by) values (btrim(p_name), v_uid) returning id into v_id;
  insert into public.household_members (household_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end
$$;
revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

-- Creates an invite and returns the plaintext token ONCE. Only a SHA-256 hash
-- is stored. Invoker rights are not enough because invites have no insert
-- policy (keeps token generation server-side).
create or replace function public.create_household_invite(
  p_household_id uuid,
  p_role public.household_role default 'member',
  p_email text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if not private.has_household_role(p_household_id, 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'owner role cannot be invited' using errcode = '22023';
  end if;
  -- Admins may not mint invites above their own rank.
  if p_role = 'admin' and not private.has_household_role(p_household_id, 'owner') then
    raise exception 'only owners can invite admins' using errcode = '42501';
  end if;
  if (select count(*) from public.household_invites
      where household_id = p_household_id and accepted_at is null and revoked_at is null
        and expires_at > now()) >= 50 then
    raise exception 'too many open invites' using errcode = '54000';
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.household_invites (household_id, role, email, token_hash, created_by)
  values (p_household_id, p_role, nullif(btrim(lower(p_email)), ''),
          encode(extensions.digest(v_token, 'sha256'), 'hex'), v_uid);
  return v_token;
end
$$;
revoke all on function public.create_household_invite(uuid, public.household_role, text) from public, anon;
grant execute on function public.create_household_invite(uuid, public.household_role, text) to authenticated;

create or replace function public.revoke_household_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.household_invites where id = p_invite_id;
  if v_household is null or not private.has_household_role(v_household, 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.household_invites set revoked_at = now()
  where id = p_invite_id and accepted_at is null and revoked_at is null;
end
$$;
revoke all on function public.revoke_household_invite(uuid) from public, anon;
grant execute on function public.revoke_household_invite(uuid) to authenticated;

-- SECURITY DEFINER: the invitee is not yet a member, so no policy lets them
-- see the invite or insert membership. Validation is by token hash only.
create or replace function public.accept_household_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.household_invites;
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 100 then
    raise exception 'invalid invite' using errcode = '22023';
  end if;
  select * into v_inv from public.household_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;
  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null
     or v_inv.expires_at <= now() then
    raise exception 'invalid invite' using errcode = '22023';
  end if;
  if v_inv.email is not null then
    select lower(email) into v_email from auth.users where id = v_uid;
    if v_email is distinct from v_inv.email then
      raise exception 'invalid invite' using errcode = '22023';
    end if;
  end if;
  insert into public.household_members (household_id, user_id, role, invited_by)
  values (v_inv.household_id, v_uid, v_inv.role, v_inv.created_by)
  on conflict (household_id, user_id) do nothing;
  update public.household_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.household_id;
end
$$;
revoke all on function public.accept_household_invite(text) from public, anon;
grant execute on function public.accept_household_invite(text) to authenticated;

-- Role changes. Rules (docs/security/household-permissions.md):
--   * owners can set any role (incl. owner); admins can set member/viewer on
--     members/viewers only; nobody can remove the last owner.
create or replace function public.set_household_member_role(
  p_household_id uuid, p_user_id uuid, p_role public.household_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.household_role;
  v_is_owner boolean := private.has_household_role(p_household_id, 'owner');
begin
  if not private.has_household_role(p_household_id, 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select role into v_target_role from public.household_members
  where household_id = p_household_id and user_id = p_user_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if not v_is_owner and (private.role_rank(v_target_role) >= 3 or private.role_rank(p_role) >= 3) then
    raise exception 'only owners can change admins or owners' using errcode = '42501';
  end if;
  if v_target_role = 'owner' and p_role <> 'owner' and
     (select count(*) from public.household_members where household_id = p_household_id and role = 'owner') <= 1 then
    raise exception 'a household must keep at least one owner' using errcode = '23514';
  end if;
  update public.household_members set role = p_role
  where household_id = p_household_id and user_id = p_user_id;
end
$$;
revoke all on function public.set_household_member_role(uuid, uuid, public.household_role) from public, anon;
grant execute on function public.set_household_member_role(uuid, uuid, public.household_role) to authenticated;

-- Remove a member (or leave, when p_user_id = caller).
create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_role public.household_role;
begin
  select role into v_target_role from public.household_members
  where household_id = p_household_id and user_id = p_user_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if p_user_id <> v_uid then
    if not private.has_household_role(p_household_id, 'admin') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if private.role_rank(v_target_role) >= 3 and not private.has_household_role(p_household_id, 'owner') then
      raise exception 'only owners can remove admins or owners' using errcode = '42501';
    end if;
  end if;
  if v_target_role = 'owner' and
     (select count(*) from public.household_members where household_id = p_household_id and role = 'owner') <= 1 then
    raise exception 'a household must keep at least one owner' using errcode = '23514';
  end if;
  delete from public.household_members where household_id = p_household_id and user_id = p_user_id;
end
$$;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;

-- Lists the caller's households with their role (convenience for clients).
create or replace function public.my_households()
returns table (id uuid, name text, role public.household_role, member_count bigint, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.name, m.role,
         (select count(*) from public.household_members x where x.household_id = h.id),
         h.created_at
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = (select auth.uid())
  order by h.created_at
$$;
revoke all on function public.my_households() from public, anon;
grant execute on function public.my_households() to authenticated;
