begin;
\ir _helpers.psql

-- Setup: Anna owner of H1, Bo member, Clara viewer; Dennis owns H2.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_household('H1') as h1 \gset
select public.create_household_invite(:'h1', 'member') as tb \gset
select public.create_household_invite(:'h1', 'viewer') as tc \gset
insert into public.categories (household_id, name, icon) values (:'h1', 'Brød & Bagværk', 'bread') returning id as cat \gset
insert into public.people (household_id, name, relation, birth_year) values (:'h1', 'Oldemor Karen', 'Oldemor', 1921) returning id as karen \gset
select pg_temp.login('00000000-0000-0000-0000-00000000000b'); select public.accept_household_invite(:'tb');
select pg_temp.login('00000000-0000-0000-0000-00000000000c'); select public.accept_household_invite(:'tc');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.create_household('H2') as h2 \gset

-- Bo (member) creates a recipe
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select (public.save_recipe(jsonb_build_object(
  'household_id', :'h1',
  'title', 'Kanelsnegle',
  'category_id', :'cat',
  'servings', 16, 'yield_unit', 'stk',
  'prep_minutes', 45, 'cook_minutes', 60,
  'difficulty', 'medium',
  'origin_person_id', :'karen',
  'meal_types', jsonb_build_array('baking'),
  'ingredients', jsonb_build_array(
     jsonb_build_object('quantity', 500, 'unit', 'g', 'unit_code', 'g', 'name', 'hvedemel', 'original_text', '500 g hvedemel'),
     jsonb_build_object('quantity', 2.5, 'unit', 'dl', 'unit_code', 'dl', 'name', 'mælk', 'original_text', '2½ dl mælk'),
     jsonb_build_object('name', 'Kanel', 'section', 'Fyld')),
  'steps', jsonb_build_array(jsonb_build_object('body', 'Opløs gæren i lun mælk.'),
                             jsonb_build_object('body', 'Bag ved 200°C.', 'timer_seconds', 900)),
  'tags', jsonb_build_array('jul', 'Klassiker', 'jul')
)) ->> 'id') as r1 \gset

select pg_temp.ok((select created_by from public.recipes where id = :'r1') = '00000000-0000-0000-0000-00000000000b', 'created_by stamped');
select pg_temp.ok((select count(*) from public.recipe_ingredients where recipe_id = :'r1') = 3, '3 ingredients');
select pg_temp.ok((select string_agg(name, ',' order by position) from public.recipe_ingredients where recipe_id = :'r1') = 'hvedemel,mælk,Kanel', 'ingredient order kept');
select pg_temp.ok((select name_normalized from public.recipe_ingredients where recipe_id = :'r1' and position = 2) = 'kanel', 'normalized name');
select pg_temp.ok((select count(*) from public.recipe_tags where recipe_id = :'r1') = 2, 'tags deduplicated');
select pg_temp.ok((select search_vector is not null from public.recipes where id = :'r1'), 'search vector built');

-- get_recipe document
select public.get_recipe(:'r1') as doc \gset
select pg_temp.ok((:'doc'::jsonb ->> 'title') = 'Kanelsnegle', 'doc title');
select pg_temp.ok(jsonb_array_length(:'doc'::jsonb -> 'ingredients') = 3, 'doc ingredients');
select pg_temp.ok((:'doc'::jsonb -> 'origin_person' ->> 'name') = 'Oldemor Karen', 'doc origin person');
select pg_temp.ok((:'doc'::jsonb -> 'category' ->> 'name') = 'Brød & Bagværk', 'doc category');

-- Update with optimistic concurrency; ingredient ids retained
select id as ing_mel from public.recipe_ingredients where recipe_id = :'r1' and position = 0 \gset
select public.save_recipe(jsonb_build_object(
  'id', :'r1', 'expected_version', 1, 'title', 'Mormors kanelsnegle', 'servings', 16,
  'ingredients', jsonb_build_array(jsonb_build_object('id', :'ing_mel', 'quantity', 550, 'unit', 'g', 'name', 'hvedemel')),
  'steps', jsonb_build_array(jsonb_build_object('body', 'Ælt.'))
));
select pg_temp.ok((select version from public.recipes where id = :'r1') = 2, 'version bumped');
select pg_temp.ok((select count(*) from public.recipe_versions where recipe_id = :'r1') = 1, 'previous version snapshotted');
select pg_temp.ok((select snapshot ->> 'title' from public.recipe_versions where recipe_id = :'r1' and version = 1) = 'Kanelsnegle', 'snapshot has old title');
select pg_temp.ok((select id from public.recipe_ingredients where recipe_id = :'r1') = :'ing_mel', 'ingredient id kept');
select pg_temp.ok((select original_text from public.recipe_ingredients where id = :'ing_mel') = '500 g hvedemel', 'original_text preserved on edit');
select pg_temp.ok((select count(*) from public.recipe_steps where recipe_id = :'r1') = 1, 'removed steps deleted');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('id', %L, 'expected_version', 1, 'title', 'Stale'))$$, :'r1'),
  'VK409', 'stale version rejected');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('household_id', %L, 'title', ''))$$, :'h1'),
  '23514', 'empty title rejected by constraint');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('household_id', %L, 'title', 'x', 'source_url', 'javascript:alert(1)'))$$, :'h1'),
  '23514', 'non-http source url rejected');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('household_id', %L, 'title', 'x', 'ingredients', jsonb_build_array(jsonb_build_object('name','x','quantity',-1))))$$, :'h1'),
  '23514', 'negative quantity rejected');

