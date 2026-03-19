# Pitfalls Research

**Domain:** Multi-tenant SaaS — circular economy operations platform (Next.js App Router + Supabase)
**Researched:** 2026-03-19
**Confidence:** HIGH (verified against official Supabase docs, GitHub issues, and multiple independent sources)

---

## Critical Pitfalls

### Pitfall 1: RLS Enabled on Table but Not Enforced by Policy — Silent Full-Tenant Leak

**What goes wrong:**
A table has RLS enabled and a policy that reads `USING (tenant_id = (select auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)`. Looks correct. But if the policy is a SELECT-only policy and no INSERT/UPDATE/DELETE policies exist, those operations silently succeed for all rows. Equally dangerous: the policy is written but the table was created without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, so the policy exists in the schema but is never evaluated. In both cases, every authenticated user can read or mutate every other tenant's data.

**Why it happens:**
Supabase Studio shows policies as a list without visually separating "enabled" from "applied to all commands". Developers write a SELECT policy, test reading, it works, and ship. The 2025 CVE-2025-xxx event (170+ apps exposed) showed this is the most common production failure mode — missing RLS, not broken RLS.

**How to avoid:**
- Every table in the schema must have `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` in a migration file — not applied via Studio UI.
- Write explicit policies for each command (SELECT, INSERT, UPDATE, DELETE). Do not rely on "no policy = no access" for tables that are also accessed by authenticated roles — understand when `anon` vs `authenticated` role is active.
- Add an automated test suite (pgTAP or a Node test) that logs in as a known tenant-A user and asserts zero rows returned from tenant-B data. Run this in CI before every deploy.
- Use Supabase's built-in Database Advisor (Lints panel) which flags tables with RLS disabled in the public schema.

**Warning signs:**
- You can query another tenant's rows from the Supabase SQL editor while impersonating a different user
- Dashboard row counts are suspiciously high for a new tenant
- Integration tests run as service_role instead of as user JWTs (service_role bypasses RLS entirely — tests passing with service_role prove nothing about RLS)

**Phase to address:** Phase 1 (Foundation) — RLS policies must be the first thing written for every table, before any feature code touches the database.

---

### Pitfall 2: Using `user_metadata` (Not `app_metadata`) for Role-Based RLS Policies

**What goes wrong:**
The `users` table stores the role column (`reco-admin`, `client`, `prison`, etc.). An RLS policy reads the role from `auth.jwt() -> 'user_metadata' ->> 'role'`. This appears to work. But `user_metadata` is writable by the authenticated user via `supabase.auth.updateUser()` from the browser — no server-side check required. Any user can set `{ data: { role: 'reco-admin' } }` and immediately bypass all role-based restrictions.

**Why it happens:**
Supabase Auth exposes both `user_metadata` (user-writable) and `app_metadata` (admin-only writable) in the JWT. The distinction is not prominent in introductory documentation. Developers use `user_metadata` because it is simpler to set during signup.

**How to avoid:**
- Store the authoritative role in `app_metadata`, set server-side only via the Supabase Admin API or a Custom Access Token Hook.
- Use `auth.jwt() -> 'app_metadata' ->> 'role'` in all RLS policies — never `user_metadata`.
- For this project: inject `tenant_id` and `role` into `app_metadata` when a user is invited/activated (admin-triggered action). Never trust role data from client-supplied input.
- Supabase's own linter (`splinter` rule `0015_rls_references_user_metadata`) flags policies referencing `user_metadata`. Add this lint check to CI.

**Warning signs:**
- RLS policies reference `raw_user_meta_data` in the database function inspector
- A browser console call to `supabase.auth.updateUser({ data: { role: 'reco-admin' } })` succeeds without error

**Phase to address:** Phase 1 (Foundation) — auth and role injection architecture must be settled before any RLS policies are written.

---

### Pitfall 3: `getSession()` on the Server — Spoofable Cookie Attack

**What goes wrong:**
Server Components, API routes, or middleware call `supabase.auth.getSession()` to identify the current user. The session is read directly from the cookie, which is controlled by the client. A malicious user (or a compromised client) can craft a valid-looking cookie containing a different user's `user_id` or a fake role claim. The session data is trusted without server-side verification.

**Why it happens:**
`getSession()` is documented and works fine on the client side. Developers copy patterns from client-side tutorials into server-side code. Supabase itself added a warning to the SDK in late 2024 that `getSession()` on the server is potentially insecure, but the warning is easy to miss.

