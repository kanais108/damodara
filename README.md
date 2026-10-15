# Dāmodara Seva Portal — ISKCON Reading (UK)

A Vite/React + Supabase starter MVP that implements the **actual 2026 Google Form** registration branches for **Home, Hall, High Street, and Other**, where **every submission requests a new programme**.

## Implemented
- Saffron/brown responsive landing page, free event invitation, 25 Oct–24 Nov 2026.
- Three-step public request form with conditional venue fields, in-person and Zoom for Home requests, optional alternative slot, outdoor event interests, all eight original seva team options and separated optional future-updates consent.
- Staff email/password login (no public staff signup).
- Admin/coordinator request list with filtering, detail panel, manual assignment and CSV export.
- Facilitator personal schedule and programme completion report; combined reporting totals.
- PostgreSQL schema, indexes, RLS read isolation, server-only public insertion and restricted business RPCs.
- Sample data preview in dashboard when Supabase is not yet configured (non-persistent); **public submissions are never falsely treated as saved**.

## Quick start (local)

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Without Supabase credentials the site and sample dashboard render, but registration submission is not live.

## Supabase production setup
1. Create a fresh Supabase project; in SQL Editor run `supabase/migrations/202610140001_initial.sql`.
2. Set `.env` with project URL and publishable/anon key. **Never expose the service role key in React or `.env` with a `VITE_` prefix.**
3. Configure a Cloudflare Turnstile widget (Managed) for the production hostname and localhost for development. Add the **site key** as `VITE_TURNSTILE_SITE_KEY`. Add the **secret** as Supabase Edge Function secret `TURNSTILE_SECRET_KEY`.
4. Set the Edge Function secret `ALLOWED_ORIGIN` to the site origin (e.g. `https://damodara.example.org`). Deploy `submit-registration` using Supabase CLI. Set **Verify JWT = OFF for this public registration function only**; all requests require Turnstile verification, strict validation and a server-only service role token. Do not deploy without anti-spam credentials.
5. Create coordinator/facilitator accounts in Supabase Authentication dashboard (disable public signup). Insert a corresponding profile row for each user using their Auth UUID:

```sql
insert into public.profiles(id,full_name,role)
values ('REPLACE_WITH_AUTH_USER_UUID','ISKCON Reading Admin','admin');
```

6. Run `npm run build` and deploy `dist/` to Vercel or a static hosting service. Set production env vars and Turnstile allowed domains.
7. Give coordinators the dashboard URL; share the `/` landing page / registration navigation with hosts.

### Public CAPTCHA widget
The `index.html` file loads Turnstile in explicit-render mode. The React registration form renders the challenge when the user reaches the final step and sends the token to the Edge Function. Production submissions are blocked if the secret key is missing.

## Scope / limitations / next improvements
- MVP coordinator access covers *all* requests. Zone-scoped coordinators need additional policies and assignment rules before multi-region rollout.
- Default scheduled duration is 1 hour from the uploaded form. Assignment conflict prevention uses a facilitator-level advisory transaction lock and no overlapping active programmes. It does **not** add a travel buffer or verify availability slots yet.
- Dates and generated references are scoped to 2026; make them campaign-dynamic for later years.
- 'Other' and Hall/Street requests are genuine programme requests, not tickets to an existing event.
- Additional team members have a schema table, but the assignment UI only selects the lead facilitator for now.
- Seva and outdoor interests are captured in arrays; a dedicated volunteer coordinator board is a follow-up feature.
- Old Google Form CSV import is not included in this starter. Map fields and deduplicate with coordinator review before bulk import.
- Hosts do not yet have a tracking portal or confirmation notification. Coordinators contact hosts manually.
- The default illustration is typographic/emoji; obtain approval to add official ISKCON Reading assets and images.
- No automated WhatsApp or emails; avoid promising notifications before messaging is configured.
- Before launch, add a temple-approved UK GDPR privacy notice with controller contact, legal bases, retention details and privacy rights. Optional future-event updates must remain separate from request coordination.
- Add CAPTCHA throttling/server-side abuse monitoring, production audit review, tests for role isolation, daily backups, accessibility testing, and environment-specific CORS validation.

