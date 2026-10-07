-- Approvals: a document a client signs off on, decision by decision.
-- Shown as a cover card on the client's home; each decision is answered in
-- the portal; the client signs at the end. An optional PDF can be attached.

create type public.approval_status as enum ('open', 'signed');
-- approve: yes / request a change   choice: pick one option
-- text: write an answer             date: pick a date
create type public.decision_kind as enum ('approve', 'choice', 'text', 'date');

create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  eyebrow       text,                       -- "Course approval · Middle-tier offer"
  title         text not null check (length(trim(title)) > 0),   -- "Forged"
  subtitle      text,                       -- "The 12-week Warriors course"
  summary       text,
  card_color    text not null default '#14213d' check (card_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color  text not null default '#c9a04a' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  pdf_path      text,                       -- storage: documents/<client_id>/<approval_id>/<file>
  pdf_name      text,
  status        public.approval_status not null default 'open',
  signed_name   text,
  signed_at     timestamptz,
  signed_by     uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint signed_complete check (status = 'open' or (signed_name is not null and signed_at is not null))
);
create index approvals_client_idx on public.approvals (client_id, created_at desc);

create table public.approval_items (
  id             uuid primary key default gen_random_uuid(),
  approval_id    uuid not null references public.approvals (id) on delete cascade,
  position       int not null default 0,
  label          text not null check (length(trim(label)) > 0),   -- "Course name"
  tag            text,                     -- "Recommend" | "Needed" | "Proposed" | "Options"
  detail         text,                     -- the recommendation or question
  kind           public.decision_kind not null default 'approve',
  -- choice: [{ "label": "...", "detail": "...", "recommended": true }]
  options        jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  -- { "approved": bool, "choice": "label", "text": "...", "note": "..." }
  response       jsonb,
  responded_at   timestamptz,
  responded_by   uuid references auth.users (id) on delete set null
);
create index approval_items_idx on public.approval_items (approval_id, position);

alter table public.approvals enable row level security;
alter table public.approval_items enable row level security;

create policy staff_all on public.approvals for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.approval_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Clients read their own; they never write these tables directly.
create policy client_read on public.approvals for select to authenticated
  using (client_id = public.my_client_id());
create policy client_read on public.approval_items for select to authenticated
  using (exists (select 1 from public.approvals a where a.id = approval_id and a.client_id = public.my_client_id()));

-- A client answers one decision on an open approval of their own.
create or replace function public.answer_approval_item(item_id uuid, answer jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  changed int;
begin
  if jsonb_typeof(answer) <> 'object' or length(answer::text) > 4000 then
    return false;
  end if;
  update public.approval_items i
     set response = jsonb_strip_nulls(jsonb_build_object(
           'approved', case when jsonb_typeof(answer -> 'approved') = 'boolean' then answer -> 'approved' end,
           'choice',   left(answer ->> 'choice', 300),
           'text',     left(answer ->> 'text', 2000),
           'note',     left(answer ->> 'note', 2000))),
         responded_at = now(),
         responded_by = auth.uid()
    from public.approvals a
   where i.id = item_id
     and a.id = i.approval_id
     and a.status = 'open'
     and a.client_id = public.my_client_id()
     and public.my_client_id() is not null;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

-- A client signs an open approval of their own once every decision is answered.
create or replace function public.sign_approval(approval uuid, full_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  changed int;
begin
  if full_name is null or length(trim(full_name)) < 2 or length(full_name) > 120 then
    return false;
  end if;
  update public.approvals a
     set status = 'signed', signed_name = trim(full_name), signed_at = now(), signed_by = auth.uid()
   where a.id = approval
     and a.status = 'open'
     and a.client_id = public.my_client_id()
     and public.my_client_id() is not null
     and not exists (select 1 from public.approval_items i where i.approval_id = a.id and i.response is null);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.answer_approval_item(uuid, jsonb) from public;
revoke all on function public.sign_approval(uuid, text) from public;
grant execute on function public.answer_approval_item(uuid, jsonb) to authenticated;
grant execute on function public.sign_approval(uuid, text) to authenticated;

-- Private bucket for client documents. Path: <client_id>/<approval_id>/<file>
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_staff())
  with check (bucket_id = 'documents' and public.is_staff());
create policy documents_client_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.my_client_id()::text);
