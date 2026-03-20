# Requirements: reco Platform

**Defined:** 2026-03-20
**Core Value:** Every delivery tracked from booking to invoice; every item from pickup to recycling or redistribution — zero uninvoiced deliveries, zero missing processing data, discrepancy rate below 10%.

---

## v1 Requirements

### Routing and Multi-Tenancy

- [x] **ROUTE-01**: System resolves tenant context from subdomain hostname (e.g. `wolt.courierrecycling.com` → Wolt tenant) via Next.js `proxy.ts` without a database call
- [x] **ROUTE-02**: Single Next.js 16 App Router deployment serves three domain contexts: `ops.courierrecycling.com`, `[client].courierrecycling.com`, `courierrecycling.com`
- [x] **ROUTE-03**: Wildcard DNS (`*.courierrecycling.com`) routes all client subdomains to the same Vercel deployment; new client subdomain provisioning requires no DNS changes
- [x] **ROUTE-04**: Every database table has a `tenant_id` column; Supabase RLS policies enforce tenant isolation at the database layer on all tenant-scoped tables
- [x] **ROUTE-05**: `tenant_id` index exists on every tenant-scoped table (performance requirement for RLS)

### Authentication and Authorisation

- [x] **AUTH-01**: Six user roles exist: `reco-admin`, `reco`, `client`, `client-global`, `transport`, `prison`
- [x] **AUTH-02**: Role, `tenant_id`, `location_id`, and `prison_facility_id` are injected into the Supabase JWT via a Custom Access Token Hook (stored in `app_metadata`, not `user_metadata`)
- [x] **AUTH-03**: Client portal users authenticate via email + password or magic link (Supabase Auth)
- [x] **AUTH-04**: Ops portal users (`reco-admin`, `reco`, `transport`) authenticate via email + password or magic link
- [x] **AUTH-05**: Prison staff login uses a stable `/prison/login?facility=X` wrapper page that issues a magic link to the facility email; sessions expire after 7 days
- [x] **AUTH-06**: Auth cookies are scoped to `.courierrecycling.com` (leading dot) so sessions are shared across subdomains
- [x] **AUTH-07**: `client` role users are locked to a specific `location_id`; they cannot see other locations or markets
- [x] **AUTH-08**: `reco` role has a per-user `can_view_financials` toggle (default false); financial data is hidden unless toggled on by reco-admin
- [x] **AUTH-09**: reco-admin can invite users by email with a role assignment; can deactivate users at any time
- [x] **AUTH-10**: `service_role` key is never used in client-side code or exposed in any API route

### Tenant Branding

- [x] **BRAND-01**: Each tenant has a `tenant_branding` record with: logo URL, favicon URL, primary/secondary/background/text/accent colours (HEX), heading font, body font — all nullable with reco defaults as fallback
- [x] **BRAND-02**: Client portals inject tenant branding as CSS custom properties on a wrapper element via React `style` prop; HEX values validated against strict regex before use
- [x] **BRAND-03**: All components reference CSS variables exclusively; no hardcoded colours in component code
- [x] **BRAND-04**: Client portal with no branding configured renders identically to the ops portal (full reco visual identity)
- [x] **BRAND-05**: Colour combinations that fail WCAG AA contrast ratios are rejected at the branding configuration step

### Product Registry

- [x] **PROD-01**: Each tenant has a product registry; products have: name, product code (unique per tenant), product group, processing stream (`recycling` or `reuse`), description, total weight (grams), active flag
- [x] **PROD-02**: Each product has up to 5 photos (Supabase Storage)
- [x] **PROD-03**: Each product has one or more material composition lines: material from global material library, weight (grams), recycling cost per kg (EUR/DKK), recycling outcome enum
- [x] **PROD-04**: Each product has client-facing pricing records with `effective_from` / `effective_to` dates (null = current); historical deliveries retain the rate active at time of delivery
- [x] **PROD-05**: `product_materials` records have `effective_from` / `effective_to` dates to preserve historical ESG calculation accuracy when material composition changes
- [x] **PROD-06**: A global `material_library` table stores canonical material names (e.g. "Polyester", "PVC", "Polypropylene"); used across all tenants for consistent naming
- [x] **PROD-07**: Wolt products pre-loaded at deployment: Bike Bag (2,680g), Car Bag (918g), Inner Bag (324g), Heating Plate (703g), Clothing; with full material compositions and pricing from PRD §4.10
- [x] **PROD-08**: Product versioning via separate records (e.g. "Bike Bag (2022)", "Bike Bag (2025)"); `product_group` field aggregates related products for dashboard reporting

