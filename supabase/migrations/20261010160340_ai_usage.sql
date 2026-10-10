-- Only counters, never prompts. Private and inaccessible through the Data API.
create table private.ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  requests integer not null check (requests >= 0),
  last_request timestamptz not null
);
alter table private.ai_usage enable row level security;
revoke all on private.ai_usage from public, anon, authenticated;
-- Definer is needed to increment the private counter. Identity is always auth.uid(),
-- membership is checked here, no arbitrary user ID or limits can be supplied.
create function public.reserve_ai_request(p_household_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_day date := (now() at time zone 'UTC')::date; v_ok boolean;
begin
  if v_uid is null or not exists (select 1 from public.household_members where user_id = v_uid and household_id = p_household_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into private.ai_usage as u (user_id, day, requests, last_request)
  values (v_uid, v_day, 1, now())
  on conflict (user_id) do update set day = v_day,
    requests = case when u.day = v_day then u.requests + 1 else 1 end,
    last_request = now()
  where (u.day <> v_day or u.requests < 50) and u.last_request < now() - interval '5 seconds'
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke all on function public.reserve_ai_request(uuid) from public, anon;
grant execute on function public.reserve_ai_request(uuid) to authenticated;
