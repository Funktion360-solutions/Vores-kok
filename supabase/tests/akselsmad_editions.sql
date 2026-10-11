-- Isolated regression checks. All test users and content are rolled back.
begin;
select set_config('test.edition_owner',gen_random_uuid()::text,true),set_config('test.edition_other',gen_random_uuid()::text,true),set_config('test.chapter',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.edition_owner')::uuid,'edition-owner-'||current_setting('test.edition_owner')||'@example.invalid'),(current_setting('test.edition_other')::uuid,'edition-other-'||current_setting('test.edition_other')||'@example.invalid');
insert into public.am_publishers(user_id) values(current_setting('test.edition_owner')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.edition_owner'),true);
set local role authenticated;
do $$
declare c jsonb; v_id uuid; saved jsonb; key text=current_setting('test.chapter');
begin
 c=jsonb_build_object('title','Italiensk middag','excerpt','','intro','Velkommen til mit køkken','category','Gæstemad','chapters',jsonb_build_array(jsonb_build_object('key',key,'title','Pasta','intro','Begynd med saucen.','items','[]'::jsonb)));
 v_id=public.am_edit_edition(null,'course','test-'||gen_random_uuid(),c,0,'save',false);
 perform set_config('test.edition_id',v_id::text,true);
 if exists(select 1 from public.am_editions where am_editions.id=v_id) then raise exception 'draft was public';end if;
 begin perform public.am_edit_edition(v_id,null,null,null,1,'publish',false);raise exception 'missing approval accepted';exception when raise_exception then if sqlerrm='missing approval accepted' then raise;end if;end;
 perform public.am_edit_edition(v_id,null,null,null,1,'publish',true);
 insert into public.am_course_progress(user_id,edition_id,chapter_key) values(auth.uid(),v_id,key::uuid);
 if not exists(select 1 from public.am_course_progress where edition_id=v_id) then raise exception 'progress missing';end if;
 saved=c;c=jsonb_set(c,'{title}','"Ny kladdetitel"'::jsonb);
 perform public.am_edit_edition(v_id,'course',(select slug from public.am_edition_drafts d where d.id=v_id),c,1,'save',false);
 if (select content from public.am_editions e where e.id=v_id)<>saved then raise exception 'unsaved publication changed';end if;
 begin perform public.am_edit_edition(v_id,'course','stale',c,1,'save',false);raise exception 'stale revision accepted';exception when sqlstate 'VK409' then null;end;
 begin insert into public.am_course_progress(user_id,edition_id,chapter_key) values(auth.uid(),v_id,gen_random_uuid());raise exception 'unknown chapter accepted';exception when insufficient_privilege then null;end;
 c=jsonb_set(c,'{chapters,0,items}',jsonb_build_array(jsonb_build_object('type','recipe','id',gen_random_uuid()::text)));
 perform public.am_edit_edition(v_id,'course',(select slug from public.am_edition_drafts d where d.id=v_id),c,2,'save',false);
 begin perform public.am_edit_edition(v_id,null,null,null,3,'publish',true);raise exception 'private recipe accepted';exception when sqlstate 'VK422' then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.edition_other'),true);
do $$ declare affected integer;begin
 if exists(select 1 from public.am_edition_drafts) then raise exception 'other user can read drafts';end if;
 if exists(select 1 from public.am_course_progress) then raise exception 'other user can read progress';end if;
 update public.am_editions set visible=false where id=current_setting('test.edition_id')::uuid;get diagnostics affected=row_count;if affected<>0 then raise exception 'nonpublisher can hide edition';end if;
 begin perform public.am_edit_edition(current_setting('test.edition_id')::uuid,null,null,null,3,'unpublish',false);raise exception 'nonpublisher RPC accepted';exception when insufficient_privilege then null;end;
 begin insert into public.am_course_progress(user_id,edition_id,chapter_key) values(current_setting('test.edition_owner')::uuid,current_setting('test.edition_id')::uuid,current_setting('test.chapter')::uuid);raise exception 'other user can write progress';exception when insufficient_privilege then null;end;
 insert into public.am_course_progress(user_id,edition_id,chapter_key) values(auth.uid(),current_setting('test.edition_id')::uuid,current_setting('test.chapter')::uuid) on conflict(user_id,edition_id,chapter_key) do nothing;
 insert into public.am_course_progress(user_id,edition_id,chapter_key) values(auth.uid(),current_setting('test.edition_id')::uuid,current_setting('test.chapter')::uuid) on conflict(user_id,edition_id,chapter_key) do nothing;
 if (select count(*) from public.am_course_progress)<>1 then raise exception 'ordinary reader progress failed';end if;
 delete from public.am_course_progress where user_id=auth.uid();get diagnostics affected=row_count;if affected<>1 then raise exception 'ordinary reader cannot clear progress';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 if not exists(select 1 from public.am_editions where id=current_setting('test.edition_id')::uuid) then raise exception 'public edition unavailable';end if;
 begin perform 1 from public.am_edition_drafts;raise exception 'anonymous draft access';exception when insufficient_privilege then null;end;
 begin perform 1 from public.am_course_progress;raise exception 'anonymous progress access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select jsonb_build_object('approval',true,'snapshot',true,'revision',true,'private_reference_rejected',true,'progress_owner',true,'ordinary_reader_progress',true,'unknown_chapter_rejected',true,'nonpublisher_write_blocked',true,'anonymous_public_only',true) as verified;
rollback;
