-- ═════════════════════════════════════════════════════════════════════════════
-- Covering indexes for foreign keys (Supabase performance advisor 0001).
-- Composite (parent_id, household_id) FKs get composite indexes; they replace
-- the earlier single-column indexes that did not fully cover the FK.
-- Also locks down a platform helper flagged by the security advisor.
-- ═════════════════════════════════════════════════════════════════════════════

drop index if exists public.favorites_recipe_idx;
create index favorites_recipe_household_idx on public.favorites (recipe_id, household_id);

create index recipe_ingredients_recipe_household_idx on public.recipe_ingredients (recipe_id, household_id);
create index recipe_ingredients_unit_code_idx on public.recipe_ingredients (unit_code);
create index recipe_steps_recipe_household_idx on public.recipe_steps (recipe_id, household_id);

drop index if exists public.recipe_tags_tag_idx;
create index recipe_tags_tag_household_idx on public.recipe_tags (tag_id, household_id);
create index recipe_tags_recipe_household_idx on public.recipe_tags (recipe_id, household_id);

drop index if exists public.recipe_media_recipe_idx;
drop index if exists public.recipe_media_story_idx;
create index recipe_media_recipe_household_idx on public.recipe_media (recipe_id, household_id, position);
create index recipe_media_story_household_idx on public.recipe_media (story_id, household_id);
create index recipe_media_created_by_idx on public.recipe_media (created_by);

drop index if exists public.recipe_notes_recipe_idx;
create index recipe_notes_recipe_household_idx on public.recipe_notes (recipe_id, household_id);

drop index if exists public.recipe_stories_recipe_idx;
drop index if exists public.recipe_stories_person_idx;
create index recipe_stories_recipe_household_idx on public.recipe_stories (recipe_id, household_id);
create index recipe_stories_person_household_idx on public.recipe_stories (person_id, household_id);
create index recipe_stories_created_by_idx on public.recipe_stories (created_by);

create index recipe_versions_recipe_household_idx on public.recipe_versions (recipe_id, household_id);
create index recipe_versions_created_by_idx on public.recipe_versions (created_by);

drop index if exists public.recipes_category_idx;
drop index if exists public.recipes_origin_person_idx;
create index recipes_category_household_idx on public.recipes (category_id, household_id);
create index recipes_origin_person_household_idx on public.recipes (origin_person_id, household_id);
create index recipes_created_by_idx on public.recipes (created_by);
create index recipes_updated_by_idx on public.recipes (updated_by);

create index households_created_by_idx on public.households (created_by);
create index household_members_invited_by_idx on public.household_members (invited_by);
create index household_invites_created_by_idx on public.household_invites (created_by);
create index household_invites_accepted_by_idx on public.household_invites (accepted_by);
create index people_created_by_idx on public.people (created_by);

-- Supabase's optional "auto-enable RLS" event-trigger helper is created in
-- `public` on some projects and is then reachable via /rest/v1/rpc. Event
-- triggers do not need EXECUTE for API roles, so revoke it.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
