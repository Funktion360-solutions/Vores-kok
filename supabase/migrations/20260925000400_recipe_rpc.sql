-- ═════════════════════════════════════════════════════════════════════════════
-- Vores Kok — Recipe RPCs
--
--   save_recipe(payload)     atomic create/update of a recipe with ingredients,
--                            steps and tags; optimistic concurrency via version;
--                            snapshots the previous version into recipe_versions.
--   get_recipe(id)           one JSON document with everything the detail view
--                            (and the mobile offline cache) needs.
--   search_recipes(...)      filtered, ranked search.
--   set_favorite(id, bool)   idempotent favorite toggle.
--
-- save/get/search are SECURITY INVOKER: RLS on every table applies unchanged.
-- Error codes surfaced to clients:
--   VK409  version conflict (someone else saved first)
--   22023  invalid input
-- ═════════════════════════════════════════════════════════════════════════════

-- Household-shared recipe content (no per-user data). Invoker rights: when
-- called by a client RLS applies; when called from private.snapshot_recipe it
-- runs with that function's (definer) rights after its own role check.
create or replace function private.recipe_core_document(p_recipe_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'household_id', r.household_id,
    'title', r.title,
    'description', r.description,
    'category_id', r.category_id,
    'category', (select jsonb_build_object('id', c.id, 'name', c.name, 'icon', c.icon)
                 from public.categories c where c.id = r.category_id),
    'cuisine', r.cuisine,
    'meal_types', to_jsonb(r.meal_types),
    'servings', r.servings,
    'yield_unit', r.yield_unit,
    'prep_minutes', r.prep_minutes,
    'cook_minutes', r.cook_minutes,
    'total_minutes', r.total_minutes,
    'difficulty', r.difficulty,
    'notes', r.notes,
    'source_type', r.source_type,
    'source_name', r.source_name,
    'source_url', r.source_url,
    'source_text', r.source_text,
    'origin_person_id', r.origin_person_id,
    'origin_person', (select jsonb_build_object('id', p.id, 'name', p.name, 'relation', p.relation,
                                               'birth_year', p.birth_year, 'death_year', p.death_year)
                      from public.people p where p.id = r.origin_person_id),
    'origin_text', r.origin_text,
    'origin_year', r.origin_year,
    'origin_year_approx', r.origin_year_approx,
    'legacy_id', r.legacy_id,
    'legacy_author', r.legacy_author,
    'legacy_last_modified', r.legacy_last_modified,
    'archived_at', r.archived_at,
    'version', r.version,
    'created_by', r.created_by,
    'created_by_name', (select pr.display_name from public.profiles pr where pr.id = r.created_by),
    'updated_by', r.updated_by,
    'updated_by_name', (select pr.display_name from public.profiles pr where pr.id = r.updated_by),
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'position', i.position, 'section', i.section,
        'quantity', i.quantity, 'quantity_max', i.quantity_max,
        'unit', i.unit, 'unit_code', i.unit_code, 'name', i.name,
        'preparation', i.preparation, 'original_text', i.original_text,
        'is_optional', i.is_optional, 'is_scalable', i.is_scalable) order by i.position)
      from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'position', s.position, 'section', s.section,
        'body', s.body, 'timer_seconds', s.timer_seconds) order by s.position)
      from public.recipe_steps s where s.recipe_id = r.id), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by lower(t.name))
      from public.recipe_tags rt join public.tags t on t.id = rt.tag_id
      where rt.recipe_id = r.id), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'kind', m.kind, 'storage_path', m.storage_path, 'mime_type', m.mime_type,
        'width', m.width, 'height', m.height, 'caption', m.caption, 'approx_year', m.approx_year,
        'is_cover', m.is_cover, 'position', m.position, 'story_id', m.story_id,
        'created_at', m.created_at) order by m.is_cover desc, m.position, m.created_at)
      from public.recipe_media m where m.recipe_id = r.id), '[]'::jsonb),
    'stories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id, 'title', st.title, 'body', st.body, 'person_id', st.person_id,
        'person_name', (select p.name from public.people p where p.id = st.person_id),
        'told_by', st.told_by, 'approx_year', st.approx_year,
        'historical_context', st.historical_context, 'position', st.position,
        'created_at', st.created_at, 'updated_at', st.updated_at) order by st.position, st.created_at)
      from public.recipe_stories st where st.recipe_id = r.id), '[]'::jsonb)
  )
  from public.recipes r
  where r.id = p_recipe_id