**How to avoid:**
- Always use `supabase.auth.getUser()` on the server side (Server Components, API routes, middleware). It makes a network call to the Supabase Auth server to verify the JWT signature — it cannot be spoofed.
- The performance penalty (one extra network round-trip) is acceptable. For this project with 50 concurrent users, it is negligible.
- In middleware, use `getUser()` for all protected routes. Cache the result in the request context within the same request; do not call `getUser()` multiple times per request chain.
- Use the pattern from the official `@supabase/ssr` guide for Next.js App Router, which handles this correctly.

**Warning signs:**
- `supabase.auth.getSession()` appears in any file under `app/` that is a Server Component or route handler
- ESLint rule `no-restricted-syntax` can be configured to flag `getSession` in server-side files

**Phase to address:** Phase 1 (Foundation) — set the pattern in the auth utility files before any protected routes exist.

---

### Pitfall 4: Auth Cookie Scope Not Set to Parent Domain — Cross-Subdomain Session Failure

**What goes wrong:**
The platform serves `wolt.courierrecycling.com` and `ops.courierrecycling.com` from the same Next.js app. Supabase Auth sets the session cookie with `Domain=wolt.courierrecycling.com` (exact domain, no leading dot). A reco-admin who logs into `ops.courierrecycling.com` and then visits `wolt.courierrecycling.com` finds themselves unauthenticated — or vice versa. Worse: a prison user's 7-day session cookie is bound to `ops.courierrecycling.com`, so when the Supabase auth callback URL redirects to the root domain during magic link verification, the cookie is rejected.

**Why it happens:**
Cookie `Domain` attribute semantics are counterintuitive: specifying `domain.com` restricts to exact host only; specifying `.domain.com` (leading dot) includes all subdomains. The Supabase SSR client defaults to not setting a domain, which means the cookie is scoped to whichever subdomain set it.

**How to avoid:**
- Set `cookieOptions: { domain: '.courierrecycling.com' }` in the Supabase SSR client initialisation — both in middleware and in the browser client. This must be consistent across all client creation paths.
- Verify this in local dev by reading `document.cookie` on `wolt.localhost:3000` after logging in on `ops.localhost:3000`.
- The magic link callback URL must redirect to the correct subdomain after verification — not to a shared root URL. Validate this explicitly for prison staff magic links.

**Warning signs:**
- Login on one subdomain does not reflect as logged in on another
- Prison magic link verification produces a session, but the subsequent redirect lands on an unauthenticated page
- `document.cookie` on subdomain A shows no `sb-` prefixed cookie after login on subdomain B

**Phase to address:** Phase 1 (Foundation) — discovered only when integration-testing across subdomains, which happens before any feature is usable.

---

### Pitfall 5: Missing Indexes on `tenant_id` and RLS-Referenced Columns — Query Performance Collapse at Scale

**What goes wrong:**
Every RLS policy on every table performs a `WHERE tenant_id = (jwt claim)` filter. Without a B-tree index on `tenant_id`, Postgres performs a full sequential scan on every query, on every table, for every request. With 50,000 records (the target scale), a query returning 200 rows from a 50,000-row table takes 100ms instead of <5ms. With five such joins in a dashboard query, the 2-second page load target is immediately exceeded.

**Why it happens:**
Migrations create tables and policies but indexes are a separate step developers forget because the database "works fine" during development with hundreds of rows. The performance cliff only appears in production or load testing.

**How to avoid:**
- Every migration that adds a `tenant_id` column must include `CREATE INDEX ... ON table_name (tenant_id)`. This is a non-negotiable schema convention.
- Add composite indexes where RLS policies filter on multiple columns: e.g. `(tenant_id, status)` on `pickup_requests` supports both tenant isolation and status filtering in a single index scan.
- Similarly index `prison_facility_id` on `intake_records` and `prison_reports` (used in prison user RLS), `submitted_by` on `pickup_requests`, and `product_id` on line-item tables.
- Use Supabase's Performance Advisor (`EXPLAIN ANALYZE` output) to verify index usage after writing each new policy.

**Warning signs:**
- `EXPLAIN ANALYZE` shows `Seq Scan` on any table with more than 5,000 rows in a query path used by dashboard
- Response times are acceptable in development but degrade visibly after importing historical data (50,000+ rows)

**Phase to address:** Phase 1 (Foundation) — indexes must be in migration files from the start. Retrofitting indexes onto a populated production database requires `CREATE INDEX CONCURRENTLY` and careful scheduling.

---

### Pitfall 6: Middleware Subdomain Routing Breaks in Vercel Preview Deployments

**What goes wrong:**
Middleware reads `request.headers.get('host')` and splits on `.` to extract the subdomain. In local development it correctly parses `wolt.localhost:3000`. In production it correctly parses `wolt.courierrecycling.com`. In Vercel preview deployments, the hostname is `deliverygearrecycling-abc123.vercel.app` — no subdomain structure at all. Every preview deploy renders as the marketing site (or worse, fails entirely), making it impossible to review feature changes to the ops portal or client portal in PR previews.

