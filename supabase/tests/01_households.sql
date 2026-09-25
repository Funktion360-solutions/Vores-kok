begin;
\ir _helpers.psql

-- Profiles are created by trigger
select pg_temp.ok((select count(*) from public.profiles) = 4, 'profiles auto-created');
select pg_temp.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Anna', 'display name from metadata');

-- Anna creates a household and becomes owner
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_household('Familien Slot') as h1 \gset
select pg_temp.ok((select role from public.my_households() where id = :'h1') = 'owner', 'creator is owner');
select pg_temp.throws($$select public.create_household('   ')$$, '22023', 'blank household name rejected');

-- Direct insert into household_members is impossible (no insert policy)
select pg_temp.throws($$insert into public.household_members (household_id, user_id, role)
  values ((select id from public.households limit 1), '00000000-0000-0000-0000-00000000000d', 'owner')$$,
  '42501', 'cannot self-insert membership');

-- Invites
select public.create_household_invite(:'h1', 'member') as tok_b \gset
select public.create_household_invite(:'h1', 'viewer', 'clara@example.com') as tok_c \gset
select public.create_household_invite(:'h1', 'viewer', 'someone@else.dk') as tok_wrong \gset
select pg_temp.ok((select count(*) from public.household_invites where household_id = :'h1') = 3, 'owner sees invites');
select pg_temp.ok((select count(*) from public.household_invites where token_hash = :'tok_b') = 0, 'plaintext token is not stored');
select pg_temp.throws(format($$select public.create_household_invite(%L, 'owner')$$, :'h1'), '22023', 'cannot invite owner');

-- Dennis (outsider) cannot see the household or its invites
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.ok((select count(*) from public.households) = 0, 'outsider sees no households');
select pg_temp.ok((select count(*) from public.household_invites) = 0, 'outsider sees no invites');
select pg_temp.ok((select count(*) from public.profiles) = 1, 'outsider sees only own profile');
select pg_temp.throws(format($$select public.create_household_invite(%L, 'member')$$, :'h1'), '42501', 'outsider cannot invite');
-- Email-bound invite cannot be used by another account
select pg_temp.throws(format($$select public.accept_household_invite(%L)$$, :'tok_c'), '22023', 'email-bound invite rejects other user');
select pg_temp.throws($$select public.accept_household_invite('this-is-not-a-real-token-at-all')$$, '22023', 'bogus token rejected');
select public.create_household('Dennis hus') as h2 \gset

-- Bo and Clara accept
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.ok(public.accept_household_invite(:'tok_b') = :'h1', 'bo accepts');
select pg_temp.throws(format($$select public.accept_household_invite(%L)$$, :'tok_b'), '22023', 'invite cannot be reused');
select pg_temp.ok((select role from public.my_households() where id = :'h1') = 'member', 'bo is member');
select pg_temp.ok((select count(*) from public.household_invites) = 0, 'members cannot read invites');
select pg_temp.ok((select count(*) from public.profiles) = 2, 'bo sees anna + himself');
select pg_temp.throws(format($$select public.create_household_invite(%L, 'member')$$, :'h1'), '42501', 'member cannot invite');
-- Members cannot rename the household
update public.households set name = 'Hacked' where id = :'h1';
select pg_temp.ok((select name from public.households where id = :'h1') = 'Familien Slot', 'member cannot rename household');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_household_invite(:'tok_c');
select pg_temp.ok((select role from public.my_households() where id = :'h1') = 'viewer', 'clara is viewer');

-- Role management
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.throws(format($$select public.set_household_member_role(%L, %L, 'admin')$$, :'h1', '00000000-0000-0000-0000-00000000000b'),
  '42501', 'member cannot promote self');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.set_household_member_role(:'h1', '00000000-0000-0000-0000-00000000000b', 'admin');
select pg_temp.throws(format($$select public.set_household_member_role(%L, %L, 'member')$$, :'h1', '00000000-0000-0000-0000-00000000000a'),
  '23514', 'last owner cannot be demoted');
select pg_temp.throws(format($$select public.remove_household_member(%L, %L)$$, :'h1', '00000000-0000-0000-0000-00000000000a'),
  '23514', 'last owner cannot leave');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.throws(format($$select public.set_household_member_role(%L, %L, 'admin')$$, :'h1', '00000000-0000-0000-0000-00000000000c'),
  '42501', 'admin cannot create admins');
select pg_temp.throws(format($$select public.create_household_invite(%L, 'admin')$$, :'h1'), '42501', 'admin cannot invite admins');
select public.set_household_member_role(:'h1', '00000000-0000-0000-0000-00000000000c', 'member');
select public.set_household_member_role(:'h1', '00000000-0000-0000-0000-00000000000c', 'viewer');
select pg_temp.throws(format($$select public.remove_household_member(%L, %L)$$, :'h1', '00000000-0000-0000-0000-00000000000a'),
  '42501', 'admin cannot remove owner');
-- Admin can rename
update public.households set name = 'Familien Slot & Co' where id = :'h1';
select pg_temp.ok((select name from public.households where id = :'h1') = 'Familien Slot & Co', 'admin can rename');
-- Admin cannot delete household
delete from public.households where id = :'h1';
select pg_temp.ok((select count(*) from public.households where id = :'h1') = 1, 'admin cannot delete household');

-- Profiles: can only edit own
update public.profiles set display_name = 'Pwned' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Anna', 'cannot edit other profile');
update public.profiles set display_name = 'Bo B.' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Bo B.', 'can edit own profile');

-- Anon has no access at all
select pg_temp.login(null);
select pg_temp.throws($$select * from public.households$$, '42501', 'anon cannot read households');
select pg_temp.throws($$select public.create_household('x')$$, '42501', 'anon cannot call rpc');

select pg_temp.logout();
rollback;
