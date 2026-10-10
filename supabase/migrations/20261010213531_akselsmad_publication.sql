-- Separate editorial drafts and public snapshots. No household metadata is public.
create table public.am_publishers (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.am_publishers enable row level security;
grant select on public.am_publishers to authenticated;
create policy am_publishers_self on public.am_publishers for select to authenticated using (user_id=(select auth.uid()));

create table public.am_drafts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 source_recipe_id uuid references public.recipes(id) on delete set null,
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),
 content jsonb not null,
 revision int not null default 1,
 updated_at timestamptz not null default now(),
 unique(owner_id,source_recipe_id)
);
alter table public.am_drafts enable row level security;
grant select,insert,update on public.am_drafts to authenticated;
create policy am_drafts_owner on public.am_drafts for all to authenticated
 using (owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())))
 with check (owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())));

create table public.am_recipes (
 id uuid primary key references public.am_drafts(id) on delete cascade,
 slug text not null unique,
 content jsonb not null,
 published_revision int not null,
 published_at timestamptz not null default now(),
 visible boolean not null default true
);
alter table public.am_recipes enable row level security;
grant select on public.am_recipes to anon,authenticated;
grant insert,update,delete on public.am_recipes to authenticated;
create policy am_public_read on public.am_recipes for select to anon,authenticated using(visible);
create policy am_editor_read on public.am_recipes for select to authenticated using(exists(select 1 from public.am_drafts where id=am_recipes.id));
create policy am_editor_insert on public.am_recipes for insert to authenticated with check(exists(select 1 from public.am_drafts where id=am_recipes.id));
create policy am_editor_update on public.am_recipes for update to authenticated using(exists(select 1 from public.am_drafts where id=am_recipes.id)) with check(exists(select 1 from public.am_drafts where id=am_recipes.id));
create policy am_editor_delete on public.am_recipes for delete to authenticated using(exists(select 1 from public.am_drafts where id=am_recipes.id));

