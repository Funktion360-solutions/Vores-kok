begin;
\ir _helpers.psql
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_household('AI test') as h \gset
select pg_temp.ok(public.reserve_ai_request(:'h'), 'first request allowed');
select pg_temp.ok(not public.reserve_ai_request(:'h'), 'burst rejected');
select pg_temp.throws('select * from private.ai_usage', '42501', 'counter is private');
select pg_temp.logout();
update private.ai_usage set requests = 50, last_request = now() - interval '6 seconds';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(not public.reserve_ai_request(:'h'), 'daily quota rejected');
select pg_temp.logout();
update private.ai_usage set day = (now() at time zone 'UTC')::date - 1, last_request = now() - interval '6 seconds';
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.ok(public.reserve_ai_request(:'h'), 'quota resets on next UTC day');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.throws(format('select public.reserve_ai_request(%L)', :'h'), '42501', 'outsider rejected');
select pg_temp.login(null);
select pg_temp.throws(format('select public.reserve_ai_request(%L)', :'h'), '42501', 'anonymous rejected');
rollback;