### Pickup Booking

- [x] **PICKUP-01**: `client` and `client-global` users can submit a pickup request with: country/location (auto-set for `client` role), dynamic product quantities from client's product registry, pallet count, estimated weight, pallet dimensions, preferred pickup date, notes, up to 5 photos
- [x] **PICKUP-02**: Pickup request has a human-readable reference number (PU-YYYY-NNNN)
- [x] **PICKUP-03**: `client` role auto-fills pickup address from their assigned location record; address is not editable
- [x] **PICKUP-04**: Preferred pickup date enforces minimum 72-hour lead time from submission
- [x] **PICKUP-05**: A location can have multiple active pickup requests simultaneously (no restriction)
- [x] **PICKUP-06**: Client can cancel a pickup up to 24 hours before confirmed pickup date; reco-admin can cancel at any time with a reason
- [x] **PICKUP-07**: Pickup status lifecycle: `submitted` → `confirmed` → `transport_booked` → `picked_up` → `at_warehouse` (consolidation only) → `in_outbound_shipment` (consolidation only) → `in_transit` → `delivered` → `intake_registered`
- [x] **PICKUP-08**: On submission, reco-admin receives email + in-app notification; client submitter receives confirmation email with request ID

### Transport Management

- [x] **TRANS-01**: Transport provider registry: company name, contact details, service regions, provider type (`direct` or `consolidation`), warehouse address, `has_platform_access` flag
- [x] **TRANS-02**: Transport providers linked to specific tenants via `transport_provider_clients` join table; providers only see pickups for linked clients
- [x] **TRANS-03**: reco-admin books direct transport on a confirmed pickup: select provider, select destination prison, enter transport cost (EUR), confirm pickup date
- [x] **TRANS-04**: reco-admin books consolidation transport: select provider, select "provider warehouse" as destination; transport cost = market→warehouse leg
- [x] **TRANS-05**: Consolidation provider sees warehouse inventory: held pickups with client, market, products, pallet count, arrival date, days held
- [x] **TRANS-06**: Consolidation provider (or reco-admin) creates outbound shipments from warehouse: select held pickups, select destination prison, enter warehouse→prison transport cost; soft warning at 7 pallets per truck
- [x] **TRANS-07**: Two-leg transport cost model: `transport_cost_market_to_destination_eur` (direct: market→prison; consolidation: market→warehouse) and `transport_cost_warehouse_to_prison_eur` (consolidation only); second leg allocated pro-rata by pallet count across bookings in the outbound shipment
- [x] **TRANS-08**: Transport providers with platform access can update shipment status, add delivery notes, upload proof of delivery; cannot see pricing, prison data, or other providers' shipments
- [x] **TRANS-09**: reco-admin receives in-app alert when pallets held at warehouse exceed configurable threshold (default 14 days)
- [x] **TRANS-10**: Outbound shipment delivery cascades `delivered` status to all linked transport bookings and their pickup requests

### Prison Intake and Counting

