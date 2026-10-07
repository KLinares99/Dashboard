-- Robert / The Warriors Project: retainer for Aug, Sep, Oct ($444 each = $1,332).
-- Paid $644 on Oct 6, 2026 (QuickBooks #1094, Apple Pay), applied oldest first:
--   August   $444 → paid in full
--   September $200 of $444 → $244 still owed
--   October  $0 of $444   → $444 still owed
-- Balance after this payment: $688.
-- Run once in Supabase → SQL Editor. Safe to run again.

-- 1. Undo the earlier "October paid" entry, if that snippet was run.
delete from public.invoices i using public.clients c
where c.id = i.client_id and c.slug = 'warriors' and i.label = 'October 2026 retainer (QuickBooks #1094)';

-- 2. The three monthly invoices, $444 each.
insert into public.invoices (client_id, label, amount_cents, status, issued_on, due_on)
select c.id, m.label, 44400, 'sent', m.d::date, m.d::date
from public.clients c,
     (values ('August 2026 retainer', '2026-08-01'), ('September 2026 retainer', '2026-09-01'), ('October 2026 retainer', '2026-10-01')) as m(label, d)
where c.slug = 'warriors'
  and not exists (select 1 from public.invoices i where i.client_id = c.id and i.label = m.label);

-- 3. Record the payment once.
insert into public.payments (client_id, amount_cents, paid_on, method, reference)
select c.id, 64400, '2026-10-06', 'Apple Pay', 'QuickBooks #1094'
from public.clients c
where c.slug = 'warriors'
  and not exists (select 1 from public.payments p where p.client_id = c.id and p.reference = 'QuickBooks #1094');

-- 4. Apply it: August in full, $200 to September, nothing yet to October.
update public.invoices i set amount_cents = 44400, paid_cents = 44400, status = 'paid', paid_on = '2026-10-06'
from public.clients c where c.id = i.client_id and c.slug = 'warriors' and i.label = 'August 2026 retainer';
update public.invoices i set amount_cents = 44400, paid_cents = 20000, status = 'sent', paid_on = null
from public.clients c where c.id = i.client_id and c.slug = 'warriors' and i.label = 'September 2026 retainer';
update public.invoices i set amount_cents = 44400, paid_cents = 0, status = 'sent', paid_on = null
from public.clients c where c.id = i.client_id and c.slug = 'warriors' and i.label = 'October 2026 retainer';

-- 5. Check: should show August paid, September $244 left, October $444 left; total $688.
select i.label,
       to_char(i.amount_cents / 100.0, 'FM$999,990.00') as amount,
       to_char(i.paid_cents / 100.0, 'FM$999,990.00') as paid,
       to_char((i.amount_cents - i.paid_cents) / 100.0, 'FM$999,990.00') as still_owed,
       case when i.status = 'paid' then 'PAID' when i.paid_cents > 0 then 'PART PAID' else 'UNPAID' end as status
from public.invoices i join public.clients c on c.id = i.client_id
where c.slug = 'warriors' and i.label like '%2026 retainer'
order by i.issued_on;