-- Whitelist the public document, including nested objects. Reject arbitrary imported data.
create function private.am_valid_content(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare x jsonb; k text;
begin
 if coalesce(jsonb_typeof(c),'')<>'object' or octet_length(c::text)>200000 then return false; end if;
 for k in select jsonb_object_keys(c) loop
  if not k=any(array['title','description','category','cuisine','servings','yield_unit','prep_minutes','cook_minutes','total_minutes','difficulty','ingredients','steps','equipment','notes','tips','storage','freezing','variations','troubleshooting','baking','tags','cover_path']) then return false; end if;
 end loop;
 if length(btrim(coalesce(c->>'title',''))) not between 1 and 200 then return false; end if;
 foreach k in array array['description','category','cuisine','yield_unit','difficulty','equipment','notes','tips','storage','freezing','variations','troubleshooting','baking','cover_path'] loop
  if c ? k and jsonb_typeof(c->k) not in ('string','null') then return false; end if;
  if length(coalesce(c->>k,''))>20000 then return false; end if;
 end loop;
 foreach k in array array['servings','prep_minutes','cook_minutes','total_minutes'] loop
  if c ? k and jsonb_typeof(c->k)<>'null' then
   if jsonb_typeof(c->k)<>'number' or (c->>k)::numeric<>trunc((c->>k)::numeric) or (c->>k)::numeric<0 or (c->>k)::numeric>40320 then return false; end if;
  end if;
 end loop;
 if coalesce((c->>'servings')::int,0) not between 1 and 1000 then return false; end if;
 if coalesce(c->>'difficulty','') not in ('','easy','medium','hard') then return false; end if;
 if coalesce(jsonb_typeof(c->'ingredients'),'')<>'array' or coalesce(jsonb_typeof(c->'steps'),'')<>'array' then return false; end if;
 if jsonb_array_length(c->'ingredients') not between 1 and 100 or jsonb_array_length(c->'steps') not between 1 and 100 then return false; end if;
 for x in select value from jsonb_array_elements(c->'ingredients') loop
  if jsonb_typeof(x)<>'object' or length(btrim(coalesce(x->>'name',''))) not between 1 and 200 then return false; end if;
  for k in select jsonb_object_keys(x) loop if not k=any(array['name','quantity','unit','preparation']) then return false; end if; end loop;
  if jsonb_typeof(x->'name')<>'string' then return false; end if;
  foreach k in array array['unit','preparation'] loop
   if x ? k and jsonb_typeof(x->k) not in ('string','null') then return false; end if;
   if length(coalesce(x->>k,''))>1000 then return false; end if;
  end loop;
  if x ? 'quantity' and jsonb_typeof(x->'quantity')<>'null' then
   if jsonb_typeof(x->'quantity')<>'number' or (x->>'quantity')::numeric<=0 or (x->>'quantity')::numeric>1000000 then return false; end if;
  end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'steps') loop
  if jsonb_typeof(x)<>'object' or jsonb_typeof(x->'body')<>'string' or length(btrim(coalesce(x->>'body',''))) not between 1 and 20000 then return false; end if;
  for k in select jsonb_object_keys(x) loop if not k=any(array['body','timer_seconds']) then return false; end if; end loop;
  if x ? 'timer_seconds' and jsonb_typeof(x->'timer_seconds')<>'null' then
   if jsonb_typeof(x->'timer_seconds')<>'number' or (x->>'timer_seconds')::numeric not between 0 and 1209600 or (x->>'timer_seconds')::numeric<>trunc((x->>'timer_seconds')::numeric) then return false; end if;
  end if;
 end loop;
 if c ? 'tags' then
  if jsonb_typeof(c->'tags')<>'array' or jsonb_array_length(c->'tags')>30 then return false; end if;
  for x in select value from jsonb_array_elements(c->'tags') loop if jsonb_typeof(x)<>'string' or length(x#>>'{}')>80 then return false; end if; end loop;
 end if;
 if coalesce(c->>'cover_path','')<>'' and (c->>'cover_path') !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then return false; end if;
 return true;
exception when others then return false;
end $$;
revoke all on function private.am_valid_content(jsonb) from public;
grant execute on function private.am_valid_content(jsonb) to authenticated;
alter table public.am_drafts add constraint am_draft_document check(private.am_valid_content(content));
alter table public.am_recipes add constraint am_public_document check(private.am_valid_content(content));

create function public.am_import_recipe(p_recipe_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.recipes; c jsonb; v_id uuid;
begin
 if not exists(select 1 from public.am_publishers where user_id=auth.uid()) then raise exception 'publisher_required' using errcode='42501'; end if;
 select * into r from public.recipes where id=p_recipe_id and archived_at is null;
 if r.id is null then raise exception 'recipe_not_available' using errcode='42501'; end if;
 select id into v_id from public.am_drafts where source_recipe_id=r.id and owner_id=auth.uid();
 if v_id is not null then return v_id; end if;
 c=jsonb_build_object('title',r.title,'description',coalesce(r.description,''),'category',coalesce((select name from public.categories where id=r.category_id),''),'cuisine',coalesce(r.cuisine,''),'servings',coalesce(r.servings,4),'yield_unit',coalesce(r.yield_unit,'personer'),'prep_minutes',r.prep_minutes,'cook_minutes',r.cook_minutes,'total_minutes',r.total_minutes,'difficulty',coalesce(r.difficulty::text,''),'ingredients',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'unit',unit,'preparation',preparation) order by position),'[]') from public.recipe_ingredients where recipe_id=r.id),'steps',(select coalesce(jsonb_agg(jsonb_build_object('body',body,'timer_seconds',timer_seconds) order by position),'[]') from public.recipe_steps where recipe_id=r.id),'tags','[]'::jsonb);
 insert into public.am_drafts(source_recipe_id,slug,content) values(r.id,'opskrift-'||gen_random_uuid()::text,c) on conflict(owner_id,source_recipe_id) do update set source_recipe_id=excluded.source_recipe_id returning id into v_id;
 return v_id;
