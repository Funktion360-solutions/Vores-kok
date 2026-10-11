-- Editorial drafts and explicitly approved public snapshots. No private kitchen data.
create table public.am_article_drafts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('guide','blog')), slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),
 content jsonb not null, revision integer not null default 1 check(revision>0), updated_at timestamptz not null default now()
);
create index am_article_drafts_owner on public.am_article_drafts(owner_id,updated_at desc);
create table public.am_articles (
 id uuid primary key references public.am_article_drafts(id) on delete cascade,
 kind text not null check(kind in ('guide','blog')), slug text not null unique,
 content jsonb not null, published_revision integer not null, visible boolean not null default true,
 published_at timestamptz not null default now()
);
create index am_articles_public on public.am_articles(kind,published_at desc) where visible;
alter table public.am_article_drafts enable row level security;
alter table public.am_articles enable row level security;
revoke all on public.am_article_drafts,public.am_articles from anon,authenticated;
grant select,insert,update,delete on public.am_article_drafts to authenticated;
grant select on public.am_articles to anon;
grant select,insert,update,delete on public.am_articles to authenticated;
create policy am_article_drafts_owner on public.am_article_drafts for all to authenticated
 using(owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())))
 with check(owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())));
create policy am_articles_public on public.am_articles for select to anon,authenticated using(visible and published_at<=now());
create policy am_articles_editor_read on public.am_articles for select to authenticated using(exists(select 1 from public.am_article_drafts where id=am_articles.id));
create policy am_articles_editor_insert on public.am_articles for insert to authenticated with check(exists(select 1 from public.am_article_drafts where id=am_articles.id));
create policy am_articles_editor_update on public.am_articles for update to authenticated using(exists(select 1 from public.am_article_drafts where id=am_articles.id)) with check(exists(select 1 from public.am_article_drafts where id=am_articles.id));
create policy am_articles_editor_delete on public.am_articles for delete to authenticated using(exists(select 1 from public.am_article_drafts where id=am_articles.id));

