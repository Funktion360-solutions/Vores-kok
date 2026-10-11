-- AkselsMad only. Resend owns the audience and honours its unsubscribe state.
create table public.am_newsletter_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 requested boolean not null default false,
 consent_at timestamptz,
 consent_version text,
 operation_id uuid,
 operation_at timestamptz,
 synced_at timestamptz,
 check (not requested or (consent_at is not null and consent_version='akselsmad-newsletter-v1'))
);
create table public.am_newsletter_consents (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subscribed boolean not null,
 wording text not null default 'Ja tak, jeg vil modtage AkselsMads nyhedsbrev med opskrifter, guides og nyt fra Aksels køkken. Jeg kan afmelde mig når som helst.',
 created_at timestamptz not null default now()
);
create table public.am_newsletter_campaigns (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 content jsonb not null, revision integer not null default 1,
 status text not null default 'draft' check(status in ('draft','preparing','ready','sending','submitted','sent')),
 provider_id uuid unique, html_body text, text_body text, sender text, reply_to text, segment_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), test_at timestamptz,
 check (octet_length(content::text)<=30000),
 check (html_body is null or octet_length(html_body)<=200000)
);
create index am_newsletter_campaign_owner on public.am_newsletter_campaigns(owner_id,updated_at desc);
alter table public.am_newsletter_preferences enable row level security;
alter table public.am_newsletter_consents enable row level security;
alter table public.am_newsletter_campaigns enable row level security;
revoke all on public.am_newsletter_preferences,public.am_newsletter_consents,public.am_newsletter_campaigns from anon,authenticated;
grant select,insert,update on public.am_newsletter_preferences to authenticated;
grant select,insert on public.am_newsletter_consents to authenticated;
grant select,insert,update on public.am_newsletter_campaigns to authenticated;
create policy am_newsletter_preferences_owner on public.am_newsletter_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy am_newsletter_consents_read on public.am_newsletter_consents for select to authenticated using(user_id=(select auth.uid()));
create policy am_newsletter_consents_insert on public.am_newsletter_consents for insert to authenticated with check(user_id=(select auth.uid()));
create policy am_newsletter_campaigns_owner on public.am_newsletter_campaigns for all to authenticated
 using(owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())))
 with check(owner_id=(select auth.uid()) and exists(select 1 from public.am_publishers where user_id=(select auth.uid())));