**Why it happens:**
The routing logic is written and tested against production hostname patterns only. Preview URL format is fundamentally different and easily overlooked until the team first tries to review a PR.

**How to avoid:**
- Build a `resolveContext(hostname: string)` utility that handles three cases: production (wildcard subdomain), local dev (localhost with subdomain prefix), and Vercel preview (`*.vercel.app` — fall back to a configurable default context, e.g. ops portal, controlled by `VERCEL_PREVIEW_DEFAULT_CONTEXT` env var).
- Add `NEXT_PUBLIC_FORCE_SUBDOMAIN` env var for Vercel preview environments to simulate a specific subdomain context.
- Test the middleware utility with unit tests covering all three hostname formats before deploying.

**Warning signs:**
- PR preview URLs always show the marketing site regardless of which feature is being reviewed
- `NODE_ENV === 'production'` is used as a proxy for "real subdomain routing is active" — wrong, Vercel previews are also production builds

**Phase to address:** Phase 1 (Foundation) — needs to work correctly before the first PR review cycle.

---

### Pitfall 7: Consolidation Transport Cost Allocation Bug — Incorrect Pro-Rata Distribution

**What goes wrong:**
An outbound shipment costs €700 and contains three transport bookings: 3 pallets, 2 pallets, 2 pallets (total: 7 pallets). The pro-rata allocation should be: €300, €200, €200. The bug occurs when the allocation formula uses `COUNT(bookings)` instead of `SUM(pallet_count)`, distributing €233.33 to each booking. This silently produces incorrect per-delivery financial records. Since the total still reconciles to €700, the error is invisible in aggregated views. It only surfaces when a per-delivery cost is investigated.

A second variant: the allocation is calculated at outbound shipment creation time and stored. If a booking is later removed from the shipment (e.g. a pallet was sent separately), the stored allocation figures are stale. The system does not recalculate.

**Why it happens:**
The business logic for pro-rata allocation is non-trivial and easy to get wrong. The "total reconciles" property masks the bug during testing. Removal of a booking from a shipment is a rare edge case not covered in initial implementation.

**How to avoid:**
- Write the allocation formula as a database function: `transport_cost_eur * (booking.pallet_count_at_booking / shipment.total_pallet_count)`. Keep this in one place.
- Add a database constraint or trigger: the sum of `transport_cost_warehouse_to_prison_eur` across all bookings in an outbound shipment must equal `outbound_shipments.transport_cost_eur`. Flag any mismatch.
- When the outbound shipment cost is updated (edited by reco-admin), recalculate all allocations automatically. Do not allow stale allocation data to persist.
- Write unit tests with the exact scenario: 3+2+2 pallet split, verify each allocation to the cent.

**Warning signs:**
- Financial records show `transport_cost_warehouse_to_prison_eur` as equal fractions rather than weighted by pallet count
- Manual cross-check of `SUM(booking costs)` vs `outbound_shipment.transport_cost_eur` produces a discrepancy

**Phase to address:** Phase 1 (Foundation) — transport booking and outbound shipment are Phase 1 features. The allocation logic must be correct at the point of first use.

---

### Pitfall 8: Discrepancy Threshold Applied to Zero-Quantity Lines — False Positives Drowning reco-Admin

**What goes wrong:**
A pickup request includes 5 product types. Prison staff count and submit intake. One product (e.g. Heating Plates) had an informed quantity of 0 — the client sent none. The intake system calculates discrepancy as `(actual - informed) / informed`. When `informed = 0`, this is a division by zero. Different implementations produce: `NULL` (silently no flag), `Infinity` (immediate crash), or a forced flag of every zero-to-nonzero line as a discrepancy alert. If all five product lines generate alerts, reco-admin receives five notifications for what is a normal delivery.

**Why it happens:**
The discrepancy formula is tested with non-zero informed quantities. The zero-quantity case is an edge case discovered only when a product type is not included in a shipment.

**How to avoid:**
- Define the business rule explicitly: a line with `informed_quantity = 0` and `actual_quantity = 0` is not a discrepancy. A line with `informed_quantity = 0` and `actual_quantity > 0` is an unexpected surplus — flag it differently (not as a percentage discrepancy, but as an "unexpected product" alert).
- The threshold percentage (default 15%) only applies when `informed_quantity > 0`.
- Encode this in the discrepancy calculation function, not in the UI layer.

**Warning signs:**
- `NULL` values appearing in discrepancy rate columns on the dashboard
- reco-admin receives alerts for deliveries where everything appears correct
- Dashboard aggregate "discrepancy rate" is NaN or shows as 100% for all deliveries