end $$;

create function public.am_save_draft(p_id uuid,p_slug text,p_content jsonb,p_revision int) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if p_id is null then
  insert into public.am_drafts(slug,content) values(p_slug,p_content) returning id into v_id;
 else
  update public.am_drafts set slug=p_slug,content=p_content,revision=revision+1,updated_at=now() where id=p_id and revision=p_revision returning id into v_id;
  if v_id is null then raise exception 'version_conflict' using errcode='VK409'; end if;
 end if;
 return v_id;
end $$;

create function public.am_publish(p_id uuid,p_revision int,p_confirm boolean) returns void language plpgsql security invoker set search_path='' as $$
declare d public.am_drafts;
begin
 if p_confirm is not true then raise exception 'approval_required' using errcode='22023'; end if;
 select * into d from public.am_drafts where id=p_id for update;
 if d.id is null then raise exception 'forbidden' using errcode='42501'; end if;
 if d.revision<>p_revision then raise exception 'version_conflict' using errcode='VK409'; end if;
 insert into public.am_recipes(id,slug,content,published_revision) values(d.id,d.slug,d.content,d.revision)
 on conflict(id) do update set slug=excluded.slug,content=excluded.content,published_revision=excluded.published_revision,published_at=now(),visible=true;
end $$;

create function public.am_copy_to_kitchen(p_id uuid,p_household_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare c jsonb; v_id uuid;
begin
 if auth.uid() is null or not private.has_household_role(p_household_id,'member') then raise exception 'forbidden' using errcode='42501'; end if;
 select content into c from public.am_recipes where id=p_id and visible;
 if c is null then raise exception 'recipe_not_available' using errcode='22023'; end if;
 -- This is a one-time independent copy. Public photo files are not injected into private storage.
 c=(c-'category'-'category_id'-'difficulty'-'equipment'-'tips'-'storage'-'freezing'-'variations'-'troubleshooting'-'baking'-'cover_path') || jsonb_build_object('household_id',p_household_id,'source_type','other','source_name','AkselsMad','difficulty',null,'tags','[]'::jsonb,'ingredients',(select jsonb_agg(value||jsonb_build_object('position',ordinality-1)) from jsonb_array_elements(c->'ingredients') with ordinality),'steps',(select jsonb_agg(value||jsonb_build_object('position',ordinality-1)) from jsonb_array_elements(c->'steps') with ordinality),'notes',concat_ws(E'\n\n',nullif(c->>'notes',''),nullif(c->>'equipment',''),nullif(c->>'tips',''),nullif(c->>'storage',''),nullif(c->>'freezing',''),nullif(c->>'variations',''),nullif(c->>'troubleshooting',''),nullif(c->>'baking','')));
 v_id=public.save_recipe(c);
 return v_id;
end $$;

revoke all on function public.am_import_recipe(uuid),public.am_save_draft(uuid,text,jsonb,int),public.am_publish(uuid,int,boolean),public.am_copy_to_kitchen(uuid,uuid) from public,anon;
grant execute on function public.am_import_recipe(uuid),public.am_save_draft(uuid,text,jsonb,int),public.am_publish(uuid,int,boolean),public.am_copy_to_kitchen(uuid,uuid) to authenticated;

-- Original photos have a separate private bucket. Only published covers are public-readable.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('akselsmad-photos','akselsmad-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy am_photo_editor on storage.objects for all to authenticated
 using(bucket_id='akselsmad-photos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.am_publishers where user_id=auth.uid()))
 with check(bucket_id='akselsmad-photos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.am_publishers where user_id=auth.uid()));
create policy am_published_photo on storage.objects for select to anon,authenticated
 using(bucket_id='akselsmad-photos' and exists(select 1 from public.am_recipes where visible and content->>'cover_path'=name));