$$;
revoke all on function private.recipe_core_document(uuid) from public;
grant execute on function private.recipe_core_document(uuid) to authenticated, service_role;

-- SECURITY DEFINER: recipe_versions has no client INSERT policy (history must
-- be append-only and trustworthy). This function checks member rights itself.
create or replace function private.snapshot_recipe(p_recipe_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
  v_version int;
begin
  select household_id, version into v_household, v_version from public.recipes where id = p_recipe_id;
  if v_household is null then
    return;
  end if;
  if auth.uid() is not null and not private.has_household_role(v_household, 'member') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.recipe_versions (recipe_id, household_id, version, snapshot, created_by)
  values (p_recipe_id, v_household, v_version, private.recipe_core_document(p_recipe_id), auth.uid())
  on conflict (recipe_id, version) do nothing;
end
$$;
revoke all on function private.snapshot_recipe(uuid) from public;
grant execute on function private.snapshot_recipe(uuid) to authenticated, service_role;

create or replace function public.save_recipe(p_recipe jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := private.try_uuid(p_recipe ->> 'id');
  v_household uuid := private.try_uuid(p_recipe ->> 'household_id');
  v_expected int := (p_recipe ->> 'expected_version')::int;
  v_existing public.recipes;
  v_tag text;
  v_tag_id uuid;
  v_keep uuid[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(p_recipe) <> 'object' then
    raise exception 'payload must be an object' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_recipe -> 'ingredients', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_recipe -> 'steps', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_recipe -> 'tags', '[]')) <> 'array' then
    raise exception 'ingredients, steps and tags must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_recipe -> 'ingredients', '[]')) > 300
     or jsonb_array_length(coalesce(p_recipe -> 'steps', '[]')) > 200
     or jsonb_array_length(coalesce(p_recipe -> 'tags', '[]')) > 30 then
    raise exception 'too many rows' using errcode = '22023';
  end if;

  if v_id is not null then
    -- No FOR UPDATE here: under RLS it would hide rows the caller can read but
    -- not update, turning an unauthorized edit into a silent create.
    select * into v_existing from public.recipes where id = v_id;
  end if;

  if v_existing.id is null then
    -- Create (the client may supply the id, e.g. for offline-created drafts).
    if v_household is null then
      raise exception 'household_id is required' using errcode = '22023';
    end if;
    insert into public.recipes (
      id, household_id, title, description, category_id, cuisine, meal_types, servings, yield_unit,
      prep_minutes, cook_minutes, total_minutes, difficulty, notes, source_type, source_name,
      source_url, source_text, origin_person_id, origin_text, origin_year, origin_year_approx, updated_by)
    values (
      coalesce(v_id, gen_random_uuid()), v_household, btrim(p_recipe ->> 'title'),
      nullif(p_recipe ->> 'description', ''), private.try_uuid(p_recipe ->> 'category_id'),
      nullif(p_recipe ->> 'cuisine', ''),
      coalesce(array(select jsonb_array_elements_text(p_recipe -> 'meal_types')), '{}'),
      (p_recipe ->> 'servings')::int, nullif(p_recipe ->> 'yield_unit', ''),
      (p_recipe ->> 'prep_minutes')::int, (p_recipe ->> 'cook_minutes')::int, (p_recipe ->> 'total_minutes')::int,
      (p_recipe ->> 'difficulty')::public.recipe_difficulty, nullif(p_recipe ->> 'notes', ''),
      coalesce((p_recipe ->> 'source_type')::public.recipe_source_type, 'manual'),
      nullif(p_recipe ->> 'source_name', ''), nullif(p_recipe ->> 'source_url', ''),
      nullif(p_recipe ->> 'source_text', ''), private.try_uuid(p_recipe ->> 'origin_person_id'),
      nullif(p_recipe ->> 'origin_text', ''), (p_recipe ->> 'origin_year')::int,
      coalesce((p_recipe ->> 'origin_year_approx')::boolean, true), auth.uid())
    returning id into v_id;
    v_household := (select household_id from public.recipes where id = v_id);
  else
    if v_household is not null and v_household <> v_existing.household_id then
      raise exception 'household_id cannot be changed' using errcode = '42501';
    end if;
    v_household := v_existing.household_id;
    if not private.has_household_role(v_household, 'member') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_expected is not null and v_expected <> v_existing.version then
      raise exception 'version_conflict' using errcode = 'VK409',
        detail = format('expected %s, current %s', v_expected, v_existing.version);
    end if;
    perform private.snapshot_recipe(v_id);
    update public.recipes set
      title = btrim(p_recipe ->> 'title'),
      description = nullif(p_recipe ->> 'description', ''),
      category_id = private.try_uuid(p_recipe ->> 'category_id'),
      cuisine = nullif(p_recipe ->> 'cuisine', ''),
      meal_types = coalesce(array(select jsonb_array_elements_text(p_recipe -> 'meal_types')), '{}'),
      servings = (p_recipe ->> 'servings')::int,
      yield_unit = nullif(p_recipe ->> 'yield_unit', ''),
      prep_minutes = (p_recipe ->> 'prep_minutes')::int,
      cook_minutes = (p_recipe ->> 'cook_minutes')::int,
      total_minutes = (p_recipe ->> 'total_minutes')::int,
      difficulty = (p_recipe ->> 'difficulty')::public.recipe_difficulty,
      notes = nullif(p_recipe ->> 'notes', ''),
      source_type = coalesce((p_recipe ->> 'source_type')::public.recipe_source_type, v_existing.source_type),
      source_name = nullif(p_recipe ->> 'source_name', ''),
      source_url = nullif(p_recipe ->> 'source_url', ''),
      source_text = case when p_recipe ? 'source_text' then nullif(p_recipe ->> 'source_text', '') else v_existing.source_text end,
      origin_person_id = private.try_uuid(p_recipe ->> 'origin_person_id'),
      origin_text = nullif(p_recipe ->> 'origin_text', ''),
      origin_year = (p_recipe ->> 'origin_year')::int,
      origin_year_approx = coalesce((p_recipe ->> 'origin_year_approx')::boolean, true),
      version = v_existing.version + 1,
      updated_by = auth.uid()
    where id = v_id and version = v_existing.version;
    if not found then
      -- Concurrent save between our read and write.
      raise exception 'version_conflict' using errcode = 'VK409';
    end if;
  end if;

  -- ── Ingredients: update by id, insert new, delete removed ──
  with incoming as (
    select (ord - 1)::int as position, private.try_uuid(x ->> 'id') as id, x
    from jsonb_array_elements(coalesce(p_recipe -> 'ingredients', '[]')) with ordinality as t(x, ord)
  )
  select coalesce(array_agg(id) filter (where id is not null), '{}') into v_keep from incoming;
  delete from public.recipe_ingredients where recipe_id = v_id and not (id = any (v_keep));

  insert into public.recipe_ingredients as ri (
    id, recipe_id, household_id, position, section, quantity, quantity_max, unit, unit_code, name,
    preparation, original_text, is_optional, is_scalable)
  select coalesce(private.try_uuid(x ->> 'id'), gen_random_uuid()), v_id, v_household, (ord - 1)::int,
         nullif(x ->> 'section', ''), (x ->> 'quantity')::numeric, (x ->> 'quantity_max')::numeric,
         nullif(x ->> 'unit', ''), nullif(x ->> 'unit_code', ''), btrim(x ->> 'name'),
         nullif(x ->> 'preparation', ''), nullif(x ->> 'original_text', ''),
         coalesce((x ->> 'is_optional')::boolean, false), coalesce((x ->> 'is_scalable')::boolean, true)
  from jsonb_array_elements(coalesce(p_recipe -> 'ingredients', '[]')) with ordinality as t(x, ord)
  on conflict (id) do update set
    position = excluded.position, section = excluded.section, quantity = excluded.quantity,
    quantity_max = excluded.quantity_max, unit = excluded.unit, unit_code = excluded.unit_code,
    name = excluded.name, preparation = excluded.preparation,
    original_text = coalesce(excluded.original_text, ri.original_text),
    is_optional = excluded.is_optional, is_scalable = excluded.is_scalable
  where ri.recipe_id = v_id;

  -- ── Steps ──
  select coalesce(array_agg(private.try_uuid(x ->> 'id')) filter (where private.try_uuid(x ->> 'id') is not null), '{}')
    into v_keep from jsonb_array_elements(coalesce(p_recipe -> 'steps', '[]')) as t(x);
  delete from public.recipe_steps where recipe_id = v_id and not (id = any (v_keep));

  insert into public.recipe_steps as rs (id, recipe_id, household_id, position, section, body, timer_seconds)
  select coalesce(private.try_uuid(x ->> 'id'), gen_random_uuid()), v_id, v_household, (ord - 1)::int,
         nullif(x ->> 'section', ''), btrim(x ->> 'body'), (x ->> 'timer_seconds')::int
  from jsonb_array_elements(coalesce(p_recipe -> 'steps', '[]')) with ordinality as t(x, ord)
  on conflict (id) do update set
    position = excluded.position, section = excluded.section, body = excluded.body,
    timer_seconds = excluded.timer_seconds
  where rs.recipe_id = v_id;

  -- ── Tags (by name; created in the household on demand) ──
  if p_recipe ? 'tags' then
    delete from public.recipe_tags where recipe_id = v_id;
    for v_tag in select distinct btrim(value) from jsonb_array_elements_text(p_recipe -> 'tags') where btrim(value) <> '' loop
      select id into v_tag_id from public.tags where household_id = v_household and lower(btrim(name)) = lower(v_tag);
      if v_tag_id is null then
        insert into public.tags (household_id, name) values (v_household, v_tag) returning id into v_tag_id;
      end if;
      insert into public.recipe_tags (recipe_id, tag_id, household_id) values (v_id, v_tag_id, v_household)
      on conflict do nothing;
      v_tag_id := null;
    end loop;
  end if;

  return jsonb_build_object('id', v_id, 'version', (select version from public.recipes where id = v_id));
end
$$;
revoke all on function public.save_recipe(jsonb) from public, anon;
grant execute on function public.save_recipe(jsonb) to authenticated;

create or replace function public.get_recipe(p_recipe_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.recipe_core_document(r.id) || jsonb_build_object(
    'is_favorite', exists (select 1 from public.favorites f where f.recipe_id = r.id and f.user_id = (select auth.uid())),
    'notes_personal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'body', n.body, 'visibility', n.visibility, 'user_id', n.user_id,
        'author_name', (select pr.display_name from public.profiles pr where pr.id = n.user_id),
        'created_at', n.created_at, 'updated_at', n.updated_at) order by n.created_at)
      from public.recipe_notes n where n.recipe_id = r.id), '[]'::jsonb),
    'version_count', (select count(*) from public.recipe_versions v where v.recipe_id = r.id)
  )
  from public.recipes r
  where r.id = p_recipe_id
