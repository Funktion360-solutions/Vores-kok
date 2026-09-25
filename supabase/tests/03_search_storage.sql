begin;
\ir _helpers.psql

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_household('H1') as h1 \gset
select public.create_household_invite(:'h1', 'viewer') as tc \gset
insert into public.categories (household_id, name) values (:'h1', 'Kager') returning id as kager \gset
insert into public.categories (household_id, name) values (:'h1', 'Brød') returning id as brod \gset
insert into public.people (household_id, name) values (:'h1', 'Mormor') returning id as mormor \gset

select (public.save_recipe(jsonb_build_object('household_id', :'h1', 'title', 'Drømmekage', 'category_id', :'kager',
  'prep_minutes', 20, 'cook_minutes', 40, 'difficulty', 'easy', 'tags', jsonb_build_array('Kaffebord'),
  'ingredients', jsonb_build_array(jsonb_build_object('name','æg'), jsonb_build_object('name','kokos'), jsonb_build_object('name','brun farin')))) ->> 'id') as r_drom \gset
select (public.save_recipe(jsonb_build_object('household_id', :'h1', 'title', 'Rugbrød', 'category_id', :'brod',
  'prep_minutes', 20, 'cook_minutes', 70, 'total_minutes', 1440, 'difficulty', 'hard', 'origin_person_id', :'mormor',
  'ingredients', jsonb_build_array(jsonb_build_object('name','rugmel'), jsonb_build_object('name','kærnemælk'), jsonb_build_object('name','solsikkekerner')))) ->> 'id') as r_rug \gset
select (public.save_recipe(jsonb_build_object('household_id', :'h1', 'title', 'Franskbrød', 'category_id', :'brod',
  'prep_minutes', 30, 'cook_minutes', 120, 'difficulty', 'medium', 'description', 'Luftigt hvedebrød',
  'ingredients', jsonb_build_array(jsonb_build_object('name','hvedemel'), jsonb_build_object('name','gær')))) ->> 'id') as r_fransk \gset

select pg_temp.ok((select count(*) from public.search_recipes(:'h1')) = 3, 'no filter returns all');
select pg_temp.ok((select string_agg(title, ',') from public.search_recipes(:'h1')) = 'Drømmekage,Franskbrød,Rugbrød', 'alphabetical default');
select pg_temp.ok((select title from public.search_recipes(:'h1', 'rugbrød') limit 1) = 'Rugbrød', 'title search');
select pg_temp.ok((select title from public.search_recipes(:'h1', 'drømme') limit 1) = 'Drømmekage', 'prefix search');
select pg_temp.ok((select title from public.search_recipes(:'h1', 'kokos') limit 1) = 'Drømmekage', 'ingredient text search');
select pg_temp.ok((select title from public.search_recipes(:'h1', 'luftigt') limit 1) = 'Franskbrød', 'description search');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_category_ids => array[:'brod']::uuid[])) = 2, 'category filter');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_difficulties => array['easy']::public.recipe_difficulty[])) = 1, 'difficulty filter');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_max_total_minutes => 100)) = 1, 'time filter uses prep+cook or total');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_ingredients => array['rugmel','Kærnemælk'])) = 1, 'all ingredients must match');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_ingredients => array['rugmel','kokos'])) = 0, 'ingredient AND semantics');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_has_family_history => true)) = 1, 'family history filter');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_origin_person_id => :'mormor')) = 1, 'origin person filter');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_tag_ids => array[(select id from public.tags where name='Kaffebord')])) = 1, 'tag filter');
select public.set_favorite(:'r_rug', true);
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_favorites_only => true)) = 1, 'favorites filter');
select pg_temp.ok((select total_count from public.search_recipes(:'h1', p_limit => 1) limit 1) = 3, 'total_count with paging');
select public.set_recipe_archived(:'r_fransk', true);
select pg_temp.ok((select count(*) from public.search_recipes(:'h1')) = 2, 'archived hidden');
select pg_temp.ok((select count(*) from public.search_recipes(:'h1', p_include_archived => true)) = 3, 'archived included on request');
select pg_temp.ok((select count(*) from public.get_recipes_since(:'h1')) = 3, 'bulk docs for offline cache');

-- ─── Storage policies ───────────────────────────────────────────────────────
select format('%s/recipes/%s/%s.jpg', :'h1', :'r_drom', gen_random_uuid()) as okpath \gset
insert into storage.objects (bucket_id, name) values ('household-media', :'okpath');
select pg_temp.ok((select count(*) from storage.objects) = 1, 'member uploads valid path');
select pg_temp.throws(format($$insert into storage.objects (bucket_id, name) values ('household-media', %L)$$, :'h1' || '/evil.exe'),
  '42501', 'invalid path rejected');
select pg_temp.throws(format($$insert into storage.objects (bucket_id, name) values ('household-media', %L)$$, :'h1' || '/recipes/../../x.jpg'),
  '42501', 'path traversal rejected');
insert into public.recipe_media (recipe_id, household_id, kind, storage_path, mime_type, is_cover)
values (:'r_drom', :'h1', 'photo', :'okpath', 'image/jpeg', true);
select pg_temp.ok((select cover_path from public.search_recipes(:'h1', 'drømmekage') limit 1) = :'okpath', 'cover in search results');
select pg_temp.throws(format($$insert into public.recipe_media (recipe_id, household_id, storage_path, mime_type) values (%L, %L, 'other/x.jpg', 'image/jpeg')$$, :'r_drom', :'h1'),
  '23514', 'media path must be inside household');
select pg_temp.throws(format($$insert into public.recipe_media (recipe_id, household_id, storage_path, mime_type) values (%L, %L, %L, 'text/html')$$, :'r_drom', :'h1', :'h1' || '/x.html'),
  '23514', 'media mime whitelist');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_household_invite(:'tc');
select pg_temp.ok((select count(*) from storage.objects) = 1, 'viewer can read media');
select pg_temp.throws(format($$insert into storage.objects (bucket_id, name) values ('household-media', %L)$$,
  format('%s/recipes/%s/%s.jpg', :'h1', :'r_drom', gen_random_uuid())), '42501', 'viewer cannot upload');
delete from storage.objects;
select pg_temp.ok((select count(*) from storage.objects) = 1, 'viewer cannot delete media');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.create_household('H2') as h2 \gset
select pg_temp.ok((select count(*) from storage.objects) = 0, 'outsider cannot read media');
select pg_temp.throws(format($$insert into storage.objects (bucket_id, name) values ('household-media', %L)$$,
  format('%s/recipes/%s/%s.jpg', :'h1', :'r_drom', gen_random_uuid())), '42501', 'outsider cannot upload into other household');
update storage.objects set name = format('%s/recipes/%s/%s.jpg', :'h2', gen_random_uuid(), gen_random_uuid());
select pg_temp.logout();
select pg_temp.ok((select name from storage.objects) = :'okpath', 'outsider cannot move objects');
rollback;