**Phase to address:** Phase 2 (Processing) — intake and discrepancy calculation is Phase 2.

---

### Pitfall 9: Prison Tablet Session Invalidated by Magic Link Single-Use Semantics

**What goes wrong:**
Prison facility tablets use a bookmarked magic link for login. Magic links are single-use: clicking the link once creates a session and invalidates the link. The bookmark now points to a dead URL. The 7-day session works fine until it expires or the browser clears cookies (tablet restart, browser update, private browsing mode). Staff attempt to re-authenticate using the bookmark — it fails. They have no way to generate a new magic link themselves. Operations at the facility stop until reco-admin is contacted and resends a link.

A second variant: the tablet has two staff members who both click the bookmark in the same shift. The first click creates a session. The second click (from the same browser) silently logs in as the same session. But if the tablet is reset between shifts, both users find themselves locked out simultaneously and the link is already dead.

**Why it happens:**
Magic link authentication is designed for individual infrequent logins, not for shared facility tablets with long-lived sessions. The "bookmark the link" pattern appears to work during demos but the single-use invalidation is not visible until the link has been used once.

**How to avoid:**
- Do not use raw magic links as the bookmark. Instead, build a `/prison/login` page that accepts a facility `code` as a URL parameter (e.g. `/prison/login?facility=mogelkaer`). The bookmarked URL is this stable non-auth page.
- When prison staff open the bookmark, they see a simple "Send login link to Møgelkær" button. Clicking it triggers a server-side action that sends a fresh magic link to the facility's registered email. The email is accessible by facility management.
- The 7-day session reduces frequency of this flow. When it expires, staff know what to do: press the button, check the facility email.
- Alternatively, consider a facility-specific password (simple, stable, shared among facility staff) rather than magic links — simpler mental model for staff who already share the tablet.

**Warning signs:**
- During testing, the bookmarked URL works exactly once
- Support requests from prison staff who say "the link doesn't work anymore"
- Prison reporting goes dark (the same adoption failure that happened with Google Forms)

**Phase to address:** Phase 2 (Processing) — prison authentication is a Phase 2 deliverable. Design the login flow before building the prison intake module.

---

### Pitfall 10: Audit Log Written in Application Code — Gaps from Silent Errors

**What goes wrong:**
The audit log is populated by application code: after a successful update to an intake record, the API route writes a row to `audit_log`. If the API route throws after the update but before the audit write, the change is unlogged. If a direct Supabase query is made (e.g. in a migration script, a one-time fix, or a Supabase Studio edit), the audit log is entirely bypassed. Over time the audit trail has gaps, making the 48-hour edit window enforcement unverifiable.

**Why it happens:**
Application-layer audit logging is the path of least resistance — it is easy to implement and easy to test. Database-layer triggers require more PostgreSQL knowledge and are harder to debug. The "migration script bypasses audit" scenario only occurs under operational pressure.

**How to avoid:**
- Implement the audit log using PostgreSQL triggers, not application code. A trigger fires on any UPDATE or DELETE to audited tables regardless of where the change originates — API, migration, Studio, or Edge Function.
- The trigger writes to `audit_log` within the same transaction as the change. If the change rolls back, the log entry rolls back too. Atomicity is guaranteed.
- Application code may add context (user_id, request_id) that a trigger cannot see. Solve this with `SET LOCAL app.current_user_id = '...'` at the start of each database transaction, readable by the trigger via `current_setting('app.current_user_id', true)`.
- Audit log rows must be INSERT-only. No UPDATE or DELETE policies on the `audit_log` table — not even for reco-admin.

**Warning signs:**
- Audit log has fewer entries than expected after a high-activity period
- Direct database edits via Supabase Studio do not appear in the audit trail
- The `created_at` timestamps in `audit_log` are not monotonic within a single record's edit history

**Phase to address:** Phase 2 (Processing) — audit trail and edit-in-place are Phase 2 requirements. The trigger-based approach must be designed before the first editable record type is built.

---

### Pitfall 11: ESG Material Weight Calculation Uses Product's Current Composition Instead of Historical

**What goes wrong:**
The ESG dashboard shows "total polypropylene recovered" by multiplying `product_materials.weight_grams` by `intake_record_lines.actual_quantity`. A client updates a product's material composition (e.g. a redesigned Bike Bag uses 800g polypropylene instead of 943g). The query now recalculates all historical records with the new weight. A delivery from 2023 suddenly shows 800g polypropylene per bag instead of 943g. ESG totals change retroactively. Reports generated last quarter no longer match reports generated today.

**Why it happens:**
Material composition is stored on the product record and queried live. There is no snapshot of "material composition at time of processing". Most developers model this as a simple join without considering temporal correctness.