create function public.am_newsletter_preference(p_subscribed boolean,p_confirm boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.am_newsletter_preferences; token uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'login required' using errcode='42501';end if;
 if p_subscribed and p_confirm is distinct from true then raise exception 'consent required' using errcode='22023';end if;
 insert into public.am_newsletter_preferences(user_id) values(auth.uid()) on conflict do nothing;
 select * into strict p from public.am_newsletter_preferences where user_id=auth.uid() for update;
 if p.operation_id is not null and p.operation_at>now()-interval '3 minutes' then raise exception 'operation in progress' using errcode='VK409';end if;
 update public.am_newsletter_preferences set requested=p_subscribed,
  consent_at=case when p_subscribed then now() else consent_at end,
  consent_version=case when p_subscribed then 'akselsmad-newsletter-v1' else consent_version end,
  operation_id=token,operation_at=now() where user_id=auth.uid() returning * into p;
 insert into public.am_newsletter_consents(user_id,subscribed) values(auth.uid(),p_subscribed);
 return to_jsonb(p);
end $$;
create function public.am_newsletter_preference_finish(p_operation uuid,p_synced boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update public.am_newsletter_preferences set operation_id=null,synced_at=case when p_synced then now() else synced_at end where user_id=auth.uid() and operation_id=p_operation;
 if not found then raise exception 'operation conflict' using errcode='VK409';end if;
end $$;

create function public.am_newsletter_campaign(p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.am_newsletter_campaigns; item jsonb; v_content jsonb:=p_payload->'content';
begin
 if not exists(select 1 from public.am_publishers where user_id=auth.uid()) then raise exception 'publisher required' using errcode='42501';end if;
 if p_action='save' then
  if v_content is null or jsonb_typeof(v_content)<>'object' or not(v_content ?& array['subject','preheader','title','intro','closing','items'])
    or v_content-'subject'-'preheader'-'title'-'intro'-'closing'-'items'<>'{}'::jsonb
    or jsonb_typeof(v_content->'subject')<>'string' or length(trim(v_content->>'subject')) not between 1 and 200
    or (v_content->>'subject') ~ E'[\\r\\n]'
    or jsonb_typeof(v_content->'title')<>'string' or length(trim(v_content->>'title')) not between 1 and 180
    or jsonb_typeof(v_content->'preheader')<>'string' or length(v_content->>'preheader')>180
    or jsonb_typeof(v_content->'intro')<>'string' or length(trim(v_content->>'intro')) not between 1 and 10000
    or jsonb_typeof(v_content->'closing')<>'string' or length(v_content->>'closing')>3000
    or jsonb_typeof(v_content->'items')<>'array' then raise exception 'invalid content' using errcode='22023';end if;
  if jsonb_array_length(v_content->'items')>6 then raise exception 'too many items';end if;
  for item in select value from jsonb_array_elements(v_content->'items') loop
   if jsonb_typeof(item)<>'object' or item-'kind'-'id'<>'{}'::jsonb or not(item ?& array['kind','id']) or item->>'kind' not in ('recipe','guide','blog') then raise exception 'invalid item';end if;
   if item->>'kind'='recipe' then
    if not exists(select 1 from public.am_recipes where id=(item->>'id')::uuid and visible) then raise exception 'recipe unavailable';end if;
   elsif not exists(select 1 from public.am_articles where id=(item->>'id')::uuid and kind=item->>'kind' and visible and published_at<=now()) then raise exception 'article unavailable';end if;
  end loop;
  if p_payload->>'id' is null then
   insert into public.am_newsletter_campaigns(owner_id,content) values(auth.uid(),v_content) returning * into c;
   return to_jsonb(c);
  end if;
 end if;
 select * into c from public.am_newsletter_campaigns where id=(p_payload->>'id')::uuid for update;
 if not found then raise exception 'not accessible' using errcode='42501';end if;
 if c.revision is distinct from (p_payload->>'revision')::integer then raise exception 'stale campaign' using errcode='VK409';end if;
 if p_action='test' then
  if c.test_at>now()-interval '1 minute' then raise exception 'wait before another test' using errcode='VK409';end if;
  update public.am_newsletter_campaigns set test_at=now() where id=c.id returning * into c;
 elsif p_action='save' and c.status='draft' then
  update public.am_newsletter_campaigns set content=v_content,revision=revision+1,updated_at=now() where id=c.id returning * into c;
 elsif p_action='prepare' and c.status='draft' then
  if length(coalesce(p_payload->>'html','')) not between 1 and 200000 or length(coalesce(p_payload->>'text','')) not between 1 and 50000 then raise exception 'snapshot required';end if;
  update public.am_newsletter_campaigns set status='preparing',html_body=p_payload->>'html',text_body=p_payload->>'text',sender=p_payload->>'sender',reply_to=p_payload->>'reply_to',segment_id=(p_payload->>'segment_id')::uuid,revision=revision+1,updated_at=now() where id=c.id returning * into c;
 elsif p_action='attach' and c.status='preparing' then
  update public.am_newsletter_campaigns set provider_id=(p_payload->>'provider_id')::uuid,status='ready',revision=revision+1,updated_at=now() where id=c.id returning * into c;
 elsif p_action='send' and c.status='ready' and p_payload->>'confirm'='true' then
  update public.am_newsletter_campaigns set status='sending',revision=revision+1,updated_at=now() where id=c.id returning * into c;
 elsif p_action='submitted' and c.status='sending' then
  update public.am_newsletter_campaigns set status='submitted',revision=revision+1,updated_at=now() where id=c.id returning * into c;
 elsif p_action='sent' and c.status in ('ready','sending','submitted') then
  update public.am_newsletter_campaigns set status='sent',revision=revision+1,updated_at=now() where id=c.id returning * into c;
 else raise exception 'invalid state' using errcode='VK409';end if;
 return to_jsonb(c);
end $$;
revoke all on function public.am_newsletter_preference(boolean,boolean),public.am_newsletter_preference_finish(uuid,boolean),public.am_newsletter_campaign(text,jsonb) from public,anon;
grant execute on function public.am_newsletter_preference(boolean,boolean),public.am_newsletter_preference_finish(uuid,boolean),public.am_newsletter_campaign(text,jsonb) to authenticated;
