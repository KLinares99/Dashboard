-- Partial payments.
-- A payment can cover several invoices and part of one. Each invoice keeps
-- how much of it is paid (paid_cents); it becomes "paid" when that reaches
-- the full amount. Payments are kept as a record of what came in and when.

alter table public.invoices add column paid_cents integer not null default 0;
update public.invoices set paid_cents = amount_cents where status = 'paid';
alter table public.invoices add constraint paid_within_amount
  check (paid_cents >= 0 and paid_cents <= amount_cents);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  paid_on      date not null,
  method       text,          -- "Apple Pay", "Check", "Zelle"
  reference    text,          -- "QuickBooks #1094"
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index payments_client_idx on public.payments (client_id, paid_on desc);

alter table public.payments enable row level security;
create policy staff_all on public.payments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy client_read on public.payments for select to authenticated using (client_id = public.my_client_id());