**How to avoid:**
- Treat material composition as append-only historical data. When a product's composition changes, create a new `product_materials` record with an `effective_from` date — do not update the existing record.
- The ESG calculation must join on material composition records where `effective_from <= intake_record.received_date AND (effective_to IS NULL OR effective_to > intake_record.received_date)`.
- This matches the existing pricing model (`product_pricing` already has `effective_from`/`effective_to`). Apply the same temporal pattern to `product_materials`.
- For the initial Wolt data, `effective_from` = the date the material workbook was last updated (or the programme start date, 2022-01-01).

**Warning signs:**
- ESG report totals change between two runs with no new data entered
- A historical pickup record's contribution to ESG totals changes after a product edit

**Phase to address:** Phase 3 (Intelligence) — ESG calculations are Phase 3. But the `product_materials` schema must include `effective_from`/`effective_to` from Phase 1, before any material data is imported.

---

### Pitfall 12: Historical Data Import Silently Corrupts Records — Date Format Ambiguity

**What goes wrong:**
The source data (Google Sheets, Excel spreadsheets) mixes date formats: some sheets use `DD/MM/YYYY` (European), some use `MM/DD/YYYY` (Excel US default), and some cells contain text strings like "12 Mar 2026". The import tool parses all dates as ISO 8601, misinterpreting `07/08/2023` as August 7th (US) when it should be July 8th (European). Twelve months of historical records have their dates shifted. Discrepancy calculations, invoice aging, and trend charts are all wrong — but the data looks plausible so no one notices immediately.

**Why it happens:**
Date parsing ambiguity is endemic to spreadsheet data. The import validator checks for required fields and type coercion but does not verify date interpretation. The EU convention of DD/MM is not the Excel default.

**How to avoid:**
- During the import mapping UI, require the user to explicitly specify the date format of the source file — do not auto-detect. Present a sample of parsed dates with the label "These dates will be imported as: [preview]" so the operator can catch misinterpretation before committing.
- Validate that parsed dates fall within a plausible range for each data type: pickup requests should be between 2023-01-01 and today; prison intake records between 2022-07-01 and today. Out-of-range dates are flagged, not silently accepted.
- Import dates should be stored in UTC. Display in DD/MM/YYYY as per the platform convention (Section 6.5 of PRD).

**Warning signs:**
- Historical records have delivery dates that cluster on the same few calendar days across many years (classic symptom of day/month swap)
- Imported records have dates in the future (e.g. "August 7, 2023" parsed as 07/08/2023 in a MM/DD reader)
- ESG dashboard trend charts show unusual volume spikes in specific months

**Phase to address:** Phase 1 and Phase 2 (data migration for each phase) — the import validation UI must be built before any historical import is run.

---

### Pitfall 13: Public Marketing Site Stats Endpoint Leaks Per-Tenant Aggregates via Timing Attack

**What goes wrong:**
The marketing site at `courierrecycling.com` shows aggregated public stats (total items processed, total material recovered, etc.) via an ISR-refreshed API endpoint. The endpoint correctly sums across all tenants. However, if the ISR revalidation is triggered per-stat rather than for all stats atomically, or if stats are cached at tenant-level before aggregation, a timing difference in cache invalidation could allow an observer to infer a specific tenant's contribution by monitoring which aggregate changed and when. More directly: if the endpoint accidentally exposes per-tenant breakdowns in its JSON response (e.g. as debugging metadata), client data is exposed publicly.

**Why it happens:**
The "aggregate only" requirement is clear in the PRD but easy to violate during development when debugging — a developer adds per-tenant breakdown to the response for easier debugging and forgets to remove it before deploying.

**How to avoid:**
- The public stats API must return only pre-computed aggregate values. Write an integration test that asserts the API response contains no `tenant_id`, no `tenant_name`, no `client` key, and no array of per-tenant objects.
- The aggregation query should run in a Postgres function or view that explicitly selects only aggregate columns — no `GROUP BY tenant_id` output, only `SUM(...)` totals.
- Set `Cache-Control: public, max-age=86400` on the endpoint. The ISR revalidation interval (daily) ensures it is not a real-time oracle.

**Warning signs:**
- The public stats JSON response contains an array with more than one object
- Response includes any field that could be cross-referenced with known client volumes
- Response size varies significantly between refreshes in a way that correlates with client activity

