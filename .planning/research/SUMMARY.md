# Project Research Summary

**Project:** reco Platform — multi-tenant circular economy operations SaaS
**Domain:** Multi-tenant SaaS / circular economy logistics operations
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

reco Platform is a bespoke operations SaaS replacing a patchwork of Google Sheets, Google Forms, and email. It must serve six distinct roles (reco-admin, reco, client, client-global, transport, prison) across separate branded subdomains, with strict data isolation between tenants and a highly specialised processing pipeline that routes circular delivery gear through Danish prison facilities. The closest reference architectures are multi-tenant TMS and WMS platforms, but no direct competitor exists in this narrow domain — the platform is being built from scratch against a specific operational reality. The right approach is a monorepo Next.js App Router application with subdomain-based tenant routing, Supabase as the unified backend (Postgres + Auth + Realtime + Storage), and row-level security enforced at the database layer as the primary isolation mechanism.

The recommended stack is mature and well-verified against official sources. Next.js 16 with the App Router, Supabase (Pro plan, EU Frankfurt), Tailwind CSS 4, and shadcn/ui v4 form the proven core. The multi-tenant subdomain pattern — wildcard DNS pointing to a single Vercel deployment, with a `middleware.ts` (or `proxy.ts`) resolving tenant context from the hostname without any DB call — is the official Next.js recommended approach. Auth is handled entirely by Supabase with a Custom Access Token Hook that injects `role`, `tenant_id`, and `facility_id` into JWT `app_metadata` claims, making role and tenant context available to both middleware redirects and RLS policies without additional round-trips. This eliminates the need for a separate ORM (which would bypass RLS) or a second auth library.

The biggest risk is not architectural complexity — the patterns are well-documented — but implementation discipline. The most common production failure mode across similar systems is RLS policies that are written but not enabled, or that cover SELECT but not INSERT/UPDATE/DELETE. This has caused documented data breaches. A second systemic risk is the prison tablet authentication flow: magic links are single-use by design, and a shared facility tablet with a bookmarked magic link will break after first use. Both risks require specific mitigation in Phase 1 before any feature work. Beyond security, the two-leg transport cost allocation formula and the ESG material composition temporal model require precise implementation — errors in either propagate silently and are discovered only weeks later under operational use.

## Key Findings

### Recommended Stack

The stack is tightly integrated and chosen to minimise operational surface area. Supabase acts as four services in one (Postgres, Auth, Realtime, Storage) and eliminates the need for separate identity, notification, and file storage providers. Next.js 16 App Router with Turbopack is the current standard. Biome replaces ESLint + Prettier (required: `next lint` is removed in Next.js 16). TypeScript 5.1+ is non-negotiable given the six-role permission matrix and complex RLS logic.

See full details: `.planning/research/STACK.md`

**Core technologies:**
- **Next.js 16** (App Router + `middleware.ts`, Turbopack) — full-stack framework with native multi-tenant subdomain routing via the official `proxy.ts` pattern
- **Supabase** (Pro, EU Frankfurt) — unified backend: Postgres + RLS + Auth + Realtime + Storage; GDPR-compliant region; point-in-time recovery
- **`@supabase/ssr`** — replaces deprecated auth-helpers; required for cookie-based sessions in App Router; use with `createBrowserClient` / `createServerClient`
- **Tailwind CSS 4 + shadcn/ui v4** — utility-first CSS with CSS custom property tenant branding; shadcn/ui copies components into the repo (no dependency lock-in)
- **TypeScript 5.1+** — required by Next.js 16; essential for type-safe RLS query patterns and generated Supabase types
- **`@tanstack/react-table` v8** — headless tables for all data-dense views (pickup queue, intake records, financial tracking, audit log)
- **`react-hook-form` v7 + Zod v3** — forms and schema validation; schemas defined once, reused client-side and in Server Actions
- **`@react-pdf/renderer` v3** — server-side PDF generation in Route Handlers for ESG exports and packing lists
- **Resend + `react-email` v5** — transactional email; recommended by Supabase; React component templates
- **`next-intl` v3** — i18n scoped to the prison route segment only (Danish labels); no full-app i18n needed
- **`recharts` v2 + Tremor v3** — ESG and ops dashboards; Tremor now Vercel-owned and integrated with shadcn ecosystem
- **`nuqs` v2** — URL search param state for bookmarkable, shareable filtered dashboard views
- **Biome** — linting + formatting (replaces ESLint + Prettier; required for Next.js 16)
- **Vitest + Playwright** — unit/integration tests (including RLS policy tests) + end-to-end tests for auth flows and subdomain routing

