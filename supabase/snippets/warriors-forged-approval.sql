-- Forged course approval for Rev. Robert Lindenberg (The Warriors Project).
-- Paste into Supabase → SQL Editor and run once. Safe to run again: it skips
-- if a "Forged" approval already exists for Warriors.
-- Then attach the PDF in the app: Clients → The Warriors Project → Approvals.
with c as (
  select id from public.clients where slug = 'warriors'
), a as (
  insert into public.approvals (client_id, eyebrow, title, subtitle, summary)
  select c.id,
    'Course approval · Middle-tier offer',
    'Forged',
    'The 12-week Warriors course',
    'The free Warriors Workbook, rebuilt as a full Skool course: Rob on video, the Scripture taught, the stories told, the work done one module a week. Eight decisions need a yes before recording starts.'
  from c
  where not exists (select 1 from public.approvals x where x.client_id = c.id and x.title = 'Forged')
  returning id
)
insert into public.approval_items (approval_id, position, label, tag, detail, kind, options)
select a.id, v.position, v.label, v.tag, v.detail, v.kind::public.decision_kind, v.options::jsonb
from a, (values
  (1, 'Course name', 'Recommend',
   'A course needs a name the men can say, share and invite someone into. Every option keeps the Warriors brand on top. Public posts keep calling it "the new course" until launch week.',
   'choice',
   '[{"label":"Forged","detail":"From Module 3: \"Pressure isn''t your enemy — it''s the environment where strength is forged.\" One word, says pain into power without saying it.","recommended":true},
     {"label":"The Warrior''s Path","detail":"Already lives in Module 0 and the Warrior''s Pathway resource. Familiar, but close to the workbook''s own language."},
     {"label":"Pain Into Power","detail":"The brand promise, word for word. Instantly clear, but it doubles the tagline."}]'),
  (2, 'Price', 'Needed',
   'Set after the feedback round with Noline, Tim, Nick and the 14 completers. The workbook stays free whatever is chosen. Include the price model (one-time, monthly or both), the public price, the founding price for the 14, and the group or church price.',
   'text', '[]'),
  (3, 'Access for the 14', 'Recommend',
   'Grandfathered in. They get each module as it is built and give feedback on it, which is how the library gets built.',
   'approve', '[]'),
  (4, 'Pace', 'Recommend',
   'Pick one. One module a week fits a course; one a month fits a monthly membership better.',
   'choice',
   '[{"label":"One module a week","detail":"12 weeks plus Orientation.","recommended":true},
     {"label":"One module a month","detail":"Four calls each, a year in total."}]'),
  (5, 'Phases', 'Proposed',
   'Foundation (Modules 1–4), Formation (5–8), The Fight (9–12). Approve the groupings and names, or ask for a change.',
   'approve', '[]'),
  (6, 'Recording load', 'Options',
   'How many videos Rob records per module.',
   'choice',
   '[{"label":"Full","detail":"4 videos per module, about 50 in total."},
     {"label":"Lean","detail":"2 videos per module, about 26 in total."}]'),
  (7, 'Weekly call', 'Recommend',
   'One standing call for Forged members, same night every week.',
   'choice',
   '[{"label":"Thursday","detail":"Favoured on the October call.","recommended":true},
     {"label":"Sunday 7 PM","detail":"The other night discussed."}]'),
  (8, 'Launch date', 'Needed',
   'A date is needed before November content is written. October posts work without one.',
   'date', '[]')
) as v(position, label, tag, detail, kind, options);
