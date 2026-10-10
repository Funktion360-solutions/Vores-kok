-- Additive Vores Kok tables. Existing applications and policies are untouched.
create table public.vk_shopping_prices (
  item_id uuid primary key references public.shopping_list_items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  item_signature text not null check(length(item_signature)<=500),
  store text not null default '' check(length(store)<=200),
  total_ore bigint check(total_ore between 0 and 100000000),
  updated_at timestamptz not null default now()
);
create index vk_shopping_prices_household_idx on public.vk_shopping_prices(household_id);
alter table public.vk_shopping_prices enable row level security;
create policy vk_prices_read on public.vk_shopping_prices for select to authenticated using(private.has_household_role(household_id,'viewer'));
create policy vk_prices_write on public.vk_shopping_prices for insert to authenticated with check(private.has_household_role(household_id,'member') and exists(select 1 from public.shopping_list_items i where i.id=item_id and i.household_id=vk_shopping_prices.household_id));
create policy vk_prices_update on public.vk_shopping_prices for update to authenticated using(private.has_household_role(household_id,'member')) with check(private.has_household_role(household_id,'member') and exists(select 1 from public.shopping_list_items i where i.id=item_id and i.household_id=vk_shopping_prices.household_id));
create policy vk_prices_delete on public.vk_shopping_prices for delete to authenticated using(private.has_household_role(household_id,'member'));
grant select,insert,update,delete on public.vk_shopping_prices to authenticated;

create table public.vk_commerce_documents (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check(kind in ('receipt','flyer')),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=200000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index vk_commerce_documents_household_idx on public.vk_commerce_documents(household_id,kind,created_at desc);
alter table public.vk_commerce_documents enable row level security;
create policy vk_documents_read on public.vk_commerce_documents for select to authenticated using(private.has_household_role(household_id,'viewer'));
create policy vk_documents_insert on public.vk_commerce_documents for insert to authenticated with check(private.has_household_role(household_id,'member') and created_by=auth.uid());
create policy vk_documents_delete on public.vk_commerce_documents for delete to authenticated using(private.has_household_role(household_id,'member'));
grant select,insert,delete on public.vk_commerce_documents to authenticated;

-- One transaction saves approved lines and optional pantry items. Stable document IDs
-- make retry after a lost response safe. Invoker privileges preserve all existing RLS.
create function public.vk_save_commerce(p_id uuid,p_household_id uuid,p_kind text,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare saved jsonb; inserted uuid; line jsonb; loc uuid; qty numeric;
begin
  if not private.has_household_role(p_household_id,'member') then raise exception 'Ingen adgang' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('receipt','flyer') or jsonb_typeof(p_payload->'lines') is distinct from 'array' then raise exception 'Ugyldigt dokument'; end if;
  if jsonb_array_length(p_payload->'lines') not between 1 and 100 or p_payload->>'currency' is distinct from 'DKK' then raise exception 'Ugyldige linjer eller valuta'; end if;
  insert into public.vk_commerce_documents(id,household_id,kind,payload) values(p_id,p_household_id,p_kind,p_payload) on conflict(id) do nothing returning id into inserted;
  if inserted is null then
    select payload into saved from public.vk_commerce_documents where id=p_id and household_id=p_household_id and kind=p_kind;
    if saved is distinct from p_payload then raise exception 'Dokument-ID bruges allerede'; end if;
    return p_id;
  end if;
  if p_kind='receipt' then
    for line in select value from jsonb_array_elements(p_payload->'lines') loop
      if line->>'pantry_location_id' is not null and line->>'kind'='product' then
        loc := (line->>'pantry_location_id')::uuid;
        if not exists(select 1 from public.pantry_locations where id=loc and household_id=p_household_id) then raise exception 'Ugyldigt opbevaringssted'; end if;
        qty := nullif(line->>'quantity','')::numeric;
        insert into public.pantry_items(id,household_id,location_id,name,quantity,unit,notes)
        values((line->>'id')::uuid,p_household_id,loc,line->>'name',qty,line->>'unit','Fra godkendt kvittering: '||coalesce(p_payload->>'store','Ukendt butik'));
      end if;
    end loop;
  end if;
  return p_id;
end $$;
revoke all on function public.vk_save_commerce(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.vk_save_commerce(uuid,uuid,text,jsonb) to authenticated;

-- Shared provider cache contains only public catalogue data. No household inputs.
create table public.vk_offer_cache (
  id text primary key check(id='prej'),
  week date not null,
  fetched_at timestamptz not null default now(),
  payload jsonb
);
alter table public.vk_offer_cache enable row level security;
-- Only the Edge Function service role can access this cache.
revoke all on public.vk_offer_cache from anon,authenticated;
grant all on public.vk_offer_cache to service_role;
create function public.vk_claim_offer_cache(p_week date) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed text;
begin
 insert into public.vk_offer_cache(id,week) values('prej',p_week)
 on conflict(id) do update set week=excluded.week,fetched_at=now(),payload=null
 where vk_offer_cache.week<excluded.week returning id into claimed;
 return claimed is not null;
end $$;
revoke all on function public.vk_claim_offer_cache(date) from public,anon,authenticated;
grant execute on function public.vk_claim_offer_cache(date) to service_role;
