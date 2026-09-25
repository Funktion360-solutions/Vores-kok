begin;
\ir _helpers.psql

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_household('H1') as h1 \gset
select public.create_household_invite(:'h1', 'viewer') as tc \gset
select (public.save_recipe(jsonb_build_object('household_id', :'h1', 'title', 'Lasagne', 'servings', 4)) ->> 'id') as r1 \gset

-- Default pantry locations are created with the household
select pg_temp.ok((select count(*) from public.pantry_locations where household_id = :'h1') = 5, 'default pantry locations');
select id as fridge from public.pantry_locations where household_id = :'h1' and kind = 'fridge' \gset

-- Meal plan
insert into public.meal_plan_entries (household_id, plan_date, slot, recipe_id, servings) values (:'h1', '2026-09-28', 'dinner', :'r1', 6) returning id as e1 \gset
insert into public.meal_plan_entries (household_id, plan_date, slot, title) values (:'h1', '2026-09-29', 'dinner', 'Rester');
select pg_temp.throws(format($$insert into public.meal_plan_entries (household_id, plan_date) values (%L, '2026-09-30')$$, :'h1'), '23514', 'entry needs recipe or title');
-- Deleting the recipe keeps the entry with a readable title
delete from public.recipes where id = :'r1';
select pg_temp.ok((select title from public.meal_plan_entries where id = :'e1') = 'Lasagne', 'plan entry keeps title after recipe deletion');

-- Shopping
insert into public.shopping_lists (household_id, name) values (:'h1', 'Ugens indkøb') returning id as l1 \gset
select public.upsert_shopping_items(:'l1', jsonb_build_array(
  jsonb_build_object('id', '11111111-1111-4111-8111-111111111111', 'name', 'kartofler', 'quantity', 1.25, 'unit', 'kg', 'unit_code', 'kg', 'category', 'produce'),
  jsonb_build_object('name', 'mælk', 'category', 'dairy')));
select pg_temp.ok((select count(*) from public.shopping_list_items where list_id = :'l1') = 2, 'items upserted');
-- Replaying the same client id is idempotent (offline outbox)
select public.upsert_shopping_items(:'l1', jsonb_build_array(jsonb_build_object('id', '11111111-1111-4111-8111-111111111111', 'name', 'kartofler', 'quantity', 2, 'unit', 'kg', 'unit_code', 'kg', 'category', 'produce')));
select pg_temp.ok((select quantity from public.shopping_list_items where id = '11111111-1111-4111-8111-111111111111') = 2, 'upsert updates by id');
select pg_temp.ok((select count(*) from public.shopping_list_items where list_id = :'l1') = 2, 'no duplicate on replay');
select pg_temp.throws(format($$select public.upsert_shopping_items(%L, '[{"name":"x","category":"DROP TABLE"}]')$$, :'l1'), '23514', 'category is validated');

-- Pantry
insert into public.pantry_items (household_id, location_id, name, quantity, unit, unit_code, best_before) values (:'h1', :'fridge', 'Mælk', 1, 'l', 'l', current_date + 2);
select pg_temp.ok((select name_normalized from public.pantry_items where household_id = :'h1') = 'mælk', 'pantry name normalized');

-- Viewer: reads everything, may tick items, may not edit
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_household_invite(:'tc');
select pg_temp.ok((select count(*) from public.meal_plan_entries) = 2, 'viewer reads plan');
select public.set_shopping_item_checked('11111111-1111-4111-8111-111111111111', true);
select pg_temp.logout();
select pg_temp.ok((select checked and checked_by = '00000000-0000-0000-0000-00000000000c' from public.shopping_list_items where id = '11111111-1111-4111-8111-111111111111'), 'viewer ticked item, checked_by stamped');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
update public.shopping_list_items set name = 'hacked' where list_id = :'l1';
select pg_temp.ok((select count(*) from public.shopping_list_items where name = 'hacked') = 0, 'viewer cannot edit items');
select pg_temp.throws(format($$insert into public.pantry_items (household_id, location_id, name) values (%L, %L, 'x')$$, :'h1', :'fridge'), '42501', 'viewer cannot add pantry items');
select pg_temp.throws(format($$select public.upsert_shopping_items(%L, '[{"name":"x"}]')$$, :'l1'), '42501', 'viewer cannot upsert items');

-- Outsider sees and changes nothing
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.create_household('H2') as h2 \gset
select pg_temp.ok((select count(*) from public.shopping_list_items) = 0, 'outsider sees no items');
select pg_temp.ok((select count(*) from public.pantry_locations where household_id = :'h1') = 0, 'outsider sees no pantry');
select pg_temp.ok((select count(*) from public.pantry_locations) = 5, 'outsider has own default locations');
select pg_temp.throws($$select public.set_shopping_item_checked('11111111-1111-4111-8111-111111111111', false)$$, '42501', 'outsider cannot tick');
select pg_temp.throws(format($$select public.upsert_shopping_items(%L, '[{"name":"x"}]')$$, :'l1'), 'P0002', 'outsider cannot see list');
select pg_temp.throws(format($$insert into public.shopping_list_items (list_id, household_id, name) values (%L, %L, 'x')$$, :'l1', :'h2'), '23503', 'composite FK blocks cross-household item');
select pg_temp.throws(format($$insert into public.meal_plan_entries (household_id, plan_date, title) values (%L, '2026-10-01', 'x')$$, :'h1'), '42501', 'outsider cannot plan in other household');
select pg_temp.logout();
rollback;
