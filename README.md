# Elevate Command Center

The Elevate BSI web app. Staff manage every client in one place, and each client signs in to a portal that shows only their own work.

```
                       ┌───────────────────────────────┐
  Elevate staff  ────▶ │  /app     Pulse · Clients ·   │
  (allowlisted)        │           Tasks · Schedule ·  │
                       │           Billing · Prospects │
                       ├───────────────────────────────┤
  Client contact ────▶ │  /portal  Overview · Content ·│
  (invited by email)   │           Results · Invoices  │
                       └──────────────┬────────────────┘
                                      │  Next.js on Vercel
             ┌────────────────────────┼─────────────────────────┐
             ▼                        ▼                         ▼
   Supabase Postgres          Supabase Storage          Google Drive API
   row level security:        raw analytics CSVs        (service account,
   a client login can only    (private bucket)          read-only, one
   read its own client's                                folder per client)
   shared rows
```

## What each person can do

| | Staff | Client |
|---|---|---|
| See all clients, prospects, blockers | ✅ | ❌ |
| Add, edit, complete, delete tasks | ✅ | ❌ (read-only) |
| Mark a task internal (hidden from client) | ✅ | never sees it |
| Dates, invoices (add, mark sent/paid) | ✅ | sees shared dates and non-draft invoices |
| Upload analytics CSVs → charts | ✅ | sees the charts |
| Browse Drive content | ✅ | ✅ own folder only |
| Invite / remove client logins | ✅ | ❌ |

These rules are enforced in the database (`supabase/migrations`), not just the UI, and covered by `supabase/tests/rls.test.sql`.

## Run it locally

Requires Node 22 and Docker.

```bash
npm install
npx supabase start          # local Postgres, Auth, Storage, and a mail catcher
cp .env.example .env.local  # then paste the keys `npx supabase status` prints
npm run dev                 # http://localhost:3000
```

Sign in as `staff@elevate.test` (it's on the local staff allowlist). The first time, create the login:

```bash
npx supabase status   # copy the service role key
curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: <service role key>" -H "Authorization: Bearer <service role key>" \
  -H "Content-Type: application/json" -d '{"email":"staff@elevate.test","email_confirm":true}'
```

Sign-in emails land in the local mail catcher at http://127.0.0.1:54324.

## Tests

| Command | What it checks |
|---|---|
| `npm test` | CSV parsing, chart math, Drive folder access checks (41 tests) |
| `npm run db:test` | Row level security: clients can't see or change other clients' data (24 tests) |
| `npm run test:e2e` | Real browser: sign-in, task edits, uploads, invites, client isolation, access removal (14 tests). Run `npx supabase db reset` first. |
| `npm run build` | Type check, lint, production build |

GitHub Actions runs all of these on every push (`.github/workflows/ci.yml`).

## Launch checklist

### 1. Supabase (database + logins)
1. Create a project at supabase.com.
2. Push the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up". Leave the Email provider on. Logins are invite-only.
4. **Authentication → URL Configuration:** Site URL = your app URL (e.g. `https://portal.elevatebsi.com`). Add `https://portal.elevatebsi.com/auth/confirm` to Redirect URLs.
5. **Authentication → Emails → Templates:** paste `supabase/templates/magic_link.html` into **Magic Link** and `supabase/templates/invite.html` into **Invite user**. These link to `/auth/confirm`, which the app needs.
6. **Authentication → Emails → SMTP:** connect a real sender (Resend, Postmark, Google Workspace). Supabase's built-in sender only allows a few emails an hour.
7. Make yourself staff. In the SQL editor:
   ```sql
   insert into public.staff_allowlist (email) values ('you@elevatebsi.com');
   ```
   Then **Authentication → Users → Invite user** with the same email. Anyone on the allowlist becomes staff when their login is created.

### 2. Vercel (the app)
Import this repo and set these environment variables (see `.env.example`):

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API. **Server only. Never share it.** |
| `NEXT_PUBLIC_SITE_URL` | Your app URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Step 3 (optional) |

### 3. Google Drive (optional)
1. In Google Cloud Console, create a project, enable the **Google Drive API**, and create a **service account**. Add a JSON key.
2. Paste the whole JSON key, on one line, into `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. For each client, share their Drive folder with the service account's email as **Viewer**, then paste the folder link in the client's **Settings** tab.

Clients see thumbnails and can open images, videos and PDFs through the app, so they don't need a Google account. Google Docs and Sheets open in Drive and need to be shared with the client separately.

### 4. Your data
The local seed (`supabase/seed.sql`) mirrors the Notion board from Sept 20, 2026. For production, add clients through **Clients → New client**, or run the seed's `insert` statements in the SQL editor.

## Analytics uploads

On a client's **Analytics** tab, upload a CSV export broken down by day:

- **GA4:** Reports → pick a report → Share → Download file → CSV. Add the Date dimension.
- **Meta Business Suite:** Insights → Export data → CSV, daily.
- **Google Business Profile:** Performance → Download → CSV.
- **Anything else:** any CSV with a date column and number columns.

The importer skips comment lines and total rows, adds up breakdown rows per day, and averages rates. Uploading the same dates again replaces those numbers.

## Project layout

```
app/app/        staff pages        app/portal/     client pages
app/app/actions.ts  every create/edit/delete (all check staff first)
components/     UI (TaskList, Managers, MetricsView, Portal, Shell)
lib/analytics/  CSV parser + chart math     lib/drive.ts  Google Drive
supabase/       schema, seed, RLS tests, email templates
e2e/            browser tests               prototype/    the original static board
```
