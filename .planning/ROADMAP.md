# Roadmap: reco Platform

## Overview

reco Platform replaces a patchwork of Google Sheets, Google Forms, and email with a single multi-tenant SaaS covering the full circular gear lifecycle: pickup booking, transport coordination, prison processing, financial tracking, and ESG reporting. The build order is dictated by hard data dependencies — security and schema foundations before any feature, product registry before any form, transport before prison intake, intake before financial and ESG calculations. Ten phases deliver the complete platform, with the first four phases retiring the primary operational tools (Google Sheets for pickup tracking, Google Forms for prison intake).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Foundation** - DB schema, RLS, JWT hook, subdomain routing, system settings (completed 2026-03-20)
- [x] **Phase 2: Auth, Roles, and Tenant Branding** - All six roles, per-tenant branding, CSS custom properties (completed 2026-03-20)
- [x] **Phase 3: Product Registry** - Per-tenant product catalogue with materials, pricing, and Wolt pre-load (completed 2026-03-20)
- [x] **Phase 4: Pickup Booking and Transport Management** - Client booking form, transport booking, consolidation warehouse (completed 2026-03-20)
- [x] **Phase 5: Prison Intake and Counting** - Tablet-first intake forms, discrepancy detection, batch quarantine (completed 2026-03-20)
- [ ] **Phase 6: Prison Processing, Dispatch, and Audit Trail** - Wash/Pack reports, outbound dispatch, edit-in-place with audit
- [ ] **Phase 7: Financial Tracking** - Per-delivery financial records, invoice status, two-leg cost allocation
- [ ] **Phase 8: Dashboards and ESG Metrics** - Role-scoped dashboards, ESG calculation engine, export
- [ ] **Phase 9: Notifications and Manuals** - In-app and email notifications, FAQ/manual system
- [ ] **Phase 10: Historical Data Import** - CSV/XLSX import with field mapping, validation, and import flag

## Phase Details

### Phase 1: Infrastructure Foundation
**Goal**: The platform infrastructure is live and secure; every subsequent feature can be built on top without revisiting security or schema
**Depends on**: Nothing (first phase)
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-10, SETTINGS-01, SETTINGS-02
**Success Criteria** (what must be TRUE):
  1. Visiting `wolt.courierrecycling.com`, `ops.courierrecycling.com`, and `courierrecycling.com` from the same browser resolves to the correct domain context without a database call
  2. A user logged in on one subdomain is recognised as authenticated on all other subdomains (shared cross-domain cookie)
  3. A Vitest RLS integration test that logs in as a tenant-A user asserts zero rows from tenant-B tables, and this test runs in CI on every deploy
  4. reco-admin can configure exchange rate, warehouse ageing threshold, discrepancy threshold, and prison facility registry in system settings
  5. JWT tokens contain role, tenant_id, location_id, and facility_id in app_metadata; service_role key is absent from all Next.js API routes
**Plans**: 7 plans

Plans:
- [ ] 01-01-PLAN.md — Scaffold Turborepo monorepo with Next.js 16, Drizzle, shared types, Biome, shadcn/ui, Dockerfile
- [ ] 01-02-PLAN.md — Drizzle schema: auth tables, tenants, facilities, settings, audit log with RLS policies and indexes
- [ ] 01-03-PLAN.md — Auth.js v5 dual-provider config (Entra ID + Resend), JWT claims injection, cross-subdomain cookies
- [ ] 01-04-PLAN.md — proxy.ts subdomain-based tenant resolution with unit tests
- [ ] 01-05-PLAN.md — Route group shells (ops, client, public) with auth guards, sign-in page, prison login page
- [ ] 01-06-PLAN.md — System settings UI: exchange rate, thresholds, prison facility registry with inline editing
- [ ] 01-07-PLAN.md — RLS integration test harness, schema assertions, GitHub Actions CI pipeline

