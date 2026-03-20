# reco Platform

## What This Is

reco Platform is a SaaS application that replaces a patchwork of Google Sheets, Google Forms, email threads, and manual tracking with a single system for managing circular gear operations. It covers the full lifecycle of courier delivery gear recycling: pickup booking, transport coordination, prison processing (intake, washing, packing, dispatch), invoice tracking, and ESG reporting. It is owned and operated by reco ApS, with Wolt and transport providers as the first tenants.

## Core Value

Every delivery is tracked from booking to invoice, and every item from pickup to recycling or redistribution — no uninvoiced deliveries, no missing processing data, no counting discrepancies above 10%.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Subdomain routing: ops.courierrecycling.com + [client].courierrecycling.com + courierrecycling.com from a single Next.js app
- [ ] Multi-tenant data model with RLS (Supabase), single-tenant UI for reco-Wolt initially
- [ ] Six user roles: reco-admin, reco, client, client-global, transport, prison
- [ ] Supabase Auth with email/password, magic link, and simplified prison facility login (tablet-bookmarked, 7-day session)
- [ ] Per-user financial visibility toggle for reco role
- [ ] Pickup booking form for client users with dynamic product list, pallet dimensions, photo upload
- [ ] Transport management: direct and consolidation modes, two-leg cost model, outbound shipment creation
- [ ] Consolidation provider warehouse inventory view and outbound shipment management
- [ ] Prison intake and counting: expected and unexpected deliveries, per-pickup forms, discrepancy tracking
- [ ] Batch/lot tracking with defective batch flags and quarantine alerts
- [ ] Prison processing reports: Wash and Pack forms, size-bucket quantities for clothing
- [ ] Prison outbound dispatch: clothing shipments to redistribution partner with packing list and SKU codes
- [ ] Edit-in-place with audit trail; 48-hour edit window for prison staff; void (not delete) for bad records
- [ ] reco dashboard: aggregated cross-client view with client context switching
- [ ] Client dashboard: per-location view (client role) and cross-market aggregated view (client-global role)
- [ ] Transport dashboard for transport providers
- [ ] Financial tracking: invoice status, transport cost, auto-calculated estimated invoice amounts
- [ ] ESG metrics: material recycling totals (grams × items), reuse rate, CO2 avoided, exportable reports
- [ ] Product registry: per-client products with material composition, photos, pricing, product groups, processing stream
- [ ] Material library (global reference table)
- [ ] Tenant branding: per-tenant CSS custom properties, logo, colours, fonts with reco defaults as fallback
- [ ] Notification system: email + in-app for key events, unmutable critical alerts
- [ ] FAQ and manual system: client version and prison version, markdown-rendered, editable by reco-admin
- [ ] Client onboarding wizard: company details, branding, markets, products, user invitations, activation
- [ ] Historical data import: CSV/XLSX with field mapping UI, validation, import flag
- [ ] Audit log viewer
- [ ] System settings: exchange rate config, facility registry, alert thresholds
- [ ] Marketing site (courierrecycling.com): public stats via ISR, aggregated-only, no client data
- [ ] Email processing module (Phase 2): auto-extract pickup requests from inbox

### Out of Scope

- Invoice generation — use accounting software
- Payment processing — not in scope
- Tax/VAT calculations — not in scope
- Courier personal data — stays in Wolt's systems
- SEKO integration — downstream of reco's scope
- Recycling partner management — confidential, stays offline
- Mobile native apps — responsive web sufficient
- Internal prison cost structures — must never appear in any client-visible surface

## Context

- **Domain:** Circular economy / gear recycling for delivery companies. Wolt is the first and currently only client.
- **Current state:** Operations run on Google Sheets, Google Forms, and email. Key documented problems: counting discrepancies up to +217%, uninvoiced deliveries, prison reporting gaps, no real-time status visibility across 15+ markets.
- **Multi-tenant from day 1:** Database schema includes `tenant_id` on every table. RLS policies enforce isolation. UI is single-tenant initially; second client requires only onboarding tooling.
- **Prison context:** Three Danish prison facilities (Møgelkær, Sdr. Omme, Renbæk) process the gear. Staff use shared facility tablets, not individual accounts. Danish language required for prison UI.
- **Data to migrate:** Pickup logs (2023–2026), prison intake logs (2022–2026), GreenLoop form data (2025), invoice binder, transport cost spreadsheet, Wolt product/material workbook.
- **Historical data:** 2022–2026 records must be fully migrated and queryable at launch.

## Constraints

- **Tech stack:** Next.js (App Router) + Supabase (Postgres + Auth + Realtime + Storage) + Vercel — per PRD architecture decisions
- **Data residency:** EU data centres (GDPR compliance) — Frankfurt or Stockholm
- **DNS:** Wildcard CNAME `*.courierrecycling.com` → Vercel for instant subdomain provisioning
- **Performance:** Dashboard <2s for up to 50,000 records; search/filter <500ms; up to 50 concurrent users
- **Availability:** 99.5% uptime target
- **Security:** RLS on every table, API routes protected by auth middleware, HTTPS only, no sensitive data in URL params
- **Accessibility:** WCAG 2.1 AA compliance target; prison module tablet-first with large touch targets

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single Next.js app for all domains | Middleware-based subdomain routing keeps deployment simple; no separate repos per tenant | — Pending |
| Supabase for auth + DB + storage | Managed Postgres with RLS, built-in auth, realtime subscriptions, EU region available | — Pending |
| Multi-tenant schema from day 1 | Adding second client requires zero DB changes | — Pending |
| Facility-level prison accounts (not per-staff) | Replaces Google Form friction; one bookmarked tablet link per facility | — Pending |
| Product registry instead of hardcoded gear types | Supports any future client's product catalogue without schema changes | — Pending |
| No delete, only void | Preserves audit trail; prevents data loss from accidental deletion | — Pending |
| Two-leg transport cost model | Accurately tracks market→warehouse + warehouse→prison costs for consolidation routes | — Pending |
| Pricing at product level with effective_from/to dates | Historical deliveries retain the rate active at time of delivery | — Pending |

---
*Last updated: 2026-03-20 — Phase 3 complete: Product Registry (material library, product schema, UI, Wolt seed)*
