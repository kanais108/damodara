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