### Phase 2: Auth, Roles, and Tenant Branding
**Goal**: All six user roles can authenticate and reach their correct portal; client portals render with tenant-specific branding
**Depends on**: Phase 1
**Requirements**: AUTH-09, BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05
**Success Criteria** (what must be TRUE):
  1. A client portal with a branding record renders using tenant colours, logo, and fonts via CSS custom properties; no hardcoded colours exist in component code
  2. A client portal with no branding configured is visually identical to the ops portal (reco defaults applied)
  3. A branding configuration that fails WCAG AA contrast is rejected at save time with a specific error message
  4. Prison staff can reach `ops.courierrecycling.com/prison` via a stable bookmarked page that issues a fresh magic link; the bookmark never breaks after first use
  5. reco-admin can invite a user by email, assign a role, and deactivate that user; the invited user receives an email and can set their password
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Credentials provider, password_hash column, sign-in page update, user invite/deactivate management UI
- [ ] 02-02-PLAN.md — Auth-aware proxy.ts with role-based post-login redirect, wrong-portal redirect, prison callbackUrl fix
- [ ] 02-03-PLAN.md — tenant_branding schema with RLS, branding helper library, CSS variable injection in client layout
- [ ] 02-04-PLAN.md — Branding config UI tab with live preview, WCAG AA contrast validation, saveBranding Server Action

### Phase 3: Product Registry
**Goal**: reco-admin can manage a complete product catalogue per tenant; Wolt products are pre-loaded and ready for use in all downstream forms
**Depends on**: Phase 2
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, PROD-07, PROD-08
**Success Criteria** (what must be TRUE):
  1. Wolt's five product types (Bike Bag, Car Bag, Inner Bag, Heating Plate, Clothing) are present at deployment with correct weights, material compositions, and pricing from the PRD
  2. reco-admin can add a product with photos, material composition lines from the global material library, and effective-dated pricing records
  3. A product with material composition changed via a new effective-dated record shows the old composition for deliveries before the change date and the new composition for deliveries after — visible in the product detail view
  4. The global material library lists canonical materials (Polyester, PVC, Polypropylene, etc.) and is shared across all tenants
**Plans**: 5 plans

Plans:
- [ ] 03-01-PLAN.md — Material library schema + Wave 0 test stubs + Supabase Storage helpers
- [ ] 03-02-PLAN.md — Products, product_materials, product_pricing schema with RLS and migration
- [ ] 03-03-PLAN.md — Product list page, detail page, create/edit form, photo upload UI
- [ ] 03-04-PLAN.md — Material composition inline table + pricing management UI with effective dates
- [ ] 03-05-PLAN.md — Wolt product seed script with all 5 products, materials, and pricing from PRD 4.10

### Phase 4: Pickup Booking and Transport Management
**Goal**: Client users can book pickups through the platform and reco-admin can fully manage transport — replacing Google Sheets as the operational record of truth for pickup and transport workflows
**Depends on**: Phase 3
**Requirements**: PICKUP-01, PICKUP-02, PICKUP-03, PICKUP-04, PICKUP-05, PICKUP-06, PICKUP-07, PICKUP-08, TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05, TRANS-06, TRANS-07, TRANS-08, TRANS-09, TRANS-10
**Success Criteria** (what must be TRUE):
  1. A client user can submit a pickup request with product quantities, pallet details, preferred date, photos, and receive a confirmation email with a PU-YYYY-NNNN reference number
  2. reco-admin can book direct transport (select provider, prison, cost) or consolidation transport (select provider, warehouse leg cost) from a confirmed pickup
  3. A consolidation provider can view their warehouse inventory (held pickups with ageing), create an outbound shipment selecting multiple pickups, and the warehouse→prison cost is allocated pro-rata by pallet count
  4. When an outbound shipment is marked delivered, all linked pickup requests automatically advance to the delivered status
  5. reco-admin receives an in-app alert when any pallet has been held at a consolidation warehouse beyond the configured threshold
**Plans**: 10 plans