**Phase to address:** Phase 5 (Scale and Automation) — marketing site is Phase 5. But the aggregation query must be reviewed for data exposure before the public endpoint is live.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `service_role` key in API routes instead of per-user RLS | Fewer policy bugs during development | RLS is never tested; any bypass in service_role code leaks data | Never — use anon/authenticated key everywhere, service_role only in Edge Functions for admin ops |
| Write RLS policies via Supabase Studio UI instead of migration files | Faster iteration | Policies are not version-controlled; staging/production diverge silently | Never — all policies must be in migration files |
| Skip `effective_from/to` on `product_materials` and calculate ESG from current composition only | Simpler schema | ESG history is retroactively wrong after any product edit | Never for this domain — ESG reports are client-deliverables |
| Store role in `user_metadata` (user-writable) instead of `app_metadata` (server-only) | Simpler invite flow | Any user can escalate their own privileges | Never |
| Import historical data without a validation preview step | Faster import | Silent data corruption discovered weeks after launch | Never — always validate before commit |
| Use database-level `DELETE` for void/cancel operations | Simpler codebase | No audit trail; impossible to recover from accidental voids | Never — this project explicitly requires void not delete |
| ISR on authenticated dashboard pages | Better performance | Risk of serving another user's cached session data | Never on authenticated pages — force dynamic |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (server-side) | Calling `getSession()` in Server Components or API routes | Always use `getUser()` server-side; accept the network round-trip |
| Supabase Auth (cookie domain) | Letting the Supabase SSR client use its default cookie domain (exact host) | Set `cookieOptions: { domain: '.courierrecycling.com' }` in all client creation paths |
| Supabase Storage | Making a bucket public for convenience during development and forgetting to restrict it | Use private buckets with signed URLs for delivery photos, packing lists, logos; public buckets only for explicitly public assets (e.g. a pre-generated aggregated PDF) |
| Supabase Storage + RLS | Presigned upload URLs failing with RLS violation when `owner` is null | Ensure the storage client is initialised with the authenticated user session, not a service_role key, when generating presigned URLs |
| Supabase Realtime | Subscribing to realtime changes without RLS on `realtime.messages` | Realtime respects RLS but requires explicit policies on the `realtime` schema; without them, subscriptions may receive cross-tenant events |
| Resend/Postmark (email) | Sending notification emails synchronously in the API route handler | Use Supabase Edge Functions as a queue; send emails async so a transient email provider failure does not fail the API request |
| Vercel (wildcard subdomains) | Wildcard domain `*.courierrecycling.com` configured in Vercel but not added to the Supabase Auth allowed redirect URLs | Add `https://*.courierrecycling.com/**` to Supabase Auth redirect URL allowlist; without this, magic link callbacks are rejected |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `tenant_id` in tables with RLS policies | Dashboard loads degrade; `EXPLAIN ANALYZE` shows Seq Scan | Add `CREATE INDEX ... USING btree (tenant_id)` in every migration that creates a multi-tenant table | 5,000+ rows per table (production after 2-3 months of live data) |
| N+1 queries in prison intake view (one query per pickup in consolidated delivery) | Intake view loads slowly when viewing large outbound shipments | Fetch all pickup lines in a single query with a join, not in a loop | 7+ pickups in one outbound shipment |
| ESG dashboard re-computing material weight totals on every page load | ESG page slow; high database CPU on dashboard visits | Materialise ESG totals in a Postgres materialized view, refresh daily or on-demand after import | 10,000+ intake lines |
| Dashboard aggregate queries without date range filters as default | reco dashboard loads all 50,000+ records on first render | Set default date range filter (e.g. current year or last 12 months) in all dashboard queries; pagination where applicable | At historical data import — immediate on launch |
| Audit log table co-located with operational data | Audit log grows 3–5x faster than any other table; shared Postgres instance cache thrashed | Monitor `audit_log` row count; partition by month once it exceeds 500,000 rows | 6-12 months post-launch |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Hardcoding `tenant_id` in client-side code or URL parameters (e.g. `/api/pickups?tenant=wolt-uuid`) | A client can change the URL parameter to another tenant's UUID and access their data if server-side validation is absent | Never derive tenant from URL params; always resolve tenant from the authenticated user's `app_metadata.tenant_id` server-side |
| Exposing service_role key in Next.js API routes deployed to the Edge | Service_role bypasses all RLS; leaked key gives full database access | service_role key must only appear in Supabase Edge Functions (server-only, not in Next.js code that could be included in client bundles) |
| Prison internal cost data visible in client API response (even as null fields) | Violates contractual confidentiality (PRD Section 10); Wolt could discover reco's cost structure | Ensure the Wolt-facing API response schema never includes `transport_cost_*`, `processing_cost_*`, or any internal cost column — even as null |
| Storage bucket path not scoped by `tenant_id` (e.g. `/photos/delivery-123.jpg` instead of `/wolt/photos/delivery-123.jpg`) | A tenant who guesses another tenant's file path can access it if the bucket is public | Structure storage paths as `/{tenant_id}/{entity_type}/{entity_id}/{filename}`; apply RLS storage policies that verify the first path segment matches the user's tenant |
| Notification emails containing pickup quantities or financial figures without verifying recipient role | A reco viewer without financial toggle can receive financial data via email notification | Strip financial data from notification email templates for non-admin recipients; apply the same visibility rules as the UI |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Prison intake form requires scrolling to submit after entering 5+ product quantities on a tablet | Prison staff don't scroll; partial submissions or abandoned forms | Sticky "Submit" button visible at all times; intake form fits in one tablet viewport or uses a stepper pattern |
| Client dropdown on prison intake form defaults to blank | Prison staff submit against the wrong tenant; billing errors | Pre-select the client when opening from an expected delivery (linked pickup); require explicit confirmation of client before submit for unexpected deliveries |
| Discrepancy alert shown as a percentage without the absolute numbers | reco-admin cannot quickly assess severity (10% of 1 item vs 10% of 1,000 items are very different) | Show both: "−12% (−14 units)" |
| Size bucket form for clothing (XXS through XXXL) shows all 8 fields even for products that don't use all sizes | Prison staff enter zeros in irrelevant fields or misread the form | Per-product configuration of which sizes are active; hide irrelevant size fields |
| Financial data visible to reco role users by default before toggle is set | reco viewers see sensitive pricing on first login | Default financial visibility to OFF; require explicit activation per user by reco-admin |
| Magic link email goes to prison facility management email — but that inbox is checked infrequently | Prison staff wait hours for re-authentication | See Pitfall 9; build the stable `/prison/login?facility=X` flow so this is the exception, not the rule |
| 48-hour edit window countdown not visible to prison staff | Staff don't know how long they have to correct mistakes | Show "Editable for X hours" badge on submitted records within the window |

