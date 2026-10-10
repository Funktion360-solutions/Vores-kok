-- All fixtures and writes roll back. No real recipes are imported or published.
begin;
insert into auth.users(id,email) values
 ('a1111111-1111-4111-8111-111111111111','am-editor-test@example.invalid'),
 ('a2222222-2222-4222-8222-222222222222','am-other-test@example.invalid'),
 ('a3333333-3333-4333-8333-333333333333','am-reader-test@example.invalid');
insert into public.am_publishers(user_id) values('a1111111-1111-4111-8111-111111111111'),('a2222222-2222-4222-8222-222222222222');
insert into public.households(id,name,created_by) values('a4444444-4444-4444-8444-444444444444','AM test kitchen','a1111111-1111-4111-8111-111111111111');
insert into public.household_members(household_id,user_id,role) values('a4444444-4444-4444-8444-444444444444','a1111111-1111-4111-8111-111111111111','owner');
insert into storage.objects(bucket_id,name) values ('akselsmad-photos','a1111111-1111-4111-8111-111111111111/a5555555-5555-4555-8555-555555555555.jpg'),('akselsmad-photos','a1111111-1111-4111-8111-111111111111/a6666666-6666-4666-8666-666666666666.jpg');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$
declare recipe_id uuid; draft_id uuid; copied uuid; c jsonb; v int;
begin
 recipe_id=(public.save_recipe('{"household_id":"a4444444-4444-4444-8444-444444444444","title":"AM test bread","description":"Public introduction","servings":4,"notes":"PRIVATE NOTES MUST NOT EXPORT","origin_text":"PRIVATE ORIGIN","source_text":"PRIVATE ORIGINAL","ingredients":[{"name":"mel","quantity":500,"unit":"g"}],"steps":[{"body":"Bland og bag","timer_seconds":600}]}'::jsonb)->>'id')::uuid;
 perform set_config('am.test.recipe',recipe_id::text,true);
 draft_id=public.am_import_recipe(recipe_id);
 perform set_config('am.test.draft',draft_id::text,true);
 if public.am_import_recipe(recipe_id)<>draft_id then raise exception 'duplicate import created another draft'; end if;
 select content into c from public.am_drafts where id=draft_id;
 if c::text like '%PRIVATE%' or c ? 'source_text' or c ? 'household_id' or c ? 'media' or c ? 'stories' then raise exception 'private data leaked to draft'; end if;
 if private.am_valid_content('{}') then raise exception 'empty document accepted'; end if;
 if private.am_valid_content(c||'{"stories":[]}'::jsonb) then raise exception 'unexpected fields accepted'; end if;
 if private.am_valid_content(jsonb_set(c,'{ingredients,0,source_id}','"private"')) then raise exception 'nested private fields accepted'; end if;
 if exists(select 1 from public.am_recipes where id=draft_id) then raise exception 'import published automatically'; end if;
 begin perform public.am_publish(draft_id,1,false);raise exception 'approval bypass';exception when invalid_parameter_value then null;end;
 c=c||jsonb_build_object('cover_path','a1111111-1111-4111-8111-111111111111/a5555555-5555-4555-8555-555555555555.jpg');
 update public.am_drafts set content=c where id=draft_id;
 perform public.am_publish(draft_id,1,true);
 c=jsonb_set(c,'{title}','"AM edited bread"');
 perform public.am_save_draft(draft_id,'am-test-edited-bread',c,1);
 if (select content->>'title' from public.am_recipes where id=draft_id)<>'AM test bread' then raise exception 'draft edit changed public snapshot'; end if;
 begin perform public.am_save_draft(draft_id,'am-test-edited-bread',c,1);raise exception 'stale save accepted';exception when sqlstate 'VK409' then null;end;
 begin perform public.am_publish(draft_id,1,true);raise exception 'stale publication accepted';exception when sqlstate 'VK409' then null;end;
 perform public.am_publish(draft_id,2,true);
 copied=public.am_copy_to_kitchen(draft_id,'a4444444-4444-4444-8444-444444444444');
 if (select title from public.recipes where id=copied)<>'AM edited bread' then raise exception 'copy not created'; end if;
 if (select source_name from public.recipes where id=copied)<>'AkselsMad' then raise exception 'copy source missing'; end if;
 if (select count(*) from public.recipe_ingredients i where i.recipe_id=copied)<>1 then raise exception 'copy ingredients missing';end if;
end $$;
-- Another publisher cannot read/import the first publisher's private kitchen.
select set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.am_drafts where id=current_setting('am.test.draft')::uuid) then raise exception 'cross publisher draft exposure';end if;
 begin perform public.am_import_recipe(current_setting('am.test.recipe')::uuid);raise exception 'cross household import';exception when insufficient_privilege then null;end;
 begin perform public.am_publish(current_setting('am.test.draft')::uuid,2,true);raise exception 'cross publisher publication';exception when insufficient_privilege then null;end;
 begin perform public.am_copy_to_kitchen(current_setting('am.test.draft')::uuid,'a4444444-4444-4444-8444-444444444444');raise exception 'copy to foreign kitchen';exception when insufficient_privilege then null;end;
end $$;
-- A normal signed-in reader cannot create or publish drafts.
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 begin perform public.am_import_recipe(current_setting('am.test.recipe')::uuid);raise exception 'reader can import';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.am_drafts) then raise exception 'reader sees drafts';end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if not exists(select 1 from public.am_recipes where id=current_setting('am.test.draft')::uuid and content->>'title'='AM edited bread') then raise exception 'published recipe not public';end if;
 if (select count(*) from storage.objects where bucket_id='akselsmad-photos' and name like 'a1111111-1111-4111-8111-111111111111/%')<>1 then raise exception 'public image permissions incorrect';end if;
 begin perform 1 from public.am_drafts;raise exception 'anonymous draft exposure';exception when insufficient_privilege then null;end;
 begin perform public.am_import_recipe(current_setting('am.test.recipe')::uuid);raise exception 'anonymous import';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
update public.am_recipes set visible=false where id=current_setting('am.test.draft')::uuid;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin if exists(select 1 from public.am_recipes where id=current_setting('am.test.draft')::uuid) then raise exception 'withdrawn recipe still public';end if;
 if exists(select 1 from storage.objects where bucket_id='akselsmad-photos' and name like 'a1111111-1111-4111-8111-111111111111/%') then raise exception 'withdrawn photo visible';end if;end $$;
rollback;