**Avoid entirely:** `@supabase/auth-helpers-nextjs` (deprecated), any ORM (Prisma/Drizzle bypass RLS), `next-auth`/Auth.js (breaks `auth.uid()` → RLS connection), `getSession()` server-side (spoofable), Puppeteer for PDFs (200MB binary), `xlsx` in the client bundle (500KB+), ISR on authenticated pages.

### Expected Features

The MVP is a two-phase delivery that retires Google Sheets (Phase 1) and Google Forms (Phase 2). No direct competitor exists — the differentiators are domain-specific rather than feature-checklist competitive.

See full details: `.planning/research/FEATURES.md`

**Must have (table stakes — Phase 1 + 2):**
- Auth system with all six roles — nothing else can be role-gated without this
- Multi-tenant data isolation with RLS — prerequisite for all data operations
- Product Registry (pre-loaded with Wolt data) — required by pickup form and every downstream module
- Pickup booking form (wolt.courierrecycling.com) — replaces the Google Sheets entry point
- Pickup queue and status management (ops.courierrecycling.com) — reco-admin daily workflow
- Transport management (direct + consolidation modes, two-leg cost model) — full transport chain
- Consolidation warehouse inventory view — consolidation provider workflow
- Prison intake and counting module (tablet-first, Danish labels) — replaces GreenLoop Google Form
- Discrepancy detection and alerts (informed vs actual quantities) — addresses the documented +217% problem
- Edit-in-place with audit trail and 48-hour window — required before any editable record type ships
- Prison processing reports (Wash/Pack) — completes the prison pipeline
- Basic email notifications on key events — replaces email-and-hope coordination
- Search/filter on all data tables — operations data is inaccessible without it
- Data export (CSV/PDF) — always required for ops and compliance teams
- Historical data import — pickup log (Phase 1), prison intake log (Phase 2)

**Should have (differentiators — Phase 3+):**
- Material-level ESG calculation engine (grams per material type × actual items = exact kg recovered) — genuine data asset competitors lack
- Financial tracking module with two-leg cost allocation — required for invoice accuracy
- ESG dashboards with per-client and aggregated views + exportable PDF/CSV
- Batch/lot defect tracking with quarantine — prevents defective gear entering the reuse stream
- Tenant branding with CSS custom properties and WCAG contrast validation
- Client onboarding wizard with live branding preview
- Public aggregated ESG stats on the marketing site (ISR, no per-client data)

**Defer to v2+:**
- Invoice generation and payment processing (accounting software boundary)
- Native mobile apps (tablet-first responsive web is sufficient)
- Per-staff prison accounts (facility-level accounts are the correct model)
- Offline-first with sync (validate connectivity first)
- Full ESG framework compliance reporting (GRI, SASB, CSRD)
- SEKO integration and recycling partner management
- Email processing module with AI extraction
- SSO integration, custom domain support, API endpoints for clients

**Anti-features (explicitly never build):** Courier personal data, internal prison cost structures, real-time WebSocket on all data, tax/VAT calculations.

### Architecture Approach

The system is a single Next.js App Router deployment served across multiple subdomains via Vercel wildcard DNS. Tenant context is resolved entirely from the hostname in middleware — no DB call. Auth context is resolved from JWT `app_metadata` claims injected by a Postgres Custom Access Token Hook at token issuance. The result is that middleware performs zero database queries on every request: tenant slug comes from string parsing, role/tenant_id come from the cached JWT. DB calls happen only in server components, server actions, and route handlers.

