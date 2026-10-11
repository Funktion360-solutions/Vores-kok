-- Public editorial editions contain only approved AkselsMad content, never family data.
create function private.am_valid_edition(c jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare ch jsonb; item jsonb; keys text[]='{}'; refs text[]; total integer=0;
begin
 if c is null or jsonb_typeof(c)<>'object' or octet_length(c::text)>200000 or not(c ?& array['title','excerpt','intro','category','chapters']) or c-'title'-'excerpt'-'intro'-'category'-'chapters'<>'{}'::jsonb then return false;end if;
 if jsonb_typeof(c->'title')<>'string' or length(trim(c->>'title'))<3 or length(c->>'title')>180
 or jsonb_typeof(c->'excerpt')<>'string' or length(c->>'excerpt')>600 or jsonb_typeof(c->'intro')<>'string' or length(c->>'intro')>20000
 or jsonb_typeof(c->'category')<>'string' or length(trim(c->>'category'))<1 or length(c->>'category')>80
 or jsonb_typeof(c->'chapters')<>'array' then return false;end if;
 if jsonb_array_length(c->'chapters') not between 1 and 30 then return false;end if;
 for ch in select value from jsonb_array_elements(c->'chapters') loop
  if jsonb_typeof(ch)<>'object' or not(ch ?& array['key','title','intro','items']) or ch-'key'-'title'-'intro'-'items'<>'{}'::jsonb then return false;end if;
  if jsonb_typeof(ch->'key')<>'string' or (ch->>'key') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or ch->>'key'=any(keys)
  or jsonb_typeof(ch->'title')<>'string' or length(trim(ch->>'title'))<1 or length(ch->>'title')>180
  or jsonb_typeof(ch->'intro')<>'string' or length(ch->>'intro')>20000 or jsonb_typeof(ch->'items')<>'array' then return false;end if;
  keys=array_append(keys,ch->>'key');refs='{}';
  if jsonb_array_length(ch->'items')>20 then return false;end if;
  for item in select value from jsonb_array_elements(ch->'items') loop
   if jsonb_typeof(item)<>'object' or not(item ?& array['type','id']) or item-'type'-'id'<>'{}'::jsonb then return false;end if;
   if jsonb_typeof(item->'type')<>'string' or item->>'type' not in ('recipe','guide','blog') or jsonb_typeof(item->'id')<>'string'
   or (item->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or ((item->>'type')||(item->>'id'))=any(refs) then return false;end if;
   refs=array_append(refs,(item->>'type')||(item->>'id'));total=total+1;
  end loop;
 end loop;
 return total<=100;
exception when others then return false;
end $$;
revoke all on function private.am_valid_edition(jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.am_valid_edition(jsonb) to authenticated;
create table public.am_edition_drafts(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('course','book')),slug text not null check(length(slug)<=160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 content jsonb not null check(private.am_valid_edition(content)),revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
create index am_edition_drafts_owner on public.am_edition_drafts(owner_id,updated_at desc);
create table public.am_editions(
 id uuid primary key references public.am_edition_drafts(id) on delete cascade,kind text not null check(kind in ('course','book')),
 slug text not null check(length(slug)<=160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),content jsonb not null check(private.am_valid_edition(content)),
 published_revision integer not null check(published_revision>0),visible boolean not null default true,published_at timestamptz not null default now(),unique(kind,slug)
);
create index am_editions_public on public.am_editions(kind,published_at desc) where visible;
alter table public.am_edition_drafts enable row level security;
alter table public.am_editions enable row level security;
revoke all on public.am_edition_drafts,public.am_editions from anon,authenticated;
grant select,insert,update on public.am_edition_drafts to authenticated;
grant select on public.am_editions to anon;
grant select,insert,update on public.am_editions to authenticated;
create policy am_edition_owner on public.am_edition_drafts for all to authenticated
 using(owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())))
 with check(owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())));
create policy am_edition_public on public.am_editions for select to anon,authenticated using(visible);
create policy am_edition_editor_read on public.am_editions for select to authenticated using(
 exists(select 1 from public.am_publishers where user_id=(select auth.uid())) and exists(select 1 from public.am_edition_drafts d where d.id=am_editions.id and d.owner_id=(select auth.uid())));
create policy am_edition_editor_insert on public.am_editions for insert to authenticated with check(
 exists(select 1 from public.am_publishers where user_id=(select auth.uid())) and exists(select 1 from public.am_edition_drafts d where d.id=am_editions.id and d.owner_id=(select auth.uid()) and d.kind=am_editions.kind and d.slug=am_editions.slug and d.content=am_editions.content and d.revision=am_editions.published_revision));
