-- Local development seed. Mirrors the Notion To-Do board as of Sept 20, 2026.
-- Runs on `supabase db reset`. Not applied to production automatically.

insert into public.staff_allowlist (email) values ('staff@elevate.test') on conflict do nothing;

insert into public.clients (id, slug, name, contact_name, contact_email, color, type, price_cents, status, summary, headline, next_step, services, notion_url) values
('11111111-0000-4000-8000-000000000001', 'relevate', 'Relevate Solutions', 'Raymond Castro (Pastor Raymond)', 'client@relevate.test', 'blue', 'retainer', 44400, 'urgent',
 'Accounting, tax, payroll and coaching for churches and small businesses. Hudson Valley NY, bilingual EN/ES.',
 'Rebuilt, now getting *found*.', 'Schedule the Sept 20 batch through Oct 23 (29-day platform cap)',
 array['Website','Social','Email / CRM','SEO · GEO · AIO'], 'https://app.notion.com/p/39598dba651b81fcad10e8c7e524c0fa'),
('11111111-0000-4000-8000-000000000002', 'nyti', 'NYTI', 'Pastor Raymond', null, 'purple', 'project', 40000, 'urgent',
 'Enrollment campaign. Launched Mon Sept 14. Spanish (usted), Facebook only.',
 'Four reels from *done*.', 'Record the final 4 reels, then edit + schedule. This closes the proposal.',
 array['12 statics','4 AI reels','Skool','Facebook · ES'], null),
('11111111-0000-4000-8000-000000000003', 'escuela-de-musica', 'Escuela de Música', 'Pastor Raymond · Misión Internacional', null, 'purple', 'project', 40000, 'urgent',
 'Enrollment campaign. Enrolling since Aug 18.', 'Three reels from *done*.', 'Finalize + schedule reels 2–4',
 array['12 statics','4 reels','Facebook · ES'], null),
('11111111-0000-4000-8000-000000000004', 'warriors', 'The Warriors Project', 'Robert', 'client@warriors.test', 'orange', 'retainer', 44400, 'urgent',
 '12-module WARRIORS workbook + Skool community. Launched Sept 13. Free tier feeds a paid masterclass and 1:1 coaching.',
 'From workbook to *movement*.', 'Start the next content cycle Mon Oct 5 (current batch runs through Oct 9)',
 array['Skool','Workbook','Social content'], 'https://app.notion.com/p/3da98dba651b8140a436ff4f5b2431f3'),
('11111111-0000-4000-8000-000000000005', 'landscaping', 'Landscaping Website', 'HVQ Landscaping (Hector), confirm', null, 'teal', 'project', 60000, 'waiting',
 'Website build with gallery and 4–5 pages. Wufoo intake form is ready in EN + ES.',
 'Waiting on the *intake form*.', 'Send the Wufoo intake form and follow up until it comes back',
 array['Website build','Gallery','4–5 pages','EN + ES intake'], 'https://app.notion.com/p/2a598dba651b80d580bbe5ddfcd94631'),
('11111111-0000-4000-8000-000000000006', 'elevate', 'Elevate BSI (in-house)', 'Kevin', null, 'green', 'internal', 0, 'active',
 'September feed is scheduled. October batch is in progress.', 'Our own feed, *October* next.', 'Finish October content batch after client items',
 array['Social','Reels','SEO'], null);

insert into public.tasks (client_id, title, done, flag, assignee, position) values
('11111111-0000-4000-8000-000000000001', 'Outreach list compiled', true, null, 'elevate', 1),
('11111111-0000-4000-8000-000000000001', 'Sept 20 production batch (statics, carousels, emails)', true, null, 'elevate', 2),
('11111111-0000-4000-8000-000000000001', 'Schedule Sept 20 batch through Oct 23', false, 'urgent', 'elevate', 3),
('11111111-0000-4000-8000-000000000001', 'Write + hand Pastor Raymond 4 reel scripts', false, 'urgent', 'elevate', 4),
('11111111-0000-4000-8000-000000000001', 'Configure Mailchimp (templates + audience)', false, null, 'elevate', 5),
('11111111-0000-4000-8000-000000000001', 'Northeast Market Expansion: hashtags + copy', false, null, 'elevate', 6),
('11111111-0000-4000-8000-000000000001', 'Week of Oct 19: book Oct 24–31', false, null, 'elevate', 7),
('11111111-0000-4000-8000-000000000001', 'Update Bing Search', false, null, 'elevate', 8),
('11111111-0000-4000-8000-000000000001', 'Upload LLMs file into cPanel', false, 'blocked', 'elevate', 9),
('11111111-0000-4000-8000-000000000002', '12 statics created + scheduled', true, null, 'elevate', 1),
('11111111-0000-4000-8000-000000000002', 'Skool community built', true, null, 'elevate', 2),
('11111111-0000-4000-8000-000000000002', 'Skool community handed off', true, null, 'elevate', 3),
('11111111-0000-4000-8000-000000000002', 'Handoff meeting with Pastor Ray', true, null, 'elevate', 4),
('11111111-0000-4000-8000-000000000002', 'On-site Skool setup with students (Sept 14)', true, null, 'elevate', 5),
('11111111-0000-4000-8000-000000000002', 'Record final 4 reels', false, 'urgent', 'elevate', 6),
('11111111-0000-4000-8000-000000000003', '12 statics created + scheduled', true, null, 'elevate', 1),
('11111111-0000-4000-8000-000000000003', '4 reels shot (Sept 8)', true, null, 'elevate', 2),
('11111111-0000-4000-8000-000000000003', 'Reel 1 of 4 finalized', true, null, 'elevate', 3),
('11111111-0000-4000-8000-000000000003', 'Finalize + schedule reels 2–4', false, 'urgent', 'elevate', 4),
('11111111-0000-4000-8000-000000000004', 'Skool community built, seeded, handed off', true, null, 'elevate', 1),
('11111111-0000-4000-8000-000000000004', 'Sept 13 launch presentation', true, null, 'elevate', 2),
('11111111-0000-4000-8000-000000000004', 'Workbook standardized to NKJV + audit', true, null, 'elevate', 3),
('11111111-0000-4000-8000-000000000004', 'Content batched through Oct 9', true, null, 'elevate', 4),
('11111111-0000-4000-8000-000000000004', 'Men''s fellowship meeting recorded', true, null, 'elevate', 5),
('11111111-0000-4000-8000-000000000004', 'Strategy call (Sat Sept 12)', true, null, 'elevate', 6),
('11111111-0000-4000-8000-000000000004', 'Collect unpaid retainer (Sept balance + Oct)', false, 'urgent', 'elevate', 7),
('11111111-0000-4000-8000-000000000004', 'Rebatch content starting Mon Oct 5', false, null, 'elevate', 8),
('11111111-0000-4000-8000-000000000005', 'Build Wufoo intake form (EN + ES)', true, null, 'elevate', 1),
('11111111-0000-4000-8000-000000000005', 'Send form to client + follow up', false, 'urgent', 'elevate', 2),
('11111111-0000-4000-8000-000000000005', 'Create $600 invoice in QuickBooks', false, null, 'elevate', 3),
('11111111-0000-4000-8000-000000000005', 'Build site: gallery + 4–5 pages', false, null, 'elevate', 4),
('11111111-0000-4000-8000-000000000006', 'September feed scheduled', true, null, 'elevate', 1),
('11111111-0000-4000-8000-000000000006', 'Batch October content', false, null, 'elevate', 2),
('11111111-0000-4000-8000-000000000006', 'October reels: ElevenLabs VO → Higgsfield B-roll → schedule Thursdays', false, null, 'elevate', 3),
('11111111-0000-4000-8000-000000000006', 'Upload LLM file into cPanel', false, 'blocked', 'elevate', 4),
('11111111-0000-4000-8000-000000000006', 'Update GMB + Search Console + Bing', false, null, 'elevate', 5);