The application is structured into three route groups — `(public)` (marketing site, no auth), `(ops)` (reco + transport + prison portal), `(client)` (tenant portal with per-tenant branding) — each with its own layout providing auth enforcement and domain-specific shell. RLS at the database layer enforces tenant isolation regardless of application code correctness. The critical data flow paths are: pickup booking → transport management → prison intake → processing reports, with financial records and ESG calculation engine sitting downstream as consumers of all upstream data.

See full details: `.planning/research/ARCHITECTURE.md`

**Major components:**
1. **`middleware.ts`** — hostname parsing → domain context + tenant slug resolution; session refresh; auth redirect; zero DB calls
2. **Supabase Auth + Custom Access Token Hook** — JWT carries `role`, `tenant_id`, `facility_id` in `app_metadata`; RLS reads JWT directly without extra queries
3. **Route group layouts `(ops)` / `(client)`** — server-component role guards; tenant branding injection (client portal only, via `unstable_cache`)
4. **RLS policies (Postgres)** — primary data isolation mechanism; enforced at DB layer independent of application code; every tenant-scoped table must have `ENABLE ROW LEVEL SECURITY` in migration SQL
5. **Supabase Realtime** — notification-only WebSocket subscriptions; not used for broad data sync
6. **Server Actions + Route Handlers** — form mutations, PDF export, signed file upload URLs; keep Supabase service_role key out of Next.js code
7. **Supabase Edge Functions** — email dispatch (Resend) and custom access token hook; kept out of Next.js request path

**Build order constraint:** Schema + RLS migrations → Custom Access Token Hook → Middleware → Route group shells → Tenant branding → Product registry → Pickup booking → Transport → Prison intake → Financial records → Dashboards → Notifications → Data import → Audit log viewer → Marketing site.

### Critical Pitfalls

See full details and verification checklist: `.planning/research/PITFALLS.md`

1. **RLS enabled on table but not enforced by policy** — the most common production data breach vector; `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` must be in migration SQL (not applied via Studio UI); write explicit SELECT/INSERT/UPDATE/DELETE policies; add a CI test that logs in as tenant-A and asserts zero rows from tenant-B data before every deploy.

2. **`user_metadata` used in RLS policies instead of `app_metadata`** — `user_metadata` is writable by the authenticated user from the browser; any user can escalate their own role; all RLS policies and role injection must use `app_metadata` exclusively; enforced by Supabase `splinter` linter rule `0015`.

3. **`getSession()` called server-side** — reads cookie without JWT signature verification; a crafted cookie bypasses identity checks; always use `getUser()` server-side (makes a network round-trip to Supabase Auth to verify the signature); configure ESLint/Biome to flag `getSession` in server files.

4. **Auth cookie not scoped to parent domain** — without `cookieOptions: { domain: '.courierrecycling.com' }` in all Supabase SSR client creation paths, login on one subdomain is invisible to another; prison magic link callbacks fail; set this consistently in middleware, browser client, and server client.

5. **Missing indexes on `tenant_id` and RLS-referenced columns** — every migration that adds a `tenant_id` column must include `CREATE INDEX ... ON table_name (tenant_id)`; without this, RLS policies cause full table scans and dashboards collapse at 5,000+ rows; add composite `(tenant_id, status)` indexes for dashboard filter queries.

6. **Prison magic link bookmark invalidation** — magic links are single-use; a bookmarked link breaks after first use; build a stable `/prison/login?facility=X` page that triggers sending a fresh link, not a direct magic link bookmark.

7. **ESG material weight temporal incorrectness** — if `product_materials` composition is updated in-place (no `effective_from`/`effective_to`), all historical ESG calculations retroactively change; the schema must include temporal columns from Phase 1 even though ESG calculation is Phase 3.

8. **Consolidation transport cost allocation formula error** — dividing by booking count instead of pallet count produces incorrect per-delivery costs that still reconcile to the total (invisible bug); implement as a database function, add a constraint verifying allocation sum equals shipment cost, and write a unit test for the 3+2+2 pallet scenario.

## Implications for Roadmap

