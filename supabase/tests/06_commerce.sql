\set ON_ERROR_STOP 1
begin;
-- Shared helpers for SQL tests (included with \ir). Everything runs inside a
-- transaction that the test file rolls back.
set client_min_messages = warning;

create or replace function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
end $$;

-- Asserts that running p_sql raises an error whose SQLSTATE starts with p_state
-- (use '' to accept any error).
create or replace function pg_temp.throws(p_sql text, p_state text, p_msg text) returns void language plpgsql as $$
declare v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state like p_state || '%' then
      return;
    end if;
    raise exception 'ASSERTION FAILED: % (expected SQLSTATE %, got % )', p_msg, p_state, v_state;
  end;
  raise exception 'ASSERTION FAILED: % (expected error %, none raised)', p_msg, p_state;
end $$;

create or replace function pg_temp.count_rows(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into v;
  return v;
end $$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- Fixtures belong only to this rolled-back transaction.
insert into auth.users(id,email,raw_user_meta_data) values
 ('731fcbba-702b-444e-8616-000000000001','vk-test-owner@example.invalid','{}'),
 ('731fcbba-702b-444e-8616-000000000002','vk-test-other@example.invalid','{}'),
 ('731fcbba-702b-444e-8616-000000000003','vk-test-viewer@example.invalid','{}');
insert into public.households(id,name) values
 ('731fcbba-702b-444e-8616-000000000011','VK commerce test'),
 ('731fcbba-702b-444e-8616-000000000012','VK other test');
insert into public.household_members(household_id,user_id,role) values
 ('731fcbba-702b-444e-8616-000000000011','731fcbba-702b-444e-8616-000000000001','owner'),
 ('731fcbba-702b-444e-8616-000000000012','731fcbba-702b-444e-8616-000000000002','owner'),
 ('731fcbba-702b-444e-8616-000000000011','731fcbba-702b-444e-8616-000000000003','viewer');
insert into public.shopping_lists(id,household_id,name) values
 ('731fcbba-702b-444e-8616-000000000021','731fcbba-702b-444e-8616-000000000011','List'),
 ('731fcbba-702b-444e-8616-000000000022','731fcbba-702b-444e-8616-000000000012','Other list');
insert into public.shopping_list_items(id,list_id,household_id,name) values
 ('731fcbba-702b-444e-8616-000000000031','731fcbba-702b-444e-8616-000000000021','731fcbba-702b-444e-8616-000000000011','Mel'),
 ('731fcbba-702b-444e-8616-000000000032','731fcbba-702b-444e-8616-000000000022','731fcbba-702b-444e-8616-000000000012','Other flour');
insert into public.pantry_locations(id,household_id,name) values
 ('731fcbba-702b-444e-8616-000000000041','731fcbba-702b-444e-8616-000000000011','Pantry'),
 ('731fcbba-702b-444e-8616-000000000042','731fcbba-702b-444e-8616-000000000012','Other pantry');
select pg_temp.login('731fcbba-702b-444e-8616-000000000001');
insert into public.vk_shopping_prices(item_id,household_id,item_signature,store,total_ore)
 values('731fcbba-702b-444e-8616-000000000031','731fcbba-702b-444e-8616-000000000011','signature','Test',1995);
select pg_temp.throws($q$insert into public.vk_shopping_prices(item_id,household_id,item_signature,total_ore) values('731fcbba-702b-444e-8616-000000000032','731fcbba-702b-444e-8616-000000000011','bad',100)$q$,'42501','cannot attach another household item');
select pg_temp.throws($q$select public.vk_claim_offer_cache('2026-10-07')$q$,'42501','members cannot spend provider quota');
select pg_temp.throws('select * from public.vk_offer_cache','42501','shared provider cache is server-only');
select pg_temp.throws($q$select public.vk_save_commerce('731fcbba-702b-444e-8616-000000000051','731fcbba-702b-444e-8616-000000000011','receipt','{}')$q$,'P0001','missing lines rejected');
select public.vk_save_commerce('731fcbba-702b-444e-8616-000000000051','731fcbba-702b-444e-8616-000000000011','receipt',
 '{"store":"Test","currency":"DKK","lines":[{"id":"731fcbba-702b-444e-8616-000000000061","name":"Mel","quantity":1,"unit":"kg","kind":"product","pantry_location_id":"731fcbba-702b-444e-8616-000000000041"},{"id":"731fcbba-702b-444e-8616-000000000062","name":"Pant","kind":"deposit","pantry_location_id":"731fcbba-702b-444e-8616-000000000041"}]}');
select public.vk_save_commerce('731fcbba-702b-444e-8616-000000000051','731fcbba-702b-444e-8616-000000000011','receipt',
 '{"store":"Test","currency":"DKK","lines":[{"id":"731fcbba-702b-444e-8616-000000000061","name":"Mel","quantity":1,"unit":"kg","kind":"product","pantry_location_id":"731fcbba-702b-444e-8616-000000000041"},{"id":"731fcbba-702b-444e-8616-000000000062","name":"Pant","kind":"deposit","pantry_location_id":"731fcbba-702b-444e-8616-000000000041"}]}');
select pg_temp.ok((select count(*)=1 from public.pantry_items where household_id='731fcbba-702b-444e-8616-000000000011'),'retry does not duplicate food, pant not food');
select pg_temp.throws($q$select public.vk_save_commerce('731fcbba-702b-444e-8616-000000000052','731fcbba-702b-444e-8616-000000000011','receipt','{"currency":"DKK","lines":[{"id":"731fcbba-702b-444e-8616-000000000063","name":"Bad","kind":"product","pantry_location_id":"731fcbba-702b-444e-8616-000000000042"}]}')$q$,'P0001','foreign pantry rejected');
select pg_temp.ok(not exists(select 1 from public.vk_commerce_documents where id='731fcbba-702b-444e-8616-000000000052'),'failed pantry save rolls back receipt');
select pg_temp.login('731fcbba-702b-444e-8616-000000000003');
select pg_temp.ok((select count(*)=1 from public.vk_commerce_documents where household_id='731fcbba-702b-444e-8616-000000000011'),'viewer can read household receipt');
select pg_temp.throws($q$select public.vk_save_commerce('731fcbba-702b-444e-8616-000000000053','731fcbba-702b-444e-8616-000000000011','receipt','{"currency":"DKK","lines":[{}]}')$q$,'42501','viewer cannot import');
select pg_temp.login('731fcbba-702b-444e-8616-000000000002');
select pg_temp.ok((select count(*)=0 from public.vk_commerce_documents where household_id='731fcbba-702b-444e-8616-000000000011'),'outsider cannot read receipt');
select pg_temp.ok((select count(*)=0 from public.vk_shopping_prices where household_id='731fcbba-702b-444e-8616-000000000011'),'outsider cannot read prices');
select pg_temp.logout();
rollback;
select 'commerce SQL tests passed; fixtures rolled back' as result;