$$;
revoke all on function public.get_recipe(uuid) from public, anon;
grant execute on function public.get_recipe(uuid) to authenticated;

-- Bulk documents for the mobile offline cache (all recipes of a household
-- changed since a timestamp). Bounded to keep payloads sane.
create or replace function public.get_recipes_since(p_household_id uuid, p_since timestamptz default null, p_limit int default 200)
returns setof jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.get_recipe(r.id)
  from public.recipes r
  where r.household_id = p_household_id
    and (p_since is null or r.updated_at > p_since)
  order by r.updated_at
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;
revoke all on function public.get_recipes_since(uuid, timestamptz, int) from public, anon;
grant execute on function public.get_recipes_since(uuid, timestamptz, int) to authenticated;

create or replace function public.search_recipes(
  p_household_id uuid,
  p_query text default null,
  p_category_ids uuid[] default null,
  p_tag_ids uuid[] default null,
  p_difficulties public.recipe_difficulty[] default null,
  p_meal_types text[] default null,
  p_max_total_minutes int default null,
  p_max_prep_minutes int default null,
  p_favorites_only boolean default false,
  p_origin_person_id uuid default null,
  p_has_family_history boolean default false,
  p_ingredients text[] default null,
  p_include_archived boolean default false,
  p_sort text default 'relevance',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  household_id uuid,
  title text,
  description text,
  category_id uuid,
  category_name text,
  category_icon text,
  difficulty public.recipe_difficulty,
  servings int,
  yield_unit text,
  prep_minutes int,
  cook_minutes int,
  total_minutes int,
  meal_types text[],
  origin_text text,
  origin_person_name text,
  legacy_author text,
  cover_path text,
  is_favorite boolean,
  has_story boolean,
  archived_at timestamptz,
  updated_at timestamptz,
  rank real,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(btrim(p_query), '') as raw,
           case when nullif(btrim(p_query), '') is null then null
                else websearch_to_tsquery('danish', extensions.unaccent(btrim(p_query))) end as ts,
           lower(btrim(coalesce(p_query, ''))) as lower_raw
  ),
  base as (
    select r.*,
      exists (select 1 from public.favorites f where f.recipe_id = r.id and f.user_id = (select auth.uid())) as fav,
      case when q.raw is null then 0::real
           else (ts_rank(r.search_vector, q.ts) * 2
                 + extensions.similarity(lower(r.title), q.lower_raw)
                 + case when lower(r.title) like q.lower_raw || '%' then 1 else 0 end)::real
      end as score
    from public.recipes r, q
    where r.household_id = p_household_id
      and (p_include_archived or r.archived_at is null)
      and (q.raw is null
           or r.search_vector @@ q.ts
           or lower(r.title) like '%' || q.lower_raw || '%'
           or extensions.similarity(lower(r.title), q.lower_raw) > 0.3
           or exists (select 1 from public.recipe_ingredients i
                      where i.recipe_id = r.id and i.name_normalized like '%' || q.lower_raw || '%'))
      and (p_category_ids is null or cardinality(p_category_ids) = 0 or r.category_id = any (p_category_ids))
      and (p_difficulties is null or cardinality(p_difficulties) = 0 or r.difficulty = any (p_difficulties))
      and (p_meal_types is null or cardinality(p_meal_types) = 0 or r.meal_types && p_meal_types)
      and (p_max_total_minutes is null
           or coalesce(r.total_minutes, coalesce(r.prep_minutes, 0) + coalesce(r.cook_minutes, 0)) <= p_max_total_minutes)
      and (p_max_prep_minutes is null or coalesce(r.prep_minutes, 0) <= p_max_prep_minutes)
      and (p_origin_person_id is null or r.origin_person_id = p_origin_person_id
           or exists (select 1 from public.recipe_stories s where s.recipe_id = r.id and s.person_id = p_origin_person_id))
      and (not p_has_family_history
           or r.origin_person_id is not null or r.origin_text is not null
           or exists (select 1 from public.recipe_stories s where s.recipe_id = r.id)
           or exists (select 1 from public.recipe_media m where m.recipe_id = r.id and m.kind in ('original_scan', 'historical_photo')))
      and (p_tag_ids is null or cardinality(p_tag_ids) = 0
           or (select count(distinct rt.tag_id) from public.recipe_tags rt
               where rt.recipe_id = r.id and rt.tag_id = any (p_tag_ids)) = cardinality(p_tag_ids))
      and (p_ingredients is null or cardinality(p_ingredients) = 0
           or not exists (
             select 1 from unnest(p_ingredients) as wanted(term)
             where private.normalize_text(wanted.term) is not null
               and not exists (select 1 from public.recipe_ingredients i
                               where i.recipe_id = r.id
                                 and i.name_normalized like '%' || private.normalize_text(wanted.term) || '%')))
  ),
  filtered as (
    select * from base where (not p_favorites_only or fav)
  )
  select f.id, f.household_id, f.title, f.description, f.category_id,
         c.name, c.icon, f.difficulty, f.servings, f.yield_unit, f.prep_minutes, f.cook_minutes,
         f.total_minutes, f.meal_types, f.origin_text,
         (select p.name from public.people p where p.id = f.origin_person_id),
         f.legacy_author,
         (select m.storage_path from public.recipe_media m
          where m.recipe_id = f.id and m.kind = 'photo' and m.mime_type like 'image/%'
          order by m.is_cover desc, m.position, m.created_at limit 1),
         f.fav,
         exists (select 1 from public.recipe_stories s where s.recipe_id = f.id),
         f.archived_at, f.updated_at, f.score,
         count(*) over ()
  from filtered f
  left join public.categories c on c.id = f.category_id
  order by
    case when p_sort = 'relevance' and (select raw from q) is not null then f.score end desc nulls last,
    case when p_sort = 'updated' then f.updated_at end desc nulls last,
    case when p_sort = 'time' then coalesce(f.total_minutes, coalesce(f.prep_minutes, 0) + coalesce(f.cook_minutes, 0)) end asc nulls last,
    lower(f.title) asc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.search_recipes(uuid, text, uuid[], uuid[], public.recipe_difficulty[], text[], int, int, boolean, uuid, boolean, text[], boolean, text, int, int) from public, anon;