-- Members cannot move a recipe to another household
select pg_temp.throws(format($$update public.recipes set household_id = %L where id = %L$$, :'h2', :'r1'), '42501', 'household change blocked');
-- Members cannot hard-delete recipes
delete from public.recipes where id = :'r1';
select pg_temp.ok((select count(*) from public.recipes where id = :'r1') = 1, 'member cannot delete recipe');
-- But can archive
select public.set_recipe_archived(:'r1', true);
select pg_temp.ok((select archived_at is not null from public.recipes where id = :'r1'), 'member can archive');
select public.set_recipe_archived(:'r1', false);

-- Clara (viewer): read yes, write no
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.ok((select count(*) from public.recipes) = 1, 'viewer sees recipe');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('household_id', %L, 'title', 'Viewer opskrift'))$$, :'h1'),
  '42501', 'viewer cannot create recipe');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('id', %L, 'title', 'Viewer edit'))$$, :'r1'),
  '42501', 'viewer cannot edit recipe');
update public.recipe_ingredients set name = 'salt' where recipe_id = :'r1';
select pg_temp.ok((select name from public.recipe_ingredients where recipe_id = :'r1') = 'hvedemel', 'viewer cannot edit ingredients');
-- Viewer favorites + private notes
select public.set_favorite(:'r1', true);
select pg_temp.ok((select count(*) from public.favorites) = 1, 'viewer can favorite');
insert into public.recipe_notes (recipe_id, household_id, user_id, body) values (:'r1', :'h1', '00000000-0000-0000-0000-00000000000c', 'Min hemmelige note');
select pg_temp.throws(format($$insert into public.recipe_notes (recipe_id, household_id, user_id, body, visibility) values (%L, %L, '00000000-0000-0000-0000-00000000000c', 'Delt', 'household')$$, :'r1', :'h1'),
  '42501', 'viewer cannot share household note');
select pg_temp.throws(format($$insert into public.recipe_notes (recipe_id, household_id, user_id, body) values (%L, %L, '00000000-0000-0000-0000-00000000000b', 'Forged')$$, :'r1', :'h1'),
  '42501', 'cannot write note as another user');

-- Bo: does not see Clara's private note or favorite
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok((select count(*) from public.recipe_notes) = 0, 'private note hidden from others');
select pg_temp.ok((select count(*) from public.favorites) = 0, 'favorites are personal');
insert into public.recipe_notes (recipe_id, household_id, user_id, body, visibility) values (:'r1', :'h1', '00000000-0000-0000-0000-00000000000b', 'Brug mere kanel', 'household');
select pg_temp.ok((public.get_recipe(:'r1') ->> 'is_favorite')::boolean = false, 'bo has no favorite');

-- Dennis (outsider): nothing is visible or writable
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select count(*) from public.recipes) = 0, 'outsider sees no recipes');
select pg_temp.ok((select count(*) from public.recipe_ingredients) = 0, 'outsider sees no ingredients');
select pg_temp.ok((select count(*) from public.recipe_versions) = 0, 'outsider sees no versions');
select pg_temp.ok((select count(*) from public.recipe_notes) = 0, 'outsider sees no notes');
select pg_temp.ok((select count(*) from public.categories) = 0, 'outsider sees no categories');
select pg_temp.ok((select count(*) from public.people) = 0, 'outsider sees no people');
select pg_temp.ok(public.get_recipe(:'r1') is null, 'outsider get_recipe returns null');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1')) = 0, 'outsider search empty');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('id', %L, 'title', 'Stjålet'))$$, :'r1'), '', 'outsider cannot update via rpc');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('household_id', %L, 'title', 'Indbrud'))$$, :'h1'), '42501', 'outsider cannot create in other household');
-- IDOR: attach an ingredient to H1 recipe while claiming own household
select pg_temp.throws(format($$insert into public.recipe_ingredients (recipe_id, household_id, position, name) values (%L, %L, 9, 'gift')$$, :'r1', :'h2'),
  '23503', 'composite FK blocks cross-household child');
select pg_temp.throws(format($$insert into public.recipe_ingredients (recipe_id, household_id, position, name) values (%L, %L, 9, 'gift')$$, :'r1', :'h1'),
  '42501', 'RLS blocks writing into other household');
select pg_temp.throws(format($$select public.set_favorite(%L, true)$$, :'r1'), 'P0002', 'outsider cannot favorite (recipe invisible)');
select pg_temp.throws(format($$insert into public.favorites (user_id, recipe_id, household_id) values ('00000000-0000-0000-0000-00000000000d', %L, %L)$$, :'r1', :'h1'),
  '42501', 'outsider cannot insert favorite directly');
-- Outsider using own category id in a H1 recipe is impossible (not visible to him anyway)
-- Versions are append-only for clients
select pg_temp.throws(format($$insert into public.recipe_versions (recipe_id, household_id, version, snapshot) values (%L, %L, 99, '{}')$$, :'r1', :'h2'),
  '42501', 'cannot forge versions');

-- Cross-household category reference is rejected by composite FK
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
insert into public.categories (household_id, name) values (:'h2', 'Dennis kat') returning id as dcat \gset
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.throws(format($$select public.save_recipe(jsonb_build_object('id', %L, 'title', 'X', 'category_id', %L))$$, :'r1', :'dcat'),
  '23503', 'category from another household rejected');

-- Anna (owner) can delete; cascades remove children
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
delete from public.recipes where id = :'r1';
select pg_temp.ok((select count(*) from public.recipes) = 0, 'owner deleted recipe');
select pg_temp.logout();
select pg_temp.ok((select count(*) from public.recipe_ingredients where recipe_id = :'r1') = 0, 'ingredients cascaded');
select pg_temp.ok((select count(*) from public.recipe_versions where recipe_id = :'r1') = 0, 'versions cascaded');
rollback;
