-- Private provenance: never exposed through AkselsMad's public recipe rows.
create table public.am_kitchen_links (
 recipe_id uuid primary key references public.recipes(id) on delete cascade,
 household_id uuid not null references public.households(id) on delete cascade,
 public_recipe_id uuid not null references public.am_recipes(id),
 public_revision int not null check(public_revision>0),
 private_version int not null check(private_version>0),
 private_fingerprint text not null,
 created_at timestamptz not null default now()
);
create index am_kitchen_links_source_household on public.am_kitchen_links(public_recipe_id,household_id,public_revision desc,created_at desc);
create index am_kitchen_links_household on public.am_kitchen_links(household_id);
alter table public.am_kitchen_links enable row level security;
revoke all on public.am_kitchen_links from anon,authenticated;
grant select,insert on public.am_kitchen_links to authenticated;
grant update(public_revision,private_version,private_fingerprint) on public.am_kitchen_links to authenticated;
create policy kitchen_links_read on public.am_kitchen_links for select to authenticated using(
 private.has_household_role(household_id,'viewer') and exists(select 1 from public.recipes r where r.id=recipe_id and r.household_id=am_kitchen_links.household_id)
);
create policy kitchen_links_insert on public.am_kitchen_links for insert to authenticated with check(
 private.has_household_role(household_id,'member')
 and exists(select 1 from public.recipes r where r.id=recipe_id and r.household_id=am_kitchen_links.household_id)
 and exists(select 1 from public.am_recipes p where p.id=public_recipe_id and p.visible and p.published_revision=public_revision)
);
create policy kitchen_links_update on public.am_kitchen_links for update to authenticated using(private.has_household_role(household_id,'member')) with check(
 private.has_household_role(household_id,'member') and exists(select 1 from public.recipes r where r.id=recipe_id and r.household_id=am_kitchen_links.household_id)
);
-- A bounded content conversion with labelled detailed notes. No private media changes.
create function private.am_kitchen_payload(c jsonb,p_household_id uuid) returns jsonb language sql immutable security invoker set search_path='' as $$
 select (c-'category'-'category_id'-'difficulty'-'equipment'-'tips'-'storage'-'freezing'-'variations'-'troubleshooting'-'baking'-'cover_path') || jsonb_build_object(
 'household_id',p_household_id,'source_type','other','source_name','AkselsMad','difficulty',null,'tags','[]'::jsonb,
 'ingredients',(select jsonb_agg(value||jsonb_build_object('position',ordinality-1)) from jsonb_array_elements(c->'ingredients') with ordinality),
 'steps',(select jsonb_agg(value||jsonb_build_object('position',ordinality-1)) from jsonb_array_elements(c->'steps') with ordinality),
 'notes',concat_ws(E'\n\n',nullif(c->>'notes',''),
 case when nullif(c->>'equipment','') is not null then '## Udstyr'||E'\n'||(c->>'equipment') end,
 case when nullif(c->>'tips','') is not null then '## Gode råd'||E'\n'||(c->>'tips') end,
 case when nullif(c->>'storage','') is not null then '## Opbevaring'||E'\n'||(c->>'storage') end,
 case when nullif(c->>'freezing','') is not null then '## Frysning og genopvarmning'||E'\n'||(c->>'freezing') end,
 case when nullif(c->>'variations','') is not null then '## Variationer'||E'\n'||(c->>'variations') end,
 case when nullif(c->>'troubleshooting','') is not null then '## Typiske fejl og løsninger'||E'\n'||(c->>'troubleshooting') end,
 case when nullif(c->>'baking','') is not null then '## Bagenoter og tidsplan'||E'\n'||(c->>'baking') end))
$$;
revoke all on function private.am_kitchen_payload(jsonb,uuid) from public;
grant execute on function private.am_kitchen_payload(jsonb,uuid) to authenticated;
create function private.am_copy_fingerprint(p_recipe_id uuid) returns text language sql stable security invoker set search_path='' as $$
 select pg_catalog.md5((private.recipe_core_document(p_recipe_id)-'created_by_name'-'updated_by_name')::text)