Plans:
- [x] 04-01-PLAN.md — Locations, pickups, transport, notifications schema with RLS + migration SQL with PU-YYYY-NNNN trigger
- [x] 04-02-PLAN.md — Client pickup booking form with product quantities, auto-weight, 72h date validation, photo upload
- [x] 04-03-PLAN.md — Pickup queue (ops + client) with status tabs, confirm/cancel actions, nav bar updates
- [x] 04-04-PLAN.md — Transport provider registry CRUD: list, create, edit with tenant linking
- [x] 04-05-PLAN.md — Direct and consolidation transport booking from pickup detail page
- [x] 04-06-PLAN.md — Consolidation warehouse inventory with colour-coded ageing and threshold alerts
- [x] 04-07-PLAN.md — Outbound shipment creation with pro-rata cost allocation and delivery cascade
- [x] 04-08-PLAN.md — Transport provider portal: assigned pickups, status updates, POD upload
- [x] 04-09-PLAN.md — Resend email integration: pickup confirmation to client, alert to reco-admin, in-app notification
- [x] 04-10-PLAN.md — Integration wiring: transport summary on pickup detail, delivery actions on outbound page

### Phase 5: Prison Intake and Counting
**Goal**: Prison staff can register all incoming deliveries on facility tablets with Danish-language forms; discrepancies and defective batches are automatically detected and flagged
**Depends on**: Phase 4
**Requirements**: INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07, INTAKE-08
**Success Criteria** (what must be TRUE):
  1. Prison staff at a pre-authenticated facility tablet can reach the intake form in two taps and submit a delivery count without entering any login credentials
  2. An expected delivery pre-populates client, market, and product list from the linked transport booking; prison staff can adjust quantities and the form flags any line that exceeds the discrepancy threshold
  3. An unexpected delivery can be registered manually by selecting a client from a dropdown; reco-admin receives an alert
  4. A batch number matching a flagged entry in the batch_flags table triggers a quarantine alert to both prison staff and reco-admin; the intake record cannot be committed without reco-admin override
  5. The discrepancy dashboard shows discrepancy rates by country, product, and prison facility, and auto-flags persistent problem markets
**Plans**: 8 plans

Plans:
- [x] 05-01-PLAN.md — Intake schema (intake_records, intake_lines, batch_flags) with RLS, IN-YYYY-NNNN trigger, pure utility functions, Wave 0 test stubs
- [x] 05-02-PLAN.md — next-intl setup, prison tablet shell layout with Danish i18n, ops nav Intake link
- [x] 05-03-PLAN.md — Incoming deliveries view: expected delivery card grid with direct/consolidated grouping
- [x] 05-04-PLAN.md — Expected intake form with pre-population, quantity spinners, discrepancy detection, success screen
- [x] 05-05-PLAN.md — Unexpected intake form with client dropdown, manual entry, reco-admin notification
- [x] 05-06-PLAN.md — Batch quarantine: batch_flags lookup, server-side enforcement, ops override action
- [x] 05-07-PLAN.md — Ops portal intake queue with status tabs, quarantine override dialog
- [x] 05-08-PLAN.md — Discrepancy dashboard: rates by country/product/facility, persistent problem market auto-flag

### Phase 6: Prison Processing, Dispatch, and Audit Trail
**Goal**: Prison staff can submit Wash and Pack processing reports and view the full traceability chain; reco-admin can create outbound dispatch records; every editable record type has a complete, trigger-based audit trail
**Depends on**: Phase 5
**Requirements**: PROCESS-01, PROCESS-02, PROCESS-03, PROCESS-04, PROCESS-05, DISPATCH-01, DISPATCH-02, DISPATCH-03, DISPATCH-04, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05, AUDIT-06
**Success Criteria** (what must be TRUE):
  1. Prison staff can submit a Wash or Pack report in two taps from the prison home screen; size-bucket quantities work for clothing and total quantity for bags
  2. The full traceability chain (pickup request → transport → prison intake → wash → pack → dispatch) is visible as a linked view from any record in the chain
  3. Any edit to an intake record or processing report shows a visual "edited" indicator with a link to the full field-level edit history
  4. Prison staff cannot edit an intake record or processing report submitted more than 48 hours ago; reco-admin can edit any record at any time
  5. A record marked voided by reco-admin is excluded from all calculations but remains visible in the audit trail with the void reason
**Plans**: 9 plans