grant execute on function public.search_recipes(uuid, text, uuid[], uuid[], public.recipe_difficulty[], text[], int, int, boolean, uuid, boolean, text[], boolean, text, int, int) to authenticated;

create or replace function public.set_favorite(p_recipe_id uuid, p_favorite boolean)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
begin
  select household_id into v_household from public.recipes where id = p_recipe_id;
  if v_household is null then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if p_favorite then
    insert into public.favorites (user_id, recipe_id, household_id)
    values (auth.uid(), p_recipe_id, v_household)
    on conflict do nothing;
  else
    delete from public.favorites where user_id = auth.uid() and recipe_id = p_recipe_id;
  end if;
  return p_favorite;
end
$$;
revoke all on function public.set_favorite(uuid, boolean) from public, anon;
grant execute on function public.set_favorite(uuid, boolean) to authenticated;

create or replace function public.set_recipe_archived(p_recipe_id uuid, p_archived boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.recipes set archived_at = case when p_archived then now() else null end
  where id = p_recipe_id;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end
$$;
revoke all on function public.set_recipe_archived(uuid, boolean) from public, anon;
grant execute on function public.set_recipe_archived(uuid, boolean) to authenticated;

-- ─── Hardening: anon gets nothing in public ──────────────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
-- recipe_versions is append-only through private.snapshot_recipe.
revoke insert, update, delete on public.recipe_versions from authenticated;
-- units is reference data.
revoke insert, update, delete on public.units from authenticated;