---

## "Looks Done But Isn't" Checklist

- [ ] **RLS Policies:** Verify `ENABLE ROW LEVEL SECURITY` is in migration SQL (not just policies written) — run `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false` and assert empty
- [ ] **Role injection:** Confirm `app_metadata` contains `role` and `tenant_id` after user invite flow completes — test with a freshly invited user, check their JWT claims
- [ ] **Cross-subdomain session:** After logging into ops.courierrecycling.com, navigate to wolt.courierrecycling.com — verify session persists and correct tenant context loads
- [ ] **Prison magic link flow:** Bookmark the prison login URL, clear cookies, open bookmark, send new link, click link in email — verify successful re-authentication
- [ ] **Consolidation cost allocation:** Create a 3-booking outbound shipment (3+2+2 pallets), enter €700 cost — verify allocations are €300/€200/€200, not €233.33 each
- [ ] **Discrepancy threshold on zero quantity:** Submit an intake where `informed_quantity = 0` for one product — verify no false discrepancy alert fires
- [ ] **Historical date import:** Import a file with `DD/MM/YYYY` dates where day ≤ 12 — verify day and month are not swapped
- [ ] **ESG temporal accuracy:** Update a product's material composition, then re-run ESG report for a period before the change — verify the old composition is used for historical records
- [ ] **Audit log completeness:** Make a direct update via Supabase Studio SQL editor, then check `audit_log` — verify the row appears (confirms trigger-based logging, not app-layer)
- [ ] **Prison cost data isolation:** Log in as a `client` or `client-global` user, inspect all API responses — verify no transport cost, processing cost, or reco margin fields appear anywhere
- [ ] **Public stats API isolation:** Call the marketing site stats endpoint — assert the JSON contains no `tenant_id`, no per-tenant arrays, no client names
- [ ] **Storage path scoping:** Upload a delivery photo as tenant A, attempt to construct and fetch the URL from tenant B's authenticated session — verify 403

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS data leak discovered in production | HIGH | Immediately rotate all service keys; audit query logs for cross-tenant access; notify affected tenants per GDPR breach requirements (72-hour window); implement correct policies in emergency deploy |
| Stale role in `user_metadata` used for RLS — privilege escalation | HIGH | Rotate all JWT secrets to invalidate existing sessions; re-deploy with correct `app_metadata`-based policies; audit `audit_log` for any actions taken by escalated sessions |
| Historical data imported with swapped day/month | MEDIUM | Write a migration that identifies ambiguous records (where corrected date would still be in valid range), flags them for manual review; corrected records overwrite with `source: corrected_import` flag |
| Consolidation cost allocation was using count not pallet weight for 3 months | MEDIUM | Write a back-fill migration that recalculates all `transport_cost_warehouse_to_prison_eur` values using the correct pallet-weighted formula; regenerate affected financial records; notify reco-admin of the correction |
| Audit log has gaps (app-layer logging failed) | MEDIUM | Postgres WAL logs retain changes for point-in-time recovery window; for Supabase Pro, PITR can reconstruct missing records within the retention window |
| Prison staff session expired, facility reporting stopped | LOW | reco-admin resends magic link via admin panel; 15-minute recovery if the stable `/prison/login` flow is built |
| ESG report totals changed retroactively after product edit | MEDIUM | Restore the previous `product_materials` record with correct `effective_to` date; add `effective_from/to` date constraints to schema |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS not enabled / wrong command coverage | Phase 1 | CI test: log in as tenant-A user, assert zero rows from tenant-B tables |
| `user_metadata` used in RLS policies | Phase 1 | Splinter lint rule `0015` passes; browser `updateUser` test cannot escalate role |
| `getSession()` on server side | Phase 1 | Code review rule + ESLint config; no `getSession` in `app/` directory server files |
| Cookie domain not set to parent domain | Phase 1 | Cross-subdomain session test in integration suite |
| Missing `tenant_id` indexes | Phase 1 | `EXPLAIN ANALYZE` on all dashboard queries with 10,000-row test dataset shows index scans |
| Middleware routing breaks in Vercel preview | Phase 1 | First PR preview deploy works correctly for ops and client portals |
| Consolidation cost allocation formula error | Phase 1 | Unit test: 3+2+2 pallet scenario verifies €300/€200/€200 split |
| Discrepancy threshold on zero-quantity lines | Phase 2 | Integration test: intake with `informed_quantity = 0` generates no false alert |
| Prison tablet magic link invalidation | Phase 2 | Manual QA: bookmark flow survives session expiry and cookie clear |
| Audit log gaps from app-layer logging | Phase 2 | Trigger-based audit verified by direct SQL edit appearing in log |
| ESG material weight temporal correctness | Phase 3 (schema in Phase 1) | Test: product material update does not change ESG totals for pre-update records |
| Historical import date format ambiguity | Phase 1+2 (each migration phase) | Import preview shows human-readable date sample before commit |
| Public stats endpoint data exposure | Phase 5 | Integration test: public endpoint JSON contains no per-tenant fields |

