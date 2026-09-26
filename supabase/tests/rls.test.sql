-- Row level security tests. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Users: one staff, one Warriors client, one Relevate client, one unlinked client.
-- Test-only emails, so this runs no matter which logins already exist.
insert into public.staff_allowlist (email) values ('rls-staff@elevate.test') on conflict do nothing;
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-staff@elevate.test', '{}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'rls-client@warriors.test', '{}'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'rls-client@relevate.test', '{}'),
  -- Tries to link itself to Warriors through metadata. Must be ignored.
  ('aaaaaaaa-0000-4000-8000-000000000004', 'rls-sneaky@example.test', '{"client_id":"11111111-0000-4000-8000-000000000004"}');

-- Trigger behaviour
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'staff', 'allowlisted email becomes staff');
select is((select role::text from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000002'), 'client', 'other email becomes client');
select is((select client_id from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000004'), null, 'metadata client_id is ignored');

-- Link clients the way the invite action does (service role).
update public.profiles set client_id = '11111111-0000-4000-8000-000000000004' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
update public.profiles set client_id = '11111111-0000-4000-8000-000000000001' where id = 'aaaaaaaa-0000-4000-8000-000000000003';

-- Total as the database owner sees it, to compare against below.
select set_config('test.total_clients', (select count(*) from public.clients)::text, true);

-- ---------- Staff ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.clients), current_setting('test.total_clients')::int, 'staff sees all clients');
select ok((select count(*) from public.blockers) > 0, 'staff sees blockers');
select ok((select count(*) from public.prospects) > 0, 'staff sees prospects');
select lives_ok($$ insert into public.tasks (client_id, title) values ('11111111-0000-4000-8000-000000000004', 'Staff-added task') $$, 'staff can add tasks');
select lives_ok($$ update public.clients set next_step = 'Edited' where slug = 'nyti' $$, 'staff can edit clients');

-- ---------- Warriors client ----------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.clients), 1, 'client sees exactly one client');
select is((select slug from public.clients), 'warriors', 'and it is their own');
select is((select count(*)::int from public.tasks where client_id <> '11111111-0000-4000-8000-000000000004'), 0, 'no other clients'' tasks');
select is((select count(*)::int from public.tasks where not visible_to_client), 0, 'internal tasks are hidden');
select ok((select count(*) from public.tasks) > 0, 'shared tasks are visible');
select is((select count(*)::int from public.blockers), 0, 'blockers hidden from clients');
select is((select count(*)::int from public.prospects), 0, 'prospects hidden from clients');
select is((select count(*)::int from public.invoices), 3, 'client sees own non-draft invoices');
select is((select count(*)::int from public.profiles), 1, 'client sees only own profile');

-- Writes must not stick
update public.tasks set done = true where client_id = '11111111-0000-4000-8000-000000000004';
select is((select count(*)::int from public.tasks where title = 'Rebatch content starting Mon Oct 5' and done), 0, 'client cannot update tasks');
select throws_ok($$ insert into public.tasks (client_id, title) values ('11111111-0000-4000-8000-000000000004', 'x') $$, '42501', null, 'client cannot insert tasks');
update public.profiles set role = 'staff' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select is(public.is_staff(), false, 'client cannot promote themselves');
update public.profiles set client_id = '11111111-0000-4000-8000-000000000001' where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select is(public.my_client_id(), '11111111-0000-4000-8000-000000000004'::uuid, 'client cannot switch clients');

-- ---------- Relevate client ----------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.invoices), 0, 'Relevate cannot see Warriors invoices');

-- ---------- Unlinked client ----------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.clients), 0, 'unlinked login sees nothing');

-- ---------- Anonymous ----------
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.clients $$, '42501', null, 'anonymous visitors are refused');

select * from finish();
rollback;
