-- Elevate Command Center: core schema
-- Two kinds of people sign in:
--   staff  -> Elevate team, sees and edits everything
--   client -> one client's contact, sees only their own client's shared data, read-only

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role      as enum ('staff', 'client');
create type public.client_status  as enum ('urgent', 'active', 'waiting', 'done', 'parked');
create type public.client_type    as enum ('retainer', 'project', 'internal');
create type public.task_flag      as enum ('urgent', 'blocked');
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'void');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  contact_name  text,
  contact_email text,
  color         text not null default 'blue'
                check (color in ('blue', 'purple', 'orange', 'teal', 'green', 'pink')),
  type          public.client_type not null default 'retainer',
  -- Monthly price for retainers, total price for projects. Stored in cents.
  price_cents   integer not null default 0 check (price_cents >= 0),
  status        public.client_status not null default 'active',
  summary       text,
  headline      text,
  next_step     text,
  services      text[] not null default '{}',
  drive_folder_id text,
  notion_url    text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       public.user_role not null default 'client',
  client_id  uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  -- A client login must point at exactly one client. Staff never do.
  constraint profile_role_client check (
    (role = 'staff' and client_id is null) or role = 'client'
  )
);

-- Emails that become staff automatically on first sign-in.
create table public.staff_allowlist (
  email text primary key check (email = lower(email))
);

create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  notes             text,
  done              boolean not null default false,
  done_at           timestamptz,
  flag              public.task_flag,
  due_on            date,
  visible_to_client boolean not null default true,
  position          double precision not null default extract(epoch from now()),
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index tasks_client_idx on public.tasks (client_id, done, position);

-- Things we are waiting on from the client. Internal only.
create table public.blockers (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  text        text not null check (length(trim(text)) > 0),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index blockers_client_idx on public.blockers (client_id);

-- Dated milestones: content drops, launches, scheduling windows.
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete cascade,
  on_date           date not null,
  label             text not null check (length(trim(label)) > 0),
  done              boolean not null default false,
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now()
);
create index events_date_idx on public.events (on_date);

create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  label        text not null,              -- "September 2026 retainer"
  amount_cents integer not null check (amount_cents >= 0),
  status       public.invoice_status not null default 'sent',
  issued_on    date,
  due_on       date,
  paid_on      date,
  created_at   timestamptz not null default now(),
  constraint paid_has_date check (status <> 'paid' or paid_on is not null)
);
create index invoices_client_idx on public.invoices (client_id, status);

create table public.prospects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  detail     text,
  note       text,
  status     public.client_status not null default 'parked',
  created_at timestamptz not null default now()
);

-- One row per uploaded analytics file.
create table public.analytics_uploads (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  source       text not null,               -- ga4 | meta | gbp | generic
  filename     text not null,
  storage_path text not null,
  row_count    integer not null default 0,
  date_from    date,
  date_to      date,
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Normalised daily metric values parsed from uploads.
create table public.metrics (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references public.clients (id) on delete cascade,
  upload_id  uuid not null references public.analytics_uploads (id) on delete cascade,
  source     text not null,
  metric     text not null,
  on_date    date not null,
  value      double precision not null,
  -- Re-uploading the same export replaces values instead of doubling them.
  unique (client_id, source, metric, on_date)
);
create index metrics_lookup_idx on public.metrics (client_id, metric, on_date);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can read profiles without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

create or replace function public.my_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() and role = 'client';
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.my_client_id() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_client_id() to authenticated;

-- New auth user -> profile row. Allowlisted emails become staff.
-- client_id is never taken from user metadata (a user can write their own
-- metadata). The staff invite action links the profile to a client using the
-- service role after the user exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    lower(new.email),
    case when exists (select 1 from public.staff_allowlist where email = lower(new.email))
         then 'staff'::public.user_role else 'client'::public.user_role end,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at / done_at honest.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

create or replace function public.tasks_before_write()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.clients           enable row level security;
alter table public.profiles          enable row level security;
alter table public.staff_allowlist   enable row level security;
alter table public.tasks             enable row level security;
alter table public.blockers          enable row level security;
alter table public.events            enable row level security;
alter table public.invoices          enable row level security;
alter table public.prospects         enable row level security;
alter table public.analytics_uploads enable row level security;
alter table public.metrics           enable row level security;

-- Staff: full access everywhere.
create policy staff_all on public.clients           for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.profiles          for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.staff_allowlist   for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.tasks             for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.blockers          for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.events            for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.invoices          for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.prospects         for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.analytics_uploads for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.metrics           for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Clients: read-only, their own client only, shared rows only.
create policy client_read on public.profiles for select to authenticated
  using (id = auth.uid());
create policy client_read on public.clients for select to authenticated
  using (id = public.my_client_id() and not archived);
create policy client_read on public.tasks for select to authenticated
  using (client_id = public.my_client_id() and visible_to_client);
create policy client_read on public.events for select to authenticated
  using (client_id = public.my_client_id() and visible_to_client);
create policy client_read on public.invoices for select to authenticated
  using (client_id = public.my_client_id() and status <> 'draft');
create policy client_read on public.analytics_uploads for select to authenticated
  using (client_id = public.my_client_id());
create policy client_read on public.metrics for select to authenticated
  using (client_id = public.my_client_id());
-- blockers, prospects, staff_allowlist: no client policy -> invisible to clients.

-- A client must not be able to promote themselves or switch clients.
revoke update, insert, delete on public.profiles from anon;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: raw analytics files (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('analytics', 'analytics', false)
on conflict (id) do nothing;

-- Path convention: <client_id>/<upload_id>/<filename>
create policy analytics_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'analytics' and public.is_staff())
  with check (bucket_id = 'analytics' and public.is_staff());
create policy analytics_client_read on storage.objects for select to authenticated
  using (bucket_id = 'analytics'
         and (storage.foldername(name))[1] = public.my_client_id()::text);