- [x] **INTAKE-01**: Prison staff access intake forms at `ops.courierrecycling.com/prison` via facility-pre-authenticated session; facility context is locked from login, not from form input
- [x] **INTAKE-02**: Incoming deliveries view shows: direct deliveries (single line), consolidated deliveries (expanded into per-pickup intake forms grouped under outbound shipment reference)
- [x] **INTAKE-03**: Intake form fields: staff name (free text), client (dropdown, pre-selected if linked), origin market (pre-populated if linked, editable), delivery date (defaults today), quantities per product (dynamic from client registry), batch/lot numbers (optional per product), delivery photos (optional), notes
- [x] **INTAKE-04**: For expected deliveries (linked to pickup request): client, origin market, and product list are pre-populated; prison staff confirms or adjusts quantities
- [x] **INTAKE-05**: For unexpected deliveries: prison staff selects client from dropdown, enters all details manually; reco-admin receives alert
- [x] **INTAKE-06**: System auto-compares `actual_quantity` (intake) vs `informed_quantity` (pickup request) per product line; if any line exceeds configurable threshold (default 15%), `discrepancy_flagged` is set and reco-admin receives email + in-app notification
- [x] **INTAKE-07**: Batch/lot numbers entered at intake are checked against `batch_flags` table; if a match exists, `quarantine_flagged` is set and both prison staff and reco-admin receive email + in-app notification; quarantined items cannot proceed without reco-admin override
- [x] **INTAKE-08**: Discrepancy dashboard: discrepancy rate by country, by product, by prison facility, over time; persistent problem markets auto-flagged

### Prison Processing

- [x] **PROCESS-01**: Prison staff submit Wash and Pack reports from the same `ops.courierrecycling.com/prison` interface; maximum two taps to reach any form
- [x] **PROCESS-02**: Processing report fields: staff name (free text), client (dropdown), activity type (Wash or Pack), product type (from client registry), quantity per size bucket (XXS–XXXL for clothing; total quantity for bags), date (defaults today), notes
- [x] **PROCESS-03**: Processing pipeline view per facility: items at each stage (awaiting processing, in progress, ready to ship, shipped); visible to prison staff (own facility) and reco-admin (all facilities, all clients)
- [x] **PROCESS-04**: Prison interface uses large touch targets (tablet-first), Danish language labels and instructions, minimal navigation
- [x] **PROCESS-05**: Full traceability chain visible: pickup request → transport → prison intake → wash → pack → dispatch

### Prison Outbound Dispatch

- [x] **DISPATCH-01**: reco-admin creates outbound dispatch records for clothing (reuse stream) leaving prison: prison facility, client, dispatch date, destination, carrier/transport provider, notes
- [x] **DISPATCH-02**: Packing list attached to dispatch: product type, size, SKU code, quantity (one line per box/SKU combination)
- [x] **DISPATCH-03**: Dispatch status lifecycle: `created` → `picked_up` → `delivered`
- [x] **DISPATCH-04**: Prison staff can view outbound dispatch history for their own facility; cannot create dispatches

### Edit Policy and Audit Trail

- [x] **AUDIT-01**: All editable records support edit-in-place with full audit trail: who edited, when, which field, old value, new value
- [x] **AUDIT-02**: Prison staff can edit their own facility's intake records and processing reports within 48 hours of submission; records lock after 48 hours
- [x] **AUDIT-03**: reco-admin can edit any record at any time
- [x] **AUDIT-04**: No records are deleted; reco-admin can mark records as `voided` with a reason; voided records are excluded from calculations but remain in audit trail
- [x] **AUDIT-05**: Visual "edited" indicator appears on any record that has been modified after initial submission, with a link to edit history
- [x] **AUDIT-06**: Audit log entries captured via database trigger (not application code) to ensure no log can be bypassed

### Financial Tracking