The research converges on a clear phase structure driven by dependency chains and the requirement that security foundations must be in place before any feature work. The feature dependency map from FEATURES.md, the build order from ARCHITECTURE.md, and the phase-to-pitfall mapping from PITFALLS.md all suggest the same ordering.

### Phase 1: Foundation and Pickup Operations

**Rationale:** Every other module depends on auth, multi-tenancy, and the product registry. Pickup booking is the first user-facing workflow and the direct replacement for Google Sheets. Transport management must ship in the same phase because pickup requests without transport tracking are operationally incomplete. Historical pickup data import is needed for dashboards to be meaningful from day one.

**Delivers:** Fully operational pickup and transport management; reco-admin + client + transport roles active; subdomain routing live; multi-tenant data isolation enforced; historical pickup log imported.

**Addresses features:** Auth (all six roles), multi-tenant data model + RLS, product registry (Wolt pre-load), pickup booking form, pickup queue and status management, transport management (direct + consolidation, two-leg cost), consolidation warehouse inventory view, basic email notifications, system settings, historical pickup data import.

**Avoids:** RLS not enabled (CI test from day 1), `user_metadata` role escalation (app_metadata from first migration), `getSession()` server-side (pattern set in auth utilities before any routes), cookie domain scope (set in middleware before cross-subdomain testing), missing `tenant_id` indexes (in every migration file), middleware preview deploy breakage (resolveContext utility covers all hostname formats), consolidation cost allocation error (DB function + unit test before first outbound shipment).

**Research flag:** Standard patterns — Next.js multi-tenant subdomain routing, Supabase Auth with Custom Access Token Hook, and RLS policy structure are all well-documented with official guides. No additional phase research needed; the implementation patterns are in ARCHITECTURE.md.

### Phase 2: Prison Processing Pipeline

**Rationale:** Prison intake depends on transport management (expected deliveries come from confirmed transport bookings) and the product registry (both must exist from Phase 1). Audit trail and edit-in-place must be designed before the first editable record type — they cannot be retrofitted. Discrepancy detection requires intake data to exist. Historical prison intake import gives ESG and financial calculations meaningful historical depth.

**Delivers:** Full prison processing pipeline operational; prison role active on tablets with Danish UI; discrepancy detection and batch/lot quarantine live; audit trail enforced via DB triggers; historical prison intake log and GreenLoop data imported.

**Addresses features:** Prison intake + counting (tablet-first, Danish labels), discrepancy detection + alerts, batch/lot tracking + quarantine, prison processing reports (Wash/Pack), prison outbound dispatch, edit-in-place + audit trail (trigger-based), 48-hour edit window, historical prison intake import.

**Avoids:** Prison magic link invalidation (build `/prison/login?facility=X` stable page before prison module ships), discrepancy formula on zero-quantity lines (encode business rule in DB function not UI), audit log gaps (trigger-based logging before any editable record type exists), historical import date format ambiguity (mandatory date format selection + preview before commit).

**Research flag:** Prison tablet UX and Danish i18n patterns are well-documented (`next-intl` official docs cover App Router). The 48-hour edit window enforcement mechanism (time-boxed DB check) is standard. No additional phase research needed.

### Phase 3: Intelligence Layer (Financial + ESG)

**Rationale:** Financial tracking requires both actual intake quantities (Phase 2) and transport costs (Phase 1) to calculate estimated invoice amounts. ESG calculation requires accurate historical intake data from Phase 2 import before the numbers are meaningful. Both are read-only consumers of upstream data — building them before upstream data is complete would produce misleading outputs.

**Delivers:** Financial tracking module with per-delivery cost breakdown; ESG calculation engine with material-level output; role-scoped dashboards for reco-admin, client, and transport; CSV and PDF export for both.

**Addresses features:** Financial tracking module, ESG calculation engine (material grams × actual quantities), reco aggregated cross-client dashboard, client ESG dashboard + export (PDF + CSV), data export (CSV/PDF).

