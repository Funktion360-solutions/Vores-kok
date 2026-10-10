create table public.am_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 recipe_id uuid not null references public.am_recipes(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (user_id, recipe_id)
);
create index am_favorites_recipe on public.am_favorites(recipe_id);
create table public.am_collections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create index am_collections_owner on public.am_collections(user_id);
create table public.am_collection_items (
 collection_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 recipe_id uuid not null references public.am_recipes(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(collection_id,recipe_id),
 foreign key(collection_id,user_id) references public.am_collections(id,user_id) on delete cascade
);
create index am_collection_items_owner on public.am_collection_items(user_id);
create index am_collection_items_recipe on public.am_collection_items(recipe_id);
alter table public.am_favorites enable row level security;
alter table public.am_collections enable row level security;
alter table public.am_collection_items enable row level security;
revoke all on public.am_favorites,public.am_collections,public.am_collection_items from anon,authenticated;
grant select,insert,delete on public.am_favorites,public.am_collection_items to authenticated;
grant select,insert,update,delete on public.am_collections to authenticated;
create policy own_favorites_select on public.am_favorites for select to authenticated using(user_id=(select auth.uid()));
create policy own_favorites_delete on public.am_favorites for delete to authenticated using(user_id=(select auth.uid()));
create policy own_favorites_insert on public.am_favorites for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.am_recipes r where r.id=recipe_id and r.visible)
);
create policy own_collections on public.am_collections for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_items_select on public.am_collection_items for select to authenticated using(user_id=(select auth.uid()));
create policy own_items_delete on public.am_collection_items for delete to authenticated using(user_id=(select auth.uid()));
create policy own_items_insert on public.am_collection_items for insert to authenticated with check(
 user_id=(select auth.uid())
 and exists(select 1 from public.am_collections c where c.id=collection_id and c.user_id=(select auth.uid()))
 and exists(select 1 from public.am_recipes r where r.id=recipe_id and r.visible)
);