- [ ] **FIN-01**: Each delivered intake record has a financial record with: transport cost (EUR, sum of both legs), estimated invoice amount (auto-calculated: intake quantities × product pricing + transport cost), invoice status (`not_invoiced` / `invoiced` / `paid`), invoice number, invoice date, notes
- [ ] **FIN-02**: Estimated invoice amount uses the product pricing record with `effective_to = null` (current) at the time of delivery
- [ ] **FIN-03**: Invoice status, invoice number, invoice date, and notes are editable by reco-admin
- [ ] **FIN-04**: Dashboard alert: deliveries older than 14 days with status `not_invoiced`; monthly uninvoiced revenue estimate
- [ ] **FIN-05**: System-level exchange rate (EUR↔DKK) configured by reco-admin in system settings; applied at display time only, never stored on financial records; users can set preferred display currency (EUR or DKK, default EUR)
- [ ] **FIN-06**: Financial data visible to `reco-admin` always; visible to `reco` role only if `can_view_financials` toggle is on; never visible to `client`, `client-global`, `transport`, or `prison` roles

### ESG Metrics

- [ ] **ESG-01**: Total material recycled per type calculated as: `product_materials.weight_grams × intake_record_lines.actual_quantity` for all intake records; aggregated by material, product, country, time period
- [ ] **ESG-02**: Example auto-calculation: 1,000 bike bags processed = 943kg polypropylene, 386kg PVC, 294kg polyester, etc.
- [ ] **ESG-03**: Reuse rate displayed: items in `reuse` processing stream / total items processed
- [ ] **ESG-04**: CO2 avoided displayed: configurable formula based on weight and material type (formula defined before Phase 3 build)
- [ ] **ESG-05**: ESG calculations use material composition records temporally: `effective_from`/`effective_to` on `product_materials` ensures historical records use the composition that was active at time of delivery
- [ ] **ESG-06**: ESG methodology shown inline (formula and inputs visible, not just output numbers)
- [ ] **ESG-07**: ESG summary exportable per client and aggregated (PDF report and CSV data)

### Dashboards

- [ ] **DASH-01**: reco ops dashboard (aggregated): active pickups by status across all clients, pallets at consolidation warehouses with ageing, uninvoiced deliveries, volume by stream/country/product, revenue summary, prison pipeline across all facilities
- [ ] **DASH-02**: reco ops dashboard supports client context switching: dropdown to scope any view to a single client
- [ ] **DASH-03**: Client dashboard (`client` role): active pickup requests from own location, items sent vs received (with discrepancy flag), historical volume by quarter, reuse rate, ESG summary for own location
- [ ] **DASH-04**: Client dashboard (`client-global` role): all of the above aggregated across all markets in their tenant; cross-market comparison charts; drill-down to individual market
- [ ] **DASH-05**: Transport dashboard: assigned pickups awaiting collection, active shipments in transit, completed deliveries (last 30 days); consolidation providers also see warehouse inventory and outbound shipment history
- [ ] **DASH-06**: Dashboard loads in under 2 seconds for up to 50,000 records; search and filter results return in under 500ms

### Notifications

- [ ] **NOTIF-01**: In-app notification centre for all roles; email notifications for key events per the notification matrix in PRD §4.8
- [ ] **NOTIF-02**: Critical event emails (discrepancy >15%, uninvoiced >14 days, defective batch match, prison facility inactive >14 days) cannot be muted by users
- [ ] **NOTIF-03**: Users can mute non-critical in-app notifications per event type
- [ ] **NOTIF-04**: Emails sent via Resend (or Postmark); transactional email templates built with React Email

### FAQ and Manuals

- [ ] **MANUAL-01**: Client Office Manual served at `[client].courierrecycling.com` covering: packing guide, gear types, booking walkthrough, cancellation, FAQs, packing best practices with photos
- [ ] **MANUAL-02**: Prison Operations Manual served at `ops.courierrecycling.com/prison` covering: intake flow, counting guide, unexpected delivery procedure, QC checklists (jackets, rain pants), packing workflow, processing report guide, gear type reference
- [ ] **MANUAL-03**: Manual content is markdown-rendered with image and embedded PDF support; reco-admin can edit content directly in the platform; edits are versioned with audit trail
- [ ] **MANUAL-04**: Role-appropriate manual version is served based on user role and domain; prison staff see the prison version, client users see the client version

### Data Import