**Avoids:** ESG material weight temporal incorrectness (schema already has `effective_from`/`effective_to` from Phase 1; calculation joins on historical composition), ESG dashboard performance (materialised view refreshed daily; default date range filter on all dashboard queries), N+1 queries in dashboard views (single join queries for all aggregate views).

**Research flag:** ESG material calculation methodology (CO2 avoided formula, reuse rate calculation) needs domain-specific validation. The formula inputs and assumptions must be documented for client external reporting. Flag for research-phase during planning — the formula is not standardised and Wolt's requirements may impose specific methodology.

### Phase 4: Operations Quality

**Rationale:** These features add significant value to an already-operational system but do not block any core workflow. The audit log viewer is a UI concern — the audit trail itself accumulates throughout Phases 1-3. The FAQ system reduces support burden once the system is in daily use. In-app notification improvements build on the notification infrastructure from Phase 1.

**Delivers:** Audit log viewer UI; FAQ/manual system with role-scoped content (editable by reco-admin); enhanced in-app notification centre.

**Addresses features:** Audit log viewer, FAQ/manual system, in-app notification improvements.

**Research flag:** Standard patterns — no additional research needed. Audit log viewer is a read-only TanStack Table view. FAQ is markdown-rendered content management.

### Phase 5: Scale and Onboarding

**Rationale:** The client onboarding wizard is only needed when a second client joins — premature for Phase 1. The marketing site requires mature ESG data to show meaningful public stats. Both depend on the full platform being stable and the data model being settled.

**Delivers:** Client onboarding wizard with live branding preview and instant subdomain provisioning; marketing site (courierrecycling.com) with ISR public stats; public aggregated ESG stats endpoint.

**Addresses features:** Client onboarding wizard, tenant branding config (WCAG contrast validation), market/location registry, user invitation system, marketing site with public stats.

**Avoids:** Public stats endpoint tenant data exposure (integration test asserts no `tenant_id` or per-tenant fields in response before endpoint goes live).

**Research flag:** No additional research needed. The onboarding wizard is a multi-step form with known patterns. The ISR public stats endpoint is a read-only aggregation query.

### Phase Ordering Rationale

- **Security layer before features:** RLS policies, JWT claims, and middleware must be live before any data is created. Retrofitting security onto an existing data model is dangerous and expensive.
- **Product Registry before every form:** The pickup form, prison intake form, ESG engine, and financial tracking all require the product list. Building forms before the product schema is settled forces rework.
- **Transport before prison:** Prison intake links to transport bookings for expected delivery pre-population. The linkage is optional (unexpected deliveries still work) but the core workflow requires it.
- **Intake before financial and ESG:** Both financial tracking and ESG calculation consume actual intake quantities. Estimates without actuals produce misleading numbers that undermine trust in the platform.
- **Audit trail before edit-in-place:** The 48-hour edit window enforcement is only verifiable if the audit trail is complete. These must ship together in Phase 2 — not split across phases.
- **ESG data maturity before marketing site:** The marketing site's credibility depends on showing real aggregate numbers. Placeholder stats are worse than no stats.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (ESG calculation):** The CO2 avoided formula and reuse rate calculation methodology are not standardised. Wolt's ESG reporting requirements may specify a particular methodology (e.g. LCA-based vs. displacement-based). This needs validation before the calculation engine is built — the formula must be agreed upon and documented as part of the spec.

Phases with standard patterns (skip additional research):
- **Phase 1:** Next.js multi-tenant subdomain routing, Supabase Auth + Custom Access Token Hook, and RLS are fully documented with official guides. Implementation patterns are captured in ARCHITECTURE.md and STACK.md.
- **Phase 2:** Prison tablet UX (single-column forms, large touch targets, pre-population) and `next-intl` App Router i18n are well-documented. Trigger-based audit logging is a standard Postgres pattern.
- **Phase 4:** Audit log viewer (read-only table) and FAQ (markdown content management) are commodity features with no novel implementation requirements.
- **Phase 5:** Client onboarding wizard and ISR marketing site are standard Next.js patterns documented in the official multi-tenant guide.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies verified against official docs and release notes; version compatibility table verified against npm registry as of 2026-03-19; no speculative dependencies |
| Features | HIGH | Primary sources are the verified PRD and PROJECT.md; secondary research from web sources used only for UX pattern validation; feature dependency map cross-checks against domain knowledge |
| Architecture | HIGH | Multi-tenant subdomain pattern, Custom Access Token Hook, and RLS policy structure all verified against official Next.js and Supabase documentation with code examples; no community-only patterns in critical paths |
| Pitfalls | HIGH | Most critical pitfalls (RLS exposure, user_metadata escalation, getSession() spoofing) verified against official Supabase documentation, GitHub discussions, and a documented CVE; integration gotchas verified against multiple independent sources |

