-- Removes the dead Landscaping client (HVQ Landscaping / Hector) and everything
-- attached to it: tasks, events, invoices, payments, approvals, analytics.
-- Run once in the Supabase SQL editor. It cannot be undone.

-- 1. Look first: this is what will be removed.
select c.name,
  (select count(*) from public.tasks t where t.client_id = c.id) as tasks,
  (select count(*) from public.invoices i where i.client_id = c.id) as invoices,
  (select count(*) from public.payments p where p.client_id = c.id) as payments,
  (select count(*) from public.profiles p where p.client_id = c.id) as portal_logins
from public.clients c where c.slug = 'landscaping';

-- 2. Remove it. Portal logins (if any) are detached, not deleted.
update public.profiles set client_id = null
  where client_id = (select id from public.clients where slug = 'landscaping');
delete from public.clients where slug = 'landscaping';

-- 3. Check: should print 0.
select count(*) as landscaping_left from public.clients where slug = 'landscaping';