Plans:
- [x] 06-01-PLAN.md — Complete Phase 6 migration SQL (all tables, enums, triggers, RLS, GRANTs) + audit helper library
- [x] 06-02-PLAN.md — Edit-in-place Server Actions with 48-hour lock, EditedIndicator and EditHistoryModal components
- [ ] 06-03-PLAN.md — Void policy: voidRecord helper, voidIntakeRecord action, VoidRecordDialog component
- [x] 06-04-PLAN.md — Processing report Drizzle schema with RLS, product_category enum on products
- [ ] 06-05-PLAN.md — Wash and Pack forms: tablet-first, Danish labels, size-bucket inputs, two-tap access from prison home
- [ ] 06-06-PLAN.md — Processing pipeline view with stage derivation: awaiting/in-progress/ready-to-ship/shipped
- [x] 06-07-PLAN.md — Outbound dispatch Drizzle schema with RLS + createDispatch/updateDispatchStatus Server Actions
- [ ] 06-08-PLAN.md — Dispatch UI: prison read-only history, ops list/create/detail with packing list
- [ ] 06-09-PLAN.md — Traceability chain view: linked record path from pickup through dispatch on intake detail

### Phase 7: Financial Tracking
**Goal**: Every delivered intake record has a financial record with accurate two-leg cost breakdown and invoice status; reco-admin can manage invoice lifecycle and see uninvoiced delivery alerts
**Depends on**: Phase 6
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06
**Success Criteria** (what must be TRUE):
  1. Every intake record in delivered status has a corresponding financial record showing transport cost (sum of both legs), estimated invoice amount (quantities × current pricing + transport), and invoice status
  2. reco-admin can update invoice status (not_invoiced / invoiced / paid), invoice number, invoice date, and notes on any financial record
  3. The dashboard shows a persistent alert listing all deliveries older than 14 days with status not_invoiced, with a monthly uninvoiced revenue estimate
  4. Financial data is completely hidden from client, client-global, transport, and prison roles; visible to reco role only when the can_view_financials toggle is on
  5. Amounts display in EUR or DKK based on user preference; the exchange rate is applied at display time using the system-configured rate; stored values are always in EUR
**Plans**: TBD

Plans:
- [ ] 07-01: Financial record schema — auto-created on intake delivery, two-leg cost fields, invoice status enum, invoice fields
- [ ] 07-02: Estimated invoice calculation — quantities × effective-dated pricing + transport cost sum, trigger or Server Action
- [ ] 07-03: Invoice management UI — reco-admin edit for status, number, date, notes; role-scoped visibility
- [ ] 07-04: Uninvoiced delivery alert — dashboard widget, 14-day threshold, monthly revenue estimate
- [ ] 07-05: Currency display — EUR/DKK toggle, exchange rate application at display, user preference storage

### Phase 8: Dashboards and ESG Metrics
**Goal**: reco-admin, client, and transport users each have a role-scoped dashboard showing their most important operational data; ESG metrics are calculated from actual intake records and are exportable
**Depends on**: Phase 7
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, ESG-01, ESG-02, ESG-03, ESG-04, ESG-05, ESG-06, ESG-07
**Success Criteria** (what must be TRUE):
  1. The reco ops dashboard loads in under 2 seconds with up to 50,000 records and shows active pickups by status, consolidation warehouse ageing, uninvoiced deliveries, and prison pipeline across all facilities
  2. A client user sees only their own location's data; a client-global user sees aggregated cross-market data with drill-down to individual markets
  3. The transport dashboard shows assigned pickups awaiting collection, active shipments, and completed deliveries; consolidation providers also see warehouse inventory
  4. ESG output for 1,000 bike bags shows exactly 943kg polypropylene, 386kg PVC, 294kg polyester (and other materials) using intake quantities × material weight from the composition active at delivery date
  5. The ESG summary is exportable as a PDF report and a CSV data file, with the calculation methodology (formula and inputs) shown inline
**Plans**: TBD

Plans:
- [ ] 08-01: ESG calculation engine — material weight × actual quantities, temporal composition join, aggregation by material/product/country/period
- [ ] 08-02: ESG metrics UI — reuse rate, CO2 avoided (formula validated pre-build), methodology inline display
- [ ] 08-03: ESG export — PDF report (@react-pdf/renderer) and CSV data download
- [ ] 08-04: reco ops dashboard — aggregated pickups, consolidation ageing, uninvoiced widget, prison pipeline, revenue summary
- [ ] 08-05: Client dashboard — location view (client role), cross-market aggregated view (client-global), discrepancy flags, ESG summary
- [ ] 08-06: Transport dashboard — pickup queue, active shipments, completed deliveries, warehouse inventory for consolidation
- [ ] 08-07: Dashboard performance — materialised views or indexed aggregations, query optimisation, <2s load / <500ms filter