**Overall confidence:** HIGH

### Gaps to Address

- **ESG CO2 calculation formula:** The specific methodology (displacement-based, LCA-based, or a simplified weight-to-CO2 factor) is not defined in the PRD. The formula must be agreed with reco and ideally with Wolt's ESG team before Phase 3 development begins. Document the formula, its inputs, and its assumptions as part of the Phase 3 spec — this is a client-deliverable number and methodology disputes are expensive after the fact.

- **Prison facility internet connectivity:** FEATURES.md notes that tablet connectivity at Danish prison facilities is unvalidated. The architecture assumes reliable connectivity (no offline sync). If facilities have unreliable connectivity, the prison intake form needs optimistic UI with retry logic at minimum, and possibly a more significant architecture change. Validate connectivity before Phase 2 planning locks the form submission model.

- **Wolt market contact email addresses for notifications:** The notification system sends transactional email on key events. The pickup booking confirmation email recipient list depends on whether Wolt market contacts have been added to the platform as `client` users or exist only in Google Sheets. This affects Phase 1 notification scope — clarify before building the email flow.

- **Prison facility management email access:** Pitfall 9 (magic link invalidation) is mitigated by a stable `/prison/login?facility=X` page that sends a new magic link to the facility's registered email. If the facility management email inbox is not reliably monitored, the alternative (shared facility password) should be considered. Validate during Phase 2 planning before the prison login flow is built.

## Sources

### Primary (HIGH confidence)
- reco Platform PRD v1.5 — features, domain requirements, role definitions, financial model
- reco Platform PROJECT.md — product scope, constraints, anti-features
- Next.js 16 release blog (nextjs.org/blog/next-16) — stack, middleware deprecation, proxy.ts pattern
- Next.js multi-tenant guide (nextjs.org/docs/app/guides/multi-tenant) — architecture, subdomain routing
- Supabase `@supabase/ssr` docs — auth client creation, cookie-based sessions
- Supabase Custom Access Token Hook docs — JWT claims injection, role in app_metadata
- Supabase Custom Claims RBAC docs — role-based access control pattern
- Supabase RLS docs — policy structure, enable/disable, performance
- `@supabase/supabase-js` npm registry (v2.99.2, 2026-03-19) — version verification
- shadcn/ui changelog (ui.shadcn.com/docs/changelog) — CLI v4 March 2026
- TanStack Query v5 docs (tanstack.com/query/latest) — version verification
- next-intl App Router docs (next-intl.dev) — i18n Server Component support
- Supabase Discussion #23224 — getSession() server-side insecurity
- Supabase Discussion #32917 — getSession() deprecation warning
- Supabase Discussion #28983 — getUser() vs getSession() performance
- splinter linter rule 0015 — user_metadata in RLS policies
- CVE-2025 / byteiota.com — 170+ apps exposed by missing RLS

### Secondary (MEDIUM confidence)
- makerkit.dev — Supabase RLS best practices; real-time notifications with Next.js
- micheleong.com — cross-subdomain cookie domain setting
- Vercel Platforms Starter Kit — reference implementation for multi-tenant pattern
- AufaitUX, UX Collective, Pencil & Paper — operations dashboard UX patterns
- DEV Community (beck_moulton) — immutable audit logs for SaaS

### Tertiary (LOW confidence)
- Okon Recycling — recycling impact calculation methodology (reference only; actual formula must be validated with reco/Wolt)

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
