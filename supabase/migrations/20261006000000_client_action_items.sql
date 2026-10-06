-- Simpler client portal.
-- Clients now see only three things: unpaid invoices, their own action items,
-- and this month's content. Tasks get an owner ("elevate" or "client"), and a
-- client can tick off their own action items, nothing else.

-- 1. Who a task belongs to ----------------------------------------------------
create type public.task_assignee as enum ('elevate', 'client');
alter table public.tasks add column assignee public.task_assignee not null default 'elevate';

-- 2. "Waiting on client" items become client action items ---------------------
insert into public.tasks (client_id, title, done, assignee, position, created_at)
select client_id, text, resolved, 'client', extract(epoch from created_at), created_at
from public.blockers;
drop table public.blockers;

-- 3. Clients read only their own action items ---------------------------------
drop policy client_read on public.tasks;
create policy client_read on public.tasks for select to authenticated
  using (client_id = public.my_client_id() and assignee = 'client');
alter table public.tasks drop column visible_to_client;

-- 4. A client can mark their own action items done (and only that) ------------
create or replace function public.set_my_task_done(task_id uuid, is_done boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  changed int;
begin
  update public.tasks
     set done = is_done
   where id = task_id
     and assignee = 'client'
     and client_id = public.my_client_id()
     and public.my_client_id() is not null;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.set_my_task_done(uuid, boolean) from public;
grant execute on function public.set_my_task_done(uuid, boolean) to authenticated;

-- 5. Optional payment link on invoices (e.g. a QuickBooks "Pay now" link) -----
alter table public.invoices add column pay_url text
  check (pay_url is null or pay_url ~ '^https://');