### Phase 9: Notifications and Manuals
**Goal**: All roles receive timely notifications for critical events; client and prison users have role-appropriate manual content accessible from their portals
**Depends on**: Phase 8
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, MANUAL-01, MANUAL-02, MANUAL-03, MANUAL-04
**Success Criteria** (what must be TRUE):
  1. reco-admin receives an in-app and email notification within minutes of a discrepancy flag, unexpected delivery, defective batch match, or uninvoiced delivery crossing the 14-day threshold
  2. Critical event notifications (discrepancy >15%, uninvoiced >14 days, defective batch match, prison facility inactive >14 days) cannot be muted; a mute control does not appear for these event types
  3. A client user visiting their portal sees a manual covering packing guide, gear types, booking walkthrough, and FAQs, rendered from markdown with images
  4. Prison staff visiting the prison section see the prison operations manual covering intake flow, counting guide, QC checklists, and processing workflow, with content distinct from the client manual
  5. reco-admin can edit manual content directly in the platform and changes are versioned with an audit trail
**Plans**: TBD

Plans:
- [ ] 09-01: Notification schema and in-app centre — notifications table, Supabase Realtime subscription, per-role notification centre UI
- [ ] 09-02: Email notification templates — Resend + react-email, transactional templates for all key events per notification matrix
- [ ] 09-03: Notification mute controls — per-event-type mute for non-critical; unmutable enforcement for critical events
- [ ] 09-04: Manual content schema — client manual and prison manual tables, markdown storage, version history
- [ ] 09-05: Manual rendering — markdown-to-HTML with image and embedded PDF support, role-based version serving
- [ ] 09-06: Manual editor — reco-admin in-platform markdown editor, versioned saves with audit trail

### Phase 10: Historical Data Import
**Goal**: All historical operational data (2022-2026) is imported, flagged as imported records, and fully queryable in dashboards and reports from day one of live operations
**Depends on**: Phase 9
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04
**Success Criteria** (what must be TRUE):
  1. reco-admin can upload a CSV or XLSX file for each of the five source datasets (pickup log, prison intake log, GreenLoop data, invoice binder, transport costs) and map columns to platform fields via a visual interface
  2. The import preview shows validation errors (missing required fields, unrecognised values, date format issues) before any records are committed
  3. After import, all imported records are visually distinguished from live records (import source badge) in all list views and exports
  4. ESG totals and financial summaries include historical imported data and return accurate aggregates across the full 2022-2026 date range
**Plans**: TBD

Plans:
- [ ] 10-01: Import schema — source flag on all importable record types, import_runs audit table
- [ ] 10-02: File upload and column mapping UI — CSV/XLSX parsing, field mapping interface, field type validation
- [ ] 10-03: Validation preview — error highlighting, row-by-row status, mandatory fix before commit
- [ ] 10-04: Import commit — bulk upsert with source flag, import run record, rollback on partial failure
- [ ] 10-05: Import source display — badge/indicator on imported records in all list views and detail pages

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Foundation | 9/9 | Complete   | 2026-03-20 |
| 2. Auth, Roles, and Tenant Branding | 3/4 | Complete    | 2026-03-20 |
| 3. Product Registry | 4/5 | Complete    | 2026-03-20 |
| 4. Pickup Booking and Transport Management | 10/10 | Complete   | 2026-03-20 |
| 5. Prison Intake and Counting | 8/8 | Complete   | 2026-03-20 |
| 6. Prison Processing, Dispatch, and Audit Trail | 4/9 | In Progress|  |
| 7. Financial Tracking | 0/5 | Not started | - |
| 8. Dashboards and ESG Metrics | 0/7 | Not started | - |
| 9. Notifications and Manuals | 0/6 | Not started | - |
| 10. Historical Data Import | 0/5 | Not started | - |
