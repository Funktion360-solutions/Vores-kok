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

-- Six additional public fixtures; no real recipes are published.
reset role;
insert into public.am_drafts(id,owner_id,slug,content)
select ('b0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a1111111-1111-4111-8111-111111111111','am-pdf-test-'||n,content
from generate_series(1,6) n cross join public.am_drafts d where d.id=current_setting('am.test.draft')::uuid;
insert into public.am_recipes(id,slug,content,published_revision)
select id,slug,content,1 from public.am_drafts where slug like 'am-pdf-test-%';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ declare n int;s jsonb;begin
 for n in 1..5 loop s=public.am_claim_pdf(('b0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,1);end loop;
 if s->>'used'<>'5' or s->>'remaining'<>'0' then raise exception 'quota counting wrong';end if;
 s=public.am_claim_pdf('b0000000-0000-4000-8000-000000000001',1);
 if s->>'used'<>'5' then raise exception 'repeat download counted twice';end if;
 begin perform public.am_claim_pdf('b0000000-0000-4000-8000-000000000006',1);raise exception 'sixth download allowed';exception when sqlstate 'VK429' then null;end;
 begin insert into public.am_pdf_downloads(user_id,recipe_id) values('a3333333-3333-4333-8333-333333333333','b0000000-0000-4000-8000-000000000006');raise exception 'direct API insert bypassed quota';exception when sqlstate 'VK429' then null;end;
 begin delete from public.am_pdf_downloads;raise exception 'quota reset allowed';exception when insufficient_privilege then null;end;
 begin update public.am_pdf_downloads set recipe_id='b0000000-0000-4000-8000-000000000006';raise exception 'history reassignment allowed';exception when insufficient_privilege then null;end;
end $$;
-- A different reader starts with a separate quota and cannot read others' history.
select set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ declare s jsonb;begin
 if exists(select 1 from public.am_pdf_downloads) then raise exception 'foreign PDF history exposure';end if;
 s=public.am_claim_pdf('b0000000-0000-4000-8000-000000000006',1);
 if s->>'used'<>'1' then raise exception 'quotas not separate';end if;
 begin insert into public.am_pdf_downloads(user_id,recipe_id) values('a3333333-3333-4333-8333-333333333333','b0000000-0000-4000-8000-000000000006');raise exception 'foreign ledger insertion';exception when insufficient_privilege then null;end;
 begin perform public.am_claim_pdf('b0000000-0000-4000-8000-000000000001',2);raise exception 'stale publication accepted';exception when sqlstate 'VK409' then null;end;
end $$;
-- A new edition of the same recipe costs no extra slot.
reset role;
update public.am_recipes set published_revision=2 where id='b0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 if public.am_claim_pdf('b0000000-0000-4000-8000-000000000001',2)->>'used'<>'5' then raise exception 'new edition charged twice';end if;
end $$;
reset role;
update public.am_recipes set visible=false where id='b0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 begin perform public.am_claim_pdf('b0000000-0000-4000-8000-000000000001',2);raise exception 'withdrawn recipe download';exception when invalid_parameter_value then null;end;
 if (select count(*) from public.am_pdf_downloads)<>5 then raise exception 'withdrawal freed a slot';end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 begin perform 1 from public.am_pdf_downloads;raise exception 'anonymous history access';exception when insufficient_privilege then null;end;
 begin perform public.am_claim_pdf('b0000000-0000-4000-8000-000000000006',1);raise exception 'anonymous download claim';exception when insufficient_privilege then null;end;
end $$;
rollback;