- [ ] **IMPORT-01**: CSV/XLSX import for: pickup request log (2023–2026), prison delivery intake log (2022–2026), GreenLoop form data (2025), invoice binder references, transport cost spreadsheet
- [ ] **IMPORT-02**: Import UI includes: file upload, column-to-field mapping interface, validation preview (flag errors before commit), one-click commit
- [ ] **IMPORT-03**: Imported records marked with `source: 'import'` flag; distinguishable from live data in all views and exports
- [ ] **IMPORT-04**: Import is one-time per source; no ongoing sync

### System Settings

- [x] **SETTINGS-01**: reco-admin can configure: exchange rate (EUR↔DKK), warehouse ageing alert threshold (default 14 days), discrepancy alert threshold (default 15%), prison facility registry
- [x] **SETTINGS-02**: Prison facility registry includes: facility name (used as login username), address (delivery address for transport), contact email, active flag

---

## v2 Requirements

### Client Onboarding Wizard

- **ONBOARD-01**: Structured multi-step onboarding for new tenants: company details, branding config with live preview, markets and locations, product catalogue, user invitations, review and activate
- **ONBOARD-02**: On activation: tenant record created, subdomain provisioned, markets/products seeded, invitation emails sent, client portal live immediately

### Marketing Site

- **MARKET-01**: `courierrecycling.com` public site: service description, aggregated public statistics (total items processed, materials recovered, countries, CO2 avoided, reuse rate, active clients) via ISR (daily refresh)
- **MARKET-02**: Public stats API returns aggregates only; no client names, no per-client data
- **MARKET-03**: Contact/demo request form; case studies managed by reco-admin

### Email Processing Module

- **EMAIL-01**: Dedicated inbox monitored by platform; incoming emails parsed for pickup request data (country, gear type, quantities, dates) via LLM extraction
- **EMAIL-02**: Parsed data creates a draft pickup request for reco-admin review/edit before going live; original email attached to request

### Audit Log Viewer