-- Things the client needs to do. They see these in their portal and can tick them off.
insert into public.tasks (client_id, title, done, flag, assignee, position) values
('11111111-0000-4000-8000-000000000001', 'Send us cPanel access', false, null, 'client', 100),
('11111111-0000-4000-8000-000000000001', 'Share Google Business Profile and Bing access', false, null, 'client', 101),
('11111111-0000-4000-8000-000000000001', 'Send staff photos', false, null, 'client', 102),
('11111111-0000-4000-8000-000000000001', 'Create a Mailchimp account', false, null, 'client', 103),
('11111111-0000-4000-8000-000000000004', 'Confirm the second R in WARRIORS', false, null, 'client', 104),
('11111111-0000-4000-8000-000000000004', 'Tell us what the $19.99 / $120.99 price is for', false, null, 'client', 105),
('11111111-0000-4000-8000-000000000004', 'Set the masterclass price', false, null, 'client', 106),
('11111111-0000-4000-8000-000000000005', 'Fill out the website intake form', false, null, 'client', 107);

insert into public.events (client_id, on_date, label, done) values
('11111111-0000-4000-8000-000000000002', '2026-09-14', 'NYTI launch + on-site Skool setup', true),
('11111111-0000-4000-8000-000000000001', '2026-09-20', 'Relevate batch produced', true),
('11111111-0000-4000-8000-000000000002', '2026-09-21', 'Record NYTI final 4 reels', false),
('11111111-0000-4000-8000-000000000004', '2026-10-05', 'Warriors next content cycle', false),
('11111111-0000-4000-8000-000000000004', '2026-10-09', 'Warriors content runs out', false),
('11111111-0000-4000-8000-000000000001', '2026-10-19', 'Book Relevate Oct 24–31', false),
('11111111-0000-4000-8000-000000000001', '2026-10-23', 'Relevate schedule ends', false);

insert into public.invoices (client_id, label, amount_cents, status, issued_on, due_on, paid_on, paid_cents) values
('11111111-0000-4000-8000-000000000002', 'NYTI enrollment campaign', 40000, 'paid', '2026-08-23', '2026-08-23', '2026-08-23', 40000),
('11111111-0000-4000-8000-000000000003', 'Escuela de Música enrollment campaign', 40000, 'paid', '2026-08-23', '2026-08-23', '2026-08-23', 40000),
('11111111-0000-4000-8000-000000000004', 'Recording session', 15000, 'paid', '2026-09-12', '2026-09-12', '2026-09-19', 15000),
('11111111-0000-4000-8000-000000000004', 'August 2026 retainer', 44400, 'sent', '2026-08-01', '2026-08-01', null, 0),
('11111111-0000-4000-8000-000000000004', 'September 2026 retainer', 44400, 'sent', '2026-09-01', '2026-09-01', null, 0),
('11111111-0000-4000-8000-000000000005', 'Website build', 60000, 'draft', null, null, null, 0);

insert into public.prospects (name, detail, note, status) values
('Starlese', 'Century 21 agent, North Carolina', 'Sample package sent, no reply. Text follow-up parked.', 'parked'),
('JPM Solution Corp.', 'Milton & Alicia Monroy', 'Asked for a social media + branding quote (Mar 2026).', 'parked');

-- Forged course approval for Warriors (same as supabase/snippets/warriors-forged-approval.sql)
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

-- Robert's Oct 6 payment (same as supabase/snippets/warriors-payment-2026-10-06.sql)
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
