-- Synthetic fixtures only. The transaction rolls all effects back.
begin;
insert into auth.users(id,email) values('b1111111-1111-4111-8111-111111111111','am-article-editor@example.invalid'),('b2222222-2222-4222-8222-222222222222','am-article-other@example.invalid'),('b3333333-3333-4333-8333-333333333333','am-article-reader@example.invalid');
insert into public.am_publishers(user_id) values('b1111111-1111-4111-8111-111111111111'),('b2222222-2222-4222-8222-222222222222');
insert into storage.objects(bucket_id,name) values('akselsmad-editorial','b1111111-1111-4111-8111-111111111111/article.jpg');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ declare c jsonb; a uuid;begin
 c='{"title":"Test article","excerpt":"Introduction","category":"Bagning","cover_path":"b1111111-1111-4111-8111-111111111111/article.jpg","cover_alt":"Bread on a table","blocks":[{"type":"text","text":"## A guide\n\n**Details**"},{"type":"image","path":"b1111111-1111-4111-8111-111111111111/article.jpg","alt":"Bread","caption":"Own picture"}]}';
 if private.am_validate_article('{}') or private.am_validate_article(c-'title') or private.am_validate_article(c||'{"private_history":"no"}') or private.am_validate_article(jsonb_set(c,'{blocks,0}','{"type":"text"}')) then raise exception 'invalid content accepted';end if;
 if private.am_validate_article(jsonb_set(c,'{cover_path}','"b2222222-2222-4222-8222-222222222222/other.jpg"')) then raise exception 'foreign photo accepted';end if;
 a=public.am_save_article(null,'guide','am-editorial-test',c,0);perform set_config('am.article.id',a::text,true);
 if exists(select 1 from public.am_articles where id=a) then raise exception 'save published';end if;
 begin perform public.am_publish_article(a,1,false,null);raise exception 'approval bypass';exception when invalid_parameter_value then null;end;
 perform public.am_publish_article(a,1,true,now()+interval '1 day');
 c=jsonb_set(c,'{title}','"Updated draft"');perform public.am_save_article(a,'guide','am-editorial-test',c,1);
 if (select content->>'title' from public.am_articles where id=a)<>'Test article' then raise exception 'draft changed snapshot';end if;
 begin perform public.am_save_article(a,'guide','am-editorial-test',c,1);raise exception 'stale save accepted';exception when sqlstate 'VK409' then null;end;
 begin perform public.am_publish_article(a,1,true,null);raise exception 'stale publish accepted';exception when sqlstate 'VK409' then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if exists(select 1 from public.am_articles where id=current_setting('am.article.id')::uuid) then raise exception 'scheduled article leaked';end if;
 if exists(select 1 from storage.objects where bucket_id='akselsmad-editorial' and name like 'b1111111%') then raise exception 'scheduled photo leaked';end if;
 begin perform public.am_save_article(null,'guide','am-no','{}',0);raise exception 'anon RPC allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.am_article_drafts;raise exception 'anon drafts allowed';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.am_article_drafts where id=current_setting('am.article.id')::uuid) then raise exception 'foreign draft leaked';end if;
 begin perform public.am_publish_article(current_setting('am.article.id')::uuid,2,true,null);raise exception 'foreign publication allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.am_article_drafts) then raise exception 'reader drafts leaked';end if;
 begin perform public.am_save_article(null,'blog','am-reader','{}',0);raise exception 'reader write allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.am_publish_article(current_setting('am.article.id')::uuid,2,true,null);
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if (select content->>'title' from public.am_articles where id=current_setting('am.article.id')::uuid) is distinct from 'Updated draft' then raise exception 'published article missing';end if;
 if not exists(select 1 from storage.objects where bucket_id='akselsmad-editorial' and name='b1111111-1111-4111-8111-111111111111/article.jpg') then raise exception 'published photo unavailable';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
update public.am_articles set visible=false where id=current_setting('am.article.id')::uuid;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if exists(select 1 from public.am_articles where id=current_setting('am.article.id')::uuid) then raise exception 'withdrawn article leaked';end if;
 if exists(select 1 from storage.objects where bucket_id='akselsmad-editorial' and name='b1111111-1111-4111-8111-111111111111/article.jpg') then raise exception 'withdrawn photo leaked';end if;
end $$;
rollback;