## Uploaded Google Form mapping
- Page 1: free offer, one hour, 25 October–24 November 2026, both online and in person.
- Page 2: email, name, mobile, city, country, venue type.
- Pages 4–6: date, time, venue/landmark; Home: Zoom/in-person checkbox. **Some Hall/Street/Other form copy says 2025**, corrected to 2026 according to the 2026 campaign introduction and Home branch.
- Page 6: outdoors interest and all eight seva team options.
- Page 7: existing combined GDPR acknowledgement; improved by splitting necessary processing acknowledgement from optional future event outreach.

## Important testing checklist
- Home online-only request should not require a physical address; in-person should.
- Hall/Street/Other require a venue/landmark and address/postcode.
- Date inputs reject dates outside campaign.
- Public users cannot query registrations or see private contact details.
- A facilitator can only see assigned host records, not other people's information.
- Concurrent assignment of overlapping programmes must fail.
- Completion report can only be submitted once and only by the assigned facilitator or manager.
- Coordinators must test date/time around the UK BST→GMT switch on 25 Oct 2026.


## v0.2 — Programmes and reporting (October 2026)

- Added administrator/coordinator **Programmes** tab: consolidated scheduled and unassigned requests, area/postcode/facilitator search, status and type filters, optional grouping by programme day, CSV export, and shortcut back to the existing assignment form.
- Expanded **Reports** tab: campaign date filters, programme-type and facilitator filters (management roles only), accurate totals from completed programmes with submitted reports, counts by type/town/facilitator, itemised report table, CSV export. Facilitator report views restrict to their own programmes in the UI.
- Fixed registration query ordering to use `submitted_at` rather than the nonexistent `registrations.created_at`.
- The facilitator choice dropdown now lists active facilitator profiles rather than all staff.
- No SQL migration required; existing `registrations`, `programs`, `program_reports` and `profiles` are used.

### Deploy and test

1. Back up your live repository. Copy the updated project contents to your local Git checkout (do not overwrite `.env` or `.git`). Commit and push to `main`, then monitor Railway's GitHub deployment.
2. Ensure your Railway project has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured at build time.
3. Sign in as an administrator. Check **Programmes**: unassigned requests should be visible alongside assigned and completed ones. Test searching, filters and export.
4. Check **Reports**: your completed test record should appear as 1 report, 20 participants, 20 lamps, 5 books with default dates. Test filters and CSV export.
5. Sign in as a facilitator; ensure **Programmes** tab is not accessible and only authorised data is shown. Check Supabase RLS policies independently before public launch.

### Known limitations

- The current `load()` fetches at most 1,000 registrations, and uses client-side joins/filters. Add paginated/server-side aggregates before substantial scale.
- Group-by-day is not a full calendar grid. Editing assignments is performed in the existing Registrations panel.
- Facilitator-by-area statistics currently group by host `city`, not postcode boundaries or `areas` mapping.
- This release has been JSX syntax-checked. Package installation and a full Vite production build could not be completed in the build environment, so verify `npm ci`/`npm install` and `npm run build` locally before pushing.

## v0.3 — Facilitator, area and availability management (14 October 2026)

This release adds an **admin/coordinator Facilitators tab** with facilitator status, coverage area toggles, available dates, and a form for administrators to add coverage areas. Administrators can provision approved facilitator accounts from the UI using a temporary password. **Never publish the temporary password or commit it to Git.** Staff should use a trusted, private channel for initial credentials; add a self-service password-change/recovery screen and custom SMTP before broad launch.

### Required production migration (before pushing v0.3)

Apply `supabase/migrations/202610140002_facilitator_management.sql` once to the existing Supabase project via SQL Editor. This adds only four role-validated RPCs. Do **not** rerun `202610140001_initial.sql` against your live project. Take a database backup first.

### Required Edge Function

Deploy `supabase/functions/create-facilitator/index.ts` as **`create-facilitator`**. Unlike `submit-registration`, this endpoint **MUST have JWT verification enabled**. It checks the caller's user token and verifies their `profiles.role` is `admin`. Set its `ALLOWED_ORIGIN` to `https://damodara-production.up.railway.app`; Supabase-managed `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must be available to it. Never expose a service-role key to Railway's Vite frontend variables.

### Local test before GitHub push

```powershell
npm install
npm run build
```