- **AUDITVIEW-01**: reco-admin can view full audit log: who did what, when, on which record; filterable by user, entity type, date range
- **AUDITVIEW-02**: Audit log accessible from any record via "edited" indicator link

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Invoice generation | Use accounting software |
| Payment processing | Not in scope |
| Tax / VAT calculations | Not in scope |
| Courier personal data management | Stays in Wolt's systems (GDPR) |
| SEKO integration | Downstream of reco's scope |
| Recycling partner management | Confidential, NDA-protected, stays offline |
| Mobile native apps | Responsive web sufficient for current scale |
| Internal prison cost structures | Must never appear in any client-visible surface |
| Per-staff prison accounts | Facility-level accounts replace Google Form; per-staff adds friction |
| Offline form submission | Validate connectivity at prison facilities first (PRD open question §11) |
| ESG framework compliance (GRI/SASB/CSRD) | Methodology documented, not certified |
| Custom domains (e.g. recycling.wolt.com) | Phase 5, post-launch |
| Full BI tool / Data Studio replacement | Dashboard in platform is sufficient for v1 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | Phase 1: Infrastructure Foundation | Complete |
| ROUTE-02 | Phase 1: Infrastructure Foundation | Complete |
| ROUTE-03 | Phase 1: Infrastructure Foundation | Complete |
| ROUTE-04 | Phase 1: Infrastructure Foundation | Complete |
| ROUTE-05 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-01 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-02 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-03 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-04 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-05 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-06 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-07 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-08 | Phase 1: Infrastructure Foundation | Complete |
| AUTH-09 | Phase 2: Auth, Roles, and Tenant Branding | Complete |
| AUTH-10 | Phase 1: Infrastructure Foundation | Complete |
| SETTINGS-01 | Phase 1: Infrastructure Foundation | Complete |
| SETTINGS-02 | Phase 1: Infrastructure Foundation | Complete |
| BRAND-01 | Phase 2: Auth, Roles, and Tenant Branding | Complete |
| BRAND-02 | Phase 2: Auth, Roles, and Tenant Branding | Complete |
| BRAND-03 | Phase 2: Auth, Roles, and Tenant Branding | Complete |
| BRAND-04 | Phase 2: Auth, Roles, and Tenant Branding | Complete |
| BRAND-05 | Phase 2: Auth, Roles, and Tenant Branding | Complete |
| PROD-01 | Phase 3: Product Registry | Complete |
| PROD-02 | Phase 3: Product Registry | Complete |
| PROD-03 | Phase 3: Product Registry | Complete |
| PROD-04 | Phase 3: Product Registry | Complete |
| PROD-05 | Phase 3: Product Registry | Complete |
| PROD-06 | Phase 3: Product Registry | Complete |
| PROD-07 | Phase 3: Product Registry | Complete |
| PROD-08 | Phase 3: Product Registry | Complete |
| PICKUP-01 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-02 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-03 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-04 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-05 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-06 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-07 | Phase 4: Pickup Booking and Transport Management | Complete |
| PICKUP-08 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-01 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-02 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-03 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-04 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-05 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-06 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-07 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-08 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-09 | Phase 4: Pickup Booking and Transport Management | Complete |
| TRANS-10 | Phase 4: Pickup Booking and Transport Management | Complete |
| INTAKE-01 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-02 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-03 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-04 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-05 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-06 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-07 | Phase 5: Prison Intake and Counting | Complete |
| INTAKE-08 | Phase 5: Prison Intake and Counting | Complete |
| PROCESS-01 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| PROCESS-02 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| PROCESS-03 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| PROCESS-04 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| PROCESS-05 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| DISPATCH-01 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| DISPATCH-02 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| DISPATCH-03 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| DISPATCH-04 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| AUDIT-01 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| AUDIT-02 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| AUDIT-03 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| AUDIT-04 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| AUDIT-05 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| AUDIT-06 | Phase 6: Prison Processing, Dispatch, and Audit Trail | Complete |
| FIN-01 | Phase 7: Financial Tracking | Pending |
| FIN-02 | Phase 7: Financial Tracking | Pending |
| FIN-03 | Phase 7: Financial Tracking | Pending |
| FIN-04 | Phase 7: Financial Tracking | Pending |
| FIN-05 | Phase 7: Financial Tracking | Pending |
| FIN-06 | Phase 7: Financial Tracking | Pending |
| DASH-01 | Phase 8: Dashboards and ESG Metrics | Pending |
| DASH-02 | Phase 8: Dashboards and ESG Metrics | Pending |
| DASH-03 | Phase 8: Dashboards and ESG Metrics | Pending |
| DASH-04 | Phase 8: Dashboards and ESG Metrics | Pending |
| DASH-05 | Phase 8: Dashboards and ESG Metrics | Pending |
| DASH-06 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-01 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-02 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-03 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-04 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-05 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-06 | Phase 8: Dashboards and ESG Metrics | Pending |
| ESG-07 | Phase 8: Dashboards and ESG Metrics | Pending |
| NOTIF-01 | Phase 9: Notifications and Manuals | Pending |
| NOTIF-02 | Phase 9: Notifications and Manuals | Pending |
| NOTIF-03 | Phase 9: Notifications and Manuals | Pending |
| NOTIF-04 | Phase 9: Notifications and Manuals | Pending |
| MANUAL-01 | Phase 9: Notifications and Manuals | Pending |
| MANUAL-02 | Phase 9: Notifications and Manuals | Pending |
| MANUAL-03 | Phase 9: Notifications and Manuals | Pending |
| MANUAL-04 | Phase 9: Notifications and Manuals | Pending |
| IMPORT-01 | Phase 10: Historical Data Import | Pending |
| IMPORT-02 | Phase 10: Historical Data Import | Pending |
| IMPORT-03 | Phase 10: Historical Data Import | Pending |
| IMPORT-04 | Phase 10: Historical Data Import | Pending |

**Coverage:**
- v1 requirements: 82 total
- Mapped to phases: 82
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
