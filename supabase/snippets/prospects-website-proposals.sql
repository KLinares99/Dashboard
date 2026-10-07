-- Adds two website proposals to Prospects, marked "Needs action" until they're sent.
-- Run once in the Supabase SQL editor. Safe to run again: it skips names already there.
insert into public.prospects (name, detail, note, status)
select v.name, v.detail, 'Proposal pending: create and send.', 'urgent'
from (values
  ('Iglesia La Misión Internacional', 'New website'),
  ('New York Theological Institute', 'New website (existing client: NYTI)')
) as v(name, detail)
where not exists (select 1 from public.prospects p where p.name = v.name);

select name, detail, status from public.prospects order by created_at;