create policy am_edition_editor_update on public.am_editions for update to authenticated using(
 exists(select 1 from public.am_publishers where user_id=(select auth.uid())) and exists(select 1 from public.am_edition_drafts d where d.id=am_editions.id and d.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.am_publishers where user_id=(select auth.uid())) and exists(select 1 from public.am_edition_drafts d where d.id=am_editions.id and d.owner_id=(select auth.uid()) and d.kind=am_editions.kind
 and (not am_editions.visible or (d.slug=am_editions.slug and d.content=am_editions.content and d.revision=am_editions.published_revision))));
create table public.am_course_progress(
 user_id uuid not null references auth.users(id) on delete cascade,edition_id uuid not null references public.am_editions(id) on delete cascade,
 chapter_key uuid not null,completed_at timestamptz not null default now(),primary key(user_id,edition_id,chapter_key)
);
create index am_course_progress_edition on public.am_course_progress(edition_id);
alter table public.am_course_progress enable row level security;
revoke all on public.am_course_progress from anon,authenticated;
grant select,insert,delete on public.am_course_progress to authenticated;
create policy am_progress_read on public.am_course_progress for select to authenticated using(user_id=(select auth.uid()));
create policy am_progress_delete on public.am_course_progress for delete to authenticated using(user_id=(select auth.uid()));
create policy am_progress_insert on public.am_course_progress for insert to authenticated with check(user_id=(select auth.uid()) and exists(
 select 1 from public.am_editions e where e.id=edition_id and e.kind='course' and e.visible and e.content->'chapters' @> jsonb_build_array(jsonb_build_object('key',chapter_key::text))));
create function public.am_edit_edition(p_id uuid,p_kind text,p_slug text,p_content jsonb,p_revision integer,p_action text,p_confirm boolean default false)
 returns uuid language plpgsql security invoker set search_path='' as $$
declare d public.am_edition_drafts; ch jsonb; item jsonb; result_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.am_publishers where user_id=auth.uid()) then raise exception 'publisher required' using errcode='42501';end if;
 if p_action not in ('save','publish','unpublish') or p_action is null or p_revision is null then raise exception 'invalid operation';end if;
 if p_action='save' then
  if p_kind is null or p_kind not in ('course','book') or p_slug is null or length(p_slug)>160 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or not private.am_valid_edition(p_content) then raise exception 'invalid content';end if;
  if p_id is null then
   if p_revision<>0 then raise exception 'stale' using errcode='VK409';end if;
   insert into public.am_edition_drafts(owner_id,kind,slug,content) values(auth.uid(),p_kind,p_slug,p_content) returning id into result_id;
  else
   update public.am_edition_drafts set slug=p_slug,content=p_content,revision=revision+1,updated_at=now() where id=p_id and owner_id=auth.uid() and revision=p_revision and kind=p_kind returning id into result_id;
   if result_id is null then raise exception 'stale' using errcode='VK409';end if;
  end if;
  return result_id;
 end if;
 select * into d from public.am_edition_drafts where id=p_id and owner_id=auth.uid() for update;
 if d.id is null or d.revision<>p_revision then raise exception 'stale' using errcode='VK409';end if;
 if p_action='unpublish' then
  update public.am_editions set visible=false where id=d.id;
  return d.id;
 end if;
 if p_confirm is distinct from true then raise exception 'approval required';end if;
 for ch in select value from jsonb_array_elements(d.content->'chapters') loop
  if length(trim(ch->>'intro'))<3 and jsonb_array_length(ch->'items')=0 then raise exception 'empty chapter' using errcode='VK422';end if;
  for item in select value from jsonb_array_elements(ch->'items') loop
   if item->>'type'='recipe' then
    if not exists(select 1 from public.am_recipes r where r.id=(item->>'id')::uuid and r.visible) then raise exception 'unavailable recipe' using errcode='VK422';end if;
   else
    if not exists(select 1 from public.am_articles a where a.id=(item->>'id')::uuid and a.kind=item->>'type' and a.visible and a.published_at<=now()) then raise exception 'unavailable article' using errcode='VK422';end if;
   end if;
  end loop;
 end loop;
 insert into public.am_editions(id,kind,slug,content,published_revision,visible,published_at) values(d.id,d.kind,d.slug,d.content,d.revision,true,now())
 on conflict(id) do update set slug=excluded.slug,content=excluded.content,published_revision=excluded.published_revision,visible=true,published_at=now();
 return d.id;
end $$;
revoke all on function public.am_edit_edition(uuid,text,text,jsonb,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.am_edit_edition(uuid,text,text,jsonb,integer,text,boolean) to authenticated;