Then commit/push the new `src`, migration and function files. Railway will deploy the frontend automatically, but deploying the Supabase Edge Function and migration is a separate step.

### Acceptance tests

1. Admin signs in and sees `Facilitators`; facilitator does not see admin management tab.
2. Admin creates a facilitator using a verified email and initial password (at least 12 characters). The new account can sign in; it is recorded in `profiles` as `facilitator`.
3. Admin enables and disables a coverage area; reload confirms persistence.
4. Admin adds a valid non-overlapping availability slot in the campaign date range. Duplicate/overlapping slot is rejected. Deletion persists.
5. Admin deactivates a facilitator; they disappear from assignment dropdown on reload.
6. Existing public registration, programme assignment, completed reporting, dates and Unicode content remain functional.
7. A non-admin attempt to call `create-facilitator` is rejected, and non-manager cannot alter someone else's coverage.

### Limitations of v0.3

Area/postcode coverage and availability are captured for coordination, but the existing assignment RPC does not yet require a matching availability slot or postcode. A separate scheduling-hardening release should implement travel buffers, availability-based candidate ranking, and stricter assignment validation. The existing completed-programme conflict policy also requires business confirmation for same-day schedule reuse. Email invitations and password recovery require dedicated approved delivery and UI, not the project’s basic Supabase email allowance.

## v0.4 — Smart scheduling (ISKCON Reading)

**Deployment order:** back up Supabase; run `supabase/migrations/202610150003_smart_scheduling.sql` in SQL Editor; deploy the frontend from this version to Railway. Keep migrations 001/002 in history; do not rerun them.

### Behaviour
- Active facilitator **role** required, and a recorded availability interval must cover the entire one-hour programme. No availability means assignment is blocked.
- Default **30-minute separation** between consecutive programmes of a facilitator. It is enforced inside `assign_program` using a transaction-level advisory lock to block simultaneous conflicting assignments, regardless of the frontend. Completed appointments still occupy their historical slot; cancelled ones do not.
- A reassignment/reschedule uses the original `assign_program` RPC with the same registration ID. Completed/cancelled registrations cannot be rescheduled. Rescheduling a confirmed programme resets it to `assigned` pending reconfirmation.
- Postcode match is a **suggestion** based on currently configured outward district prefixes such as `RG1` or `RG6`; it is not a precise distance/geocoding calculation. Coordinators should check travel routing themselves.
- Weekly calendar shows registered programme requests in a seven-day view. Until assigned, the date/time shown is the **host's requested slot**, not a confirmed booking. Workload count is based on persisted programme records.
- Date/time inputs and stored `time` fields are in **Europe/London local clock time** for 2026. Do not infer timezone offsets in browser code. The scheduling RPC rejects slots extending into the next day. The UK daylight transition is 25 Oct 2026: do not schedule an ambiguous overnight slot without a design for timezone-aware timestamps.

### Manual test plan (with throwaway host and facilitator accounts)
1. Verify v0.3 public registration, role-based login, facilitator creation, coverage/availability and completion reporting remain available.
2. Create availability 18:00–22:00 on a campaign date. Assign programme 18:00–19:00. Attempt another at 19:15: RPC must reject; at 19:30 it should be allowed.
3. Attempt assignment outside availability and with a deactivated facilitator: both must be rejected, including direct RPC calls.
4. Assign a matching-postcode facilitator and verify it ranks above a nonmatching facilitator when both are available.
5. Open weekly calendar, move previous/next week, filter by facilitator, open a request from a calendar entry, and reschedule. Verify in `programs` and `audit_log`.
6. Confirm a completed programme cannot be rescheduled; check completed report totals are unchanged.
7. Test two simultaneous assignments to the same facilitator/time from two browsers; at most one succeeds.

### Build and deployment

```powershell
npm install
npm run build
git status
git add src/main.jsx src/style.css README.md supabase/migrations/202610150003_smart_scheduling.sql
git commit -m "Add smart scheduling and weekly calendar v0.4"
git pull --rebase origin main
git push origin main
```

If Git reports merge conflicts, **stop** and reconcile changes rather than using force-push. If you previously edited `src/main.jsx` directly in GitHub, inspect the diff carefully to preserve any production-only changes.