create function private.am_validate_article(c jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare b jsonb; p text;
begin
 if c is null or not(c ?& array['title','excerpt','category','cover_path','cover_alt','blocks']) or jsonb_typeof(c)<>'object' or octet_length(c::text)>200000 or c-'title'-'excerpt'-'category'-'cover_path'-'cover_alt'-'blocks'<>'{}'::jsonb then return false;end if;
 if jsonb_typeof(c->'title')<>'string' or length(trim(c->>'title')) not between 3 and 180
 or jsonb_typeof(c->'excerpt')<>'string' or length(c->>'excerpt')>600
 or jsonb_typeof(c->'category')<>'string' or length(c->>'category') not between 1 and 80
 or jsonb_typeof(c->'cover_path')<>'string' or jsonb_typeof(c->'cover_alt')<>'string'
 or length(c->>'cover_alt')>400 or jsonb_typeof(c->'blocks')<>'array' then return false;end if;
 if jsonb_array_length(c->'blocks') not between 1 and 100 then return false;end if;
 for b in select value from jsonb_array_elements(c->'blocks') loop
  if jsonb_typeof(b)<>'object' then return false;end if;
  if b->>'type'='text' then
   if not(b ?& array['type','text']) or b-'type'-'text'<>'{}'::jsonb or jsonb_typeof(b->'text')<>'string' or length(trim(b->>'text')) not between 1 and 30000 then return false;end if;
  elsif b->>'type'='image' then
   if not(b ?& array['type','path','alt','caption']) or b-'type'-'path'-'alt'-'caption'<>'{}'::jsonb or jsonb_typeof(b->'path')<>'string' or coalesce(b->>'path','')='' or jsonb_typeof(b->'alt')<>'string' or length(trim(b->>'alt')) not between 1 and 400 or jsonb_typeof(b->'caption')<>'string' or length(b->>'caption')>1000 then return false;end if;
  elsif b->>'type'='recipe' then
   if not(b ?& array['type','id']) or b-'type'-'id'<>'{}'::jsonb or jsonb_typeof(b->'id')<>'string' or not exists(select 1 from public.am_recipes where id=(b->>'id')::uuid and visible) then return false;end if;
  else return false;end if;
 end loop;
 for p in select c->>'cover_path' union all select value->>'path' from jsonb_array_elements(c->'blocks') where value->>'type'='image' loop
  if p<>'' and (split_part(p,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='akselsmad-editorial' and name=p)) then return false;end if;
 end loop;
 if c->>'cover_path'<>'' and length(trim(c->>'cover_alt'))=0 then return false;end if;
 return true;
exception when others then return false;
end $$;
revoke all on function private.am_validate_article(jsonb) from public,anon;
grant execute on function private.am_validate_article(jsonb) to authenticated;

create function public.am_save_article(p_id uuid,p_kind text,p_slug text,p_content jsonb,p_revision integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;v_revision integer;
begin
 if not exists(select 1 from public.am_publishers where user_id=auth.uid()) then raise exception 'publisher required' using errcode='42501';end if;
 if not private.am_validate_article(p_content) then raise exception 'invalid article' using errcode='22023';end if;
 if p_id is null then
  insert into public.am_article_drafts(owner_id,kind,slug,content) values(auth.uid(),p_kind,p_slug,p_content) returning id into v_id;
 else
  select revision into v_revision from public.am_article_drafts where id=p_id for update;
  if not found then raise exception 'not accessible' using errcode='42501';end if;
  if v_revision is distinct from p_revision then raise exception 'stale draft' using errcode='VK409';end if;
  update public.am_article_drafts set kind=p_kind,slug=p_slug,content=p_content,revision=revision+1,updated_at=now() where id=p_id returning id into v_id;
 end if;
 return v_id;
end $$;
create function public.am_publish_article(p_id uuid,p_revision integer,p_confirm boolean,p_at timestamptz default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare d public.am_article_drafts;
begin
 if p_confirm is distinct from true then raise exception 'approval required' using errcode='22023';end if;
 select * into d from public.am_article_drafts where id=p_id for update;
 if not found then raise exception 'not accessible' using errcode='42501';end if;
 if d.revision is distinct from p_revision then raise exception 'stale draft' using errcode='VK409';end if;
 if not private.am_validate_article(d.content) then raise exception 'invalid article' using errcode='22023';end if;
 if p_at>now()+interval '2 years' then raise exception 'invalid schedule' using errcode='22023';end if;
 insert into public.am_articles(id,kind,slug,content,published_revision,published_at,visible)
 values(d.id,d.kind,d.slug,d.content,d.revision,coalesce(p_at,now()),true)
 on conflict(id) do update set kind=excluded.kind,slug=excluded.slug,content=excluded.content,published_revision=excluded.published_revision,published_at=excluded.published_at,visible=true;
 return d.id;
end $$;
revoke all on function public.am_save_article(uuid,text,text,jsonb,integer),public.am_publish_article(uuid,integer,boolean,timestamptz) from public,anon;
grant execute on function public.am_save_article(uuid,text,text,jsonb,integer),public.am_publish_article(uuid,integer,boolean,timestamptz) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('akselsmad-editorial','akselsmad-editorial',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy am_editorial_photo_owner on storage.objects for all to authenticated
 using(bucket_id='akselsmad-editorial' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.am_publishers where user_id=(select auth.uid())))
 with check(bucket_id='akselsmad-editorial' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.am_publishers where user_id=(select auth.uid())));
create policy am_editorial_photo_public on storage.objects for select to anon,authenticated
 using(bucket_id='akselsmad-editorial' and exists(select 1 from public.am_articles where visible and published_at<=now() and (content->>'cover_path'=name or exists(select 1 from jsonb_array_elements(content->'blocks') b where b->>'type'='image' and b->>'path'=name))));
