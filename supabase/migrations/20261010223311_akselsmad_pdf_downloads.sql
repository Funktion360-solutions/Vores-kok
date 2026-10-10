-- Persistent quota per account: users cannot delete or update the ledger.
-- Recipe IDs intentionally have no FK, so removing a public recipe never frees a slot.
create table public.am_pdf_downloads (
 user_id uuid not null references auth.users(id) on delete cascade,
 recipe_id uuid not null,
 created_at timestamptz not null default now(),
 primary key(user_id,recipe_id)
);
alter table public.am_pdf_downloads enable row level security;
revoke all on public.am_pdf_downloads from anon,authenticated;
grant select on public.am_pdf_downloads to authenticated;
grant insert(user_id,recipe_id) on public.am_pdf_downloads to authenticated;
create policy own_pdf_downloads_read on public.am_pdf_downloads for select to authenticated using(user_id=(select auth.uid()));
create policy own_pdf_downloads_insert on public.am_pdf_downloads for insert to authenticated with check(user_id=(select auth.uid()));
create function private.am_enforce_pdf_quota() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('am-pdf:'||new.user_id::text,0));
 if not exists(select 1 from public.am_recipes where id=new.recipe_id and visible) then raise exception 'recipe_not_available' using errcode='22023';end if;
 if not exists(select 1 from public.am_pdf_downloads where user_id=new.user_id and recipe_id=new.recipe_id)
 and (select count(*) from public.am_pdf_downloads where user_id=new.user_id)>=5 then raise exception 'pdf_quota_reached' using errcode='VK429';end if;
 return new;
end $$;
revoke all on function private.am_enforce_pdf_quota() from public,anon;
create trigger enforce_pdf_quota before insert on public.am_pdf_downloads for each row execute function private.am_enforce_pdf_quota();
create function public.am_claim_pdf(p_id uuid,p_expected_revision int) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_count int;v_revision int;
begin
 if auth.uid() is null then raise exception 'forbidden' using errcode='42501';end if;
 select published_revision into v_revision from public.am_recipes where id=p_id and visible;
 if v_revision is null then raise exception 'recipe_not_available' using errcode='22023';end if;
 if v_revision is distinct from p_expected_revision then raise exception 'version_conflict' using errcode='VK409';end if;
 insert into public.am_pdf_downloads(user_id,recipe_id) values(auth.uid(),p_id) on conflict do nothing;
 select count(*) into v_count from public.am_pdf_downloads where user_id=auth.uid();
 return jsonb_build_object('used',v_count,'remaining',greatest(0,5-v_count));
end $$;
revoke all on function public.am_claim_pdf(uuid,int) from public,anon;
grant execute on function public.am_claim_pdf(uuid,int) to authenticated;
