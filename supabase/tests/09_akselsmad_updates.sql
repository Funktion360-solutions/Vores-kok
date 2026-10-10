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

-- New imports are repeatable, shared across family editors, and linked privately.
do $$ declare v uuid; s jsonb; begin
 v=public.am_copy_to_kitchen(current_setting('am.test.draft')::uuid,'a4444444-4444-4444-8444-444444444444');
 perform set_config('am.test.copy',v::text,true);
 if public.am_copy_to_kitchen(current_setting('am.test.draft')::uuid,'a4444444-4444-4444-8444-444444444444')<>v then raise exception 'duplicate copy';end if;
 s=public.am_kitchen_status(v);
 if s->>'copied_revision'<>'2' or (s->>'modified')::boolean then raise exception 'initial linked state wrong';end if;
end $$;
-- Publish a newer version, but never update a private kitchen automatically.
do $$ declare d uuid:=current_setting('am.test.draft')::uuid;c jsonb;s jsonb;begin
 select content into c from public.am_drafts where id=d;
 perform public.am_save_draft(d,'am-test-bread',c||'{"title":"New public edition"}'::jsonb,2);
 perform public.am_publish(d,3,true);
 s=public.am_kitchen_status(current_setting('am.test.copy')::uuid);
 if s->>'public_revision'<>'3' or s->>'copied_revision'<>'2' then raise exception 'update not detected';end if;
 if (select title from public.recipes where id=current_setting('am.test.copy')::uuid)<>'AM edited bread' then raise exception 'automatic overwrite';end if;
 begin perform public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,3,1,false,false);raise exception 'approval bypass';exception when insufficient_privilege then null;end;
 begin perform public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,2,1,true,false);raise exception 'stale public revision';exception when sqlstate 'VK409' then null;end;
 perform public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,3,1,true,false);
 if (select title from public.recipes where id=current_setting('am.test.copy')::uuid)<>'New public edition' then raise exception 'approval did not update';end if;
 if (public.am_kitchen_status(current_setting('am.test.copy')::uuid)->>'modified')::boolean then raise exception 'refreshed fingerprint wrong';end if;
 if public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,3,2,true,true)<>current_setting('am.test.copy')::uuid then raise exception 'repeated approval duplicates';end if;
end $$;
-- A direct ingredient change is detected even without a version bump.
update public.recipe_ingredients set quantity=777 where recipe_id=current_setting('am.test.copy')::uuid;
do $$ declare d uuid:=current_setting('am.test.draft')::uuid;c jsonb;v uuid;begin
 select content into c from public.am_drafts where id=d;
 perform public.am_save_draft(d,'am-test-bread',c||'{"title":"Fourth public edition"}'::jsonb,3);
 perform public.am_publish(d,4,true);
 if not (public.am_kitchen_status(current_setting('am.test.copy')::uuid)->>'modified')::boolean then raise exception 'private child edit missed';end if;
 begin perform public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,4,2,true,false);raise exception 'private edit overwritten';exception when sqlstate 'VK412' then null;end;
 v=public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,4,2,true,true);
 if v=current_setting('am.test.copy')::uuid then raise exception 'new edition replaced old';end if;
 if (select quantity from public.recipe_ingredients where recipe_id=current_setting('am.test.copy')::uuid limit 1)<>777 then raise exception 'private quantities lost';end if;
 if public.am_copy_to_kitchen(d,'a4444444-4444-4444-8444-444444444444')<>v then raise exception 'copy did not select latest edition';end if;
 if public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,4,2,true,true)<>v then raise exception 'duplicate latest edition';end if;
end $$;
-- A foreign user cannot see private links or operate on this copy.
select set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.am_kitchen_links) then raise exception 'foreign kitchen links exposure';end if;
 if public.am_kitchen_status(current_setting('am.test.copy')::uuid) is not null then raise exception 'foreign status exposure';end if;
 begin perform public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,4,2,true,true);raise exception 'foreign refresh';exception when insufficient_privilege then null;end;
 begin perform public.am_copy_to_kitchen(current_setting('am.test.draft')::uuid,'a4444444-4444-4444-8444-444444444444');raise exception 'foreign copy';exception when insufficient_privilege then null;end;
end $$;
-- A household viewer can read a notice but cannot approve an update.
reset role;
insert into public.household_members(household_id,user_id,role) values('a4444444-4444-4444-8444-444444444444','a3333333-3333-4333-8333-333333333333','viewer');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 if public.am_kitchen_status(current_setting('am.test.copy')::uuid) is null then raise exception 'viewer cannot read notice';end if;
 begin perform public.am_refresh_kitchen_copy(current_setting('am.test.copy')::uuid,4,2,true,true);raise exception 'viewer refresh';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
update public.am_recipes set visible=false where id=current_setting('am.test.draft')::uuid;
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ declare s jsonb;begin
 s=public.am_kitchen_status(current_setting('am.test.copy')::uuid);
 if (s->>'available')::boolean or s->>'title' is not null or s->>'slug' is not null then raise exception 'withdrawn public content exposed';end if;
 if not exists(select 1 from public.recipes where id=current_setting('am.test.copy')::uuid) then raise exception 'private copy removed by withdrawal';end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 begin perform 1 from public.am_kitchen_links;raise exception 'anonymous links';exception when insufficient_privilege then null;end;
 begin perform public.am_kitchen_status(current_setting('am.test.copy')::uuid);raise exception 'anonymous status';exception when insufficient_privilege then null;end;
end $$;
rollback;