$$;
revoke all on function private.am_copy_fingerprint(uuid) from public;
grant execute on function private.am_copy_fingerprint(uuid) to authenticated;
create or replace function public.am_copy_to_kitchen(p_id uuid,p_household_id uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare c jsonb; v_revision int; v_id uuid; v_version int;
begin
 if auth.uid() is null or not private.has_household_role(p_household_id,'member') then raise exception 'forbidden' using errcode='42501';end if;
 -- Serialize repeated saves from tabs or two family members.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('am-copy:'||p_id::text||':'||p_household_id::text,0));
 select l.recipe_id into v_id from public.am_kitchen_links l join public.recipes r on r.id=l.recipe_id
 where l.public_recipe_id=p_id and l.household_id=p_household_id and r.household_id=p_household_id and r.archived_at is null
 order by l.public_revision desc,l.created_at desc,l.recipe_id limit 1;
 if v_id is not null then return v_id;end if;
 select content,published_revision into c,v_revision from public.am_recipes where id=p_id and visible;
 if c is null then raise exception 'recipe_not_available' using errcode='22023';end if;
 v_id=(public.save_recipe(private.am_kitchen_payload(c,p_household_id))->>'id')::uuid;
 select version into v_version from public.recipes where id=v_id;
 insert into public.am_kitchen_links(recipe_id,household_id,public_recipe_id,public_revision,private_version,private_fingerprint)
 values(v_id,p_household_id,p_id,v_revision,v_version,private.am_copy_fingerprint(v_id));
 return v_id;
end $$;
create function public.am_kitchen_status(p_recipe_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('recipe_id',l.recipe_id,'household_id',l.household_id,'copied_revision',l.public_revision,
 'private_version',r.version,'modified',private.am_copy_fingerprint(r.id) is distinct from l.private_fingerprint,
 'public_revision',p.published_revision,'slug',p.slug,'title',p.content->>'title','available',coalesce(p.visible,false))
 from public.am_kitchen_links l join public.recipes r on r.id=l.recipe_id
 left join public.am_recipes p on p.id=l.public_recipe_id and p.visible
 where l.recipe_id=p_recipe_id and r.household_id=l.household_id
$$;
create function public.am_refresh_kitchen_copy(p_recipe_id uuid,p_expected_public_revision int,p_expected_private_version int,p_confirm boolean,p_new_copy boolean default false)
 returns uuid language plpgsql security invoker set search_path='' as $$
declare l public.am_kitchen_links; c jsonb; v_revision int; v_private int; v_id uuid; existing_id uuid; payload jsonb;
begin
 if auth.uid() is null or p_confirm is distinct from true then raise exception 'approval_required' using errcode='42501';end if;
 select * into l from public.am_kitchen_links where recipe_id=p_recipe_id;
 if l.recipe_id is null or not private.has_household_role(l.household_id,'member') then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('am-copy:'||l.public_recipe_id::text||':'||l.household_id::text,0));
 select version into v_private from public.recipes where id=l.recipe_id and household_id=l.household_id and archived_at is null for update;
 if v_private is null then raise exception 'recipe_not_available' using errcode='22023';end if;
 select content,published_revision into c,v_revision from public.am_recipes where id=l.public_recipe_id and visible;
 if c is null then raise exception 'recipe_not_available' using errcode='22023';end if;
 if v_revision is distinct from p_expected_public_revision or v_private is distinct from p_expected_private_version then raise exception 'version_conflict' using errcode='VK409';end if;
 -- Repeated approval must not create another recipe or bump a saved version.
 select x.recipe_id into existing_id from public.am_kitchen_links x join public.recipes r on r.id=x.recipe_id
 where x.public_recipe_id=l.public_recipe_id and x.household_id=l.household_id and x.public_revision=v_revision and r.archived_at is null
 order by x.created_at desc,x.recipe_id limit 1;
 if existing_id is not null then return existing_id;end if;
 if v_revision<=l.public_revision then return l.recipe_id;end if;
 payload=private.am_kitchen_payload(c,l.household_id);
 if p_new_copy then
  v_id=(public.save_recipe(payload)->>'id')::uuid;
  select version into v_private from public.recipes where id=v_id;
  insert into public.am_kitchen_links(recipe_id,household_id,public_recipe_id,public_revision,private_version,private_fingerprint)
  values(v_id,l.household_id,l.public_recipe_id,v_revision,v_private,private.am_copy_fingerprint(v_id));
 else
  if private.am_copy_fingerprint(l.recipe_id) is distinct from l.private_fingerprint then raise exception 'private_changes_preserved' using errcode='VK412';end if;
  v_id=l.recipe_id;
  payload=private.recipe_core_document(v_id)||payload||jsonb_build_object('id',v_id,'expected_version',v_private);
  perform public.save_recipe(payload);
  update public.am_kitchen_links set public_revision=v_revision,private_version=(select version from public.recipes where id=v_id),private_fingerprint=private.am_copy_fingerprint(v_id) where recipe_id=v_id;
 end if;
 return v_id;
end $$;
revoke all on function public.am_kitchen_status(uuid), public.am_refresh_kitchen_copy(uuid,int,int,boolean,boolean) from public,anon;
grant execute on function public.am_kitchen_status(uuid), public.am_refresh_kitchen_copy(uuid,int,int,boolean,boolean) to authenticated;