---

## Sources

- [Supabase RLS Best Practices — makerkit.dev](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase Security Flaw: 170+ Apps Exposed by Missing RLS — byteiota.com](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)
- [RLS references user_metadata — splinter linter rule 0015](https://supabase.github.io/splinter/0015_rls_references_user_metadata/)
- [SSR attack vector when using session from getSession() — Supabase Discussion #23224](https://github.com/orgs/supabase/discussions/23224)
- [getSession() insecure warning on the server — Supabase Discussion #32917](https://github.com/orgs/supabase/discussions/32917)
- [getUser() vs getSession() performance and security — Supabase Discussion #28983](https://github.com/orgs/supabase/discussions/28983)
- [Cross-subdomain authentication issue: Supabase cookie Domain attribute](https://www.answeroverflow.com/m/1391909106838929498)
- [Share sessions across subdomains with Supabase — micheleong.com](https://micheleong.com/blog/share-sessions-subdomains-supabase)
- [Supabase SSR Next.js Server-Side Auth Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Custom Claims & RBAC — Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Custom Access Token Hook — Supabase Docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [RLS Performance and Best Practices — Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [RLS Performance discussion #14576 — supabase/supabase](https://github.com/orgs/supabase/discussions/14576)
- [Build a multi-tenant app with Next.js and Vercel](https://vercel.com/guides/nextjs-multi-tenant-application)
- [Subdomain-Based Routing in Next.js — Medium](https://medium.com/@sheharyarishfaq/subdomain-based-routing-in-next-js-a-complete-guide-for-multi-tenant-applications-1576244e799a)
- [Storage Access Control — Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control)
- [5 common ESG reporting errors — optisolbusiness.com](https://www.optisolbusiness.com/insight/5-common-esg-reporting-errors-and-how-to-correct-them)
- [Common CSV import errors — dromo.io](https://dromo.io/blog/common-data-import-errors-and-how-to-fix-them)
- [Immutable audit logs for SaaS — DEV Community](https://dev.to/beck_moulton/immutable-by-design-building-tamper-proof-audit-logs-for-health-saas-22dc)
- [CVE-2025-49826 Next.js cache poisoning — webasha.com](https://www.webasha.com/blog/what-is-the-nextjs-cache-poisoning-vulnerability-cve-2025-49826-and-how-does-it-lead-to-denial-of-service-dos-attacks)
- [Magic Link expiration — Supabase Docs](https://supabase.com/docs/guides/auth/auth-magic-link)
- [User sessions — Supabase Docs](https://supabase.com/docs/guides/auth/sessions)

---
*Pitfalls research for: reco Platform — multi-tenant SaaS with Next.js App Router + Supabase*
*Researched: 2026-03-19*
