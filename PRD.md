# Product Requirements Document: reco Platform

**Document type:** PRD  
**Version:** 1.5  
**Date:** 19 March 2026  
**Author:** Bragi Hallsson  
**Status:** Draft  

---

## 1. Product Overview

### 1.1 What This Is

reco Platform is a SaaS application that replaces the current patchwork of Google Sheets, Google Forms, email threads, and manual tracking with a single system for managing circular gear operations. It covers the full lifecycle: pickup booking, transport coordination, prison processing, item counting, invoice tracking, and reporting.

### 1.2 Who Owns It

reco ApS owns, operates, and maintains the platform. Wolt and transport providers access it as tenants with role-scoped permissions.

### 1.3 Why It Exists

The current operation runs on disconnected tools. This creates specific, documented problems:

- Counting discrepancies between informed and actual quantities (errors up to +217% recorded in the delivery intake log)
- Billing status columns empty from late 2024 onward, meaning deliveries go uninvoiced
- Prison reporting stopped after September 2025 in the Google Form dataset, with no visibility into whether it continued elsewhere
- Transport costs scattered across spreadsheets with no per-shipment linkage
- No single source of truth for shipment status across 15+ markets

The platform eliminates these gaps.

### 1.4 Success Criteria

- Zero uninvoiced deliveries (every delivery tracked from booking to invoice reference)
- Counting discrepancy rate below 10% (currently up to 217%)
- Prison processing data submitted within 48 hours of completion (currently irregular/missing)
- Pickup-to-delivery status visible in real time to all relevant roles
- Historical data from 2022-2026 fully migrated and queryable

---

## 2. Architecture Decisions

### 2.1 Multi-Tenant Data Model, Single-Tenant UI (Phase 1)

The database is multi-tenant from day one. Every table includes a `tenant_id` column. All queries are tenant-scoped. Row Level Security (RLS) policies in Supabase enforce isolation at the database layer.

The UI, onboarding flow, and admin tools are built for a single tenant (reco-Wolt) initially. When a second client arrives, the data model requires zero changes. Only the tenant provisioning and onboarding flows need building.

### 2.2 Domain and Subdomain Architecture

The platform operates across four domain contexts, all served by a single Next.js application with a single Supabase database. Middleware reads the hostname and resolves the appropriate context.

| Domain | Purpose | Users | Auth |
|---|---|---|---|
| `courierrecycling.com` | Marketing and information site | Public (no auth) | None |
| `[client].courierrecycling.com` | Client portal (bookings, dashboard, FAQ) | Client users (e.g. Wolt market contacts, Wolt global ops) | Email + password or magic link |
| `ops.courierrecycling.com` | reco operations portal (intake, prison processing, financials, transport, admin, cross-client dashboard) | reco-admin, reco viewers, transport providers, prison staff | Email + password, magic link, or simplified prison login |

**How it works:**
- A request to `wolt.courierrecycling.com` loads the Wolt tenant context. The user sees Wolt branding, Wolt products, Wolt markets.
- A request to `ops.courierrecycling.com` loads the reco operations context. reco-admin sees all clients. Transport providers see their assigned shipments across clients. Prison staff see their facility's processing queue across all clients.
- A request to `courierrecycling.com` serves the public marketing site. No auth. No tenant context.
- Wildcard DNS (`*.courierrecycling.com`) routes all client subdomains to the same Vercel deployment.
- When reco-admin onboards a new client, the system registers the subdomain slug (e.g. "clientb") and provisioning is instant. No DNS changes needed.

**Client subdomain branding:**

Each client tenant has configurable branding applied to their subdomain:

| Branding Element | Configurable | Fallback (if not set) |
|---|---|---|
| Logo | Yes (uploaded during onboarding) | reco logo |
| Primary colour | Yes (HEX value) | Reco Red `#ED1C24` |
| Secondary colour | Yes (HEX value) | Grey `#9FA4A6` |
| Background colour | Yes (HEX value) | Off-white `#FAF9F4` |
| Text colour | Yes (HEX value) | Black `#000000` |
| Accent colour | Yes (HEX value) | Reco Red `#ED1C24` |
| Font (heading) | Yes (from allowed list or custom upload) | Aileron / Inter |
| Font (body) | Yes (from allowed list or custom upload) | Aileron / Inter |
| Favicon | Yes (uploaded) | reco brand mark |

Branding is stored in the tenant record and injected as CSS custom properties at render time. If a client provides no branding, the subdomain renders with full reco visual identity (logo, colours, fonts). Partial branding is allowed: a client can upload a logo but leave colours at default.

Implementation: CSS variables set at the `:root` level per tenant. Components use these variables exclusively. No hardcoded colours in component code.

**Marketing site (courierrecycling.com):**

A public-facing site that serves as the sales funnel and public showcase for the platform.

Content:
- What the service does (circular gear management for delivery companies)
- How it works (end-to-end value chain explanation)
- Aggregated public statistics (pulled live from the database, no client-specific data exposed):
  - Total items processed across all clients
  - Total material recovered by type (kg of polyester, polypropylene, etc.)
  - Number of countries served
  - CO2 avoided (estimated)
  - Reuse rate
  - Number of active clients
- Case studies / testimonials (added manually by reco-admin via CMS or static content)
- Contact / request demo form
- Link to client login portal

The aggregated stats are served from a read-only API endpoint that sums across all tenants. No tenant-specific data is exposed. The marketing site can be statically generated with ISR (Incremental Static Regeneration) to refresh stats periodically (e.g. daily).

### 2.3 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js (App Router) | SSR for dashboards, API routes for integrations, middleware for subdomain routing |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime + Storage) | Managed Postgres with RLS, built-in auth, realtime subscriptions for notifications |
| Hosting | Vercel | Native Next.js deployment, EU region available, wildcard subdomain support |
| Email | Supabase Edge Functions + Resend (or Postmark) | Transactional emails for notifications |
| File storage | Supabase Storage | Delivery photos, packing lists, manual PDFs, client logos |
| Data region | EU (Frankfurt or Stockholm) | GDPR compliance |
| DNS | Wildcard CNAME `*.courierrecycling.com` → Vercel | Instant client subdomain provisioning |

### 2.4 GDPR Considerations

The platform processes personal data: names, email addresses, phone numbers of Wolt market contacts, prison staff contacts, and transport provider contacts.

Required measures:
- All data stored in EU data centres
- Data Processing Agreement (DPA) between reco and Supabase
- Personal data minimisation: store only what is operationally necessary
- Right to deletion: admin can purge user data on request
- Audit log for data access (who viewed what, when)
- No courier personal data stored in the platform (courier names, addresses, deposit data stay in Wolt's systems)

---

## 3. User Roles and Permissions

### 3.1 Role Definitions

| Role | Domain | Description | Example Users |
|---|---|---|---|
| `reco-admin` | `ops.courierrecycling.com` | Full control. All features, settings, user management, financial data, prison data, system configuration. Cross-client aggregated view and per-client context switching. | Bragi, Luan |
| `reco` | `ops.courierrecycling.com` | Read-only viewer. Can see orders, pickups, dashboard, prison counts, delivery status across all clients. Cannot change settings or manage users. Financial data visibility controlled by a per-user toggle (off by default). | reco team members |
| `client` | `[client].courierrecycling.com` | Locked to a specific market/location. Can book pickups from their location, view their location's item counts, track shipment status, access client-facing dashboard and FAQ. Cannot see other markets, prison operations, internal costs, or other tenants' data. | Vojtěch (CZ), Toon (FI), Maximilian (SE), Dominika (HU) |
| `client-global` | `[client].courierrecycling.com` | Cross-market visibility within their tenant. Can book pickups from any market, view all markets' data, see aggregated client dashboard. Cannot see prison operations, internal costs, or other tenants' data. | Chia-Ching (Wolt global ops), Cilia |
| `transport` | `ops.courierrecycling.com` | Can see pickups assigned to them by reco, for clients they are linked to. Can update shipment status (picked up, at warehouse, in transit, delivered). Cannot see pricing, prison data, or other providers' shipments. | Transport provider staff |
| `prison` | `ops.courierrecycling.com` | Simplified login. Can submit intake reports and Wash/Pack reports for their facility. Can see their facility's processing queue. Cannot see financials, other facilities, or admin data. | Jesper (Møgelkær), Britta (Sdr. Omme), Jan (Renbæk) |

### 3.2 Permission Matrix

| Feature | reco-admin | reco | client | client-global | transport | prison |
|---|---|---|---|---|---|---|
| Book pickup | Yes | No | Yes (own location) | Yes (any market) | No | No |
| View all pickups | Yes (all clients) | Yes (all clients) | Own location only | All markets in tenant | Assigned only | No |
| Approve/schedule pickup | Yes | No | No | No | No | No |
| Book transport | Yes | No | No | No | No | No |
| Update shipment status | Yes | No | No | No | Yes (own) | No |
| View/manage warehouse inventory | Yes | Yes | No | No | Yes (own warehouse) | No |
| Create outbound shipments | Yes | No | No | No | Yes (own warehouse) | No |
| Submit prison intake | Yes | No | No | No | No | Yes (own facility) |
| View prison processing | Yes | Yes | No | No | No | Own facility only |
| Submit prison processing reports | Yes | No | No | No | No | Yes (own facility) |
| Create prison outbound dispatch | Yes | No | No | No | No | No |
| View dashboard | Yes (aggregated + per-client) | Yes (aggregated + per-client) | Yes (own location) | Yes (all markets in tenant) | No | No |
| View financial tracking | Yes | If toggled on | No | No | No | No |
| Mark delivery as invoiced | Yes | No | No | No | No | No |
| Edit intake/processing records | Yes | No | No | No | No | No |
| Manage users | Yes | No | No | No | No | No |
| Manage client branding | Yes | No | No | No | No | No |
| System settings | Yes | No | No | No | No | No |
| Access FAQ/manuals | Yes | Yes | Yes (client version) | Yes (client version) | Yes (transport version) | Yes (prison version) |
| View notifications | Yes | Yes | Yes (own) | Yes (all markets in tenant) | Yes (own) | Yes (own facility) |
| Export data | Yes | Yes | No | No | No | No |
| Switch client context | Yes | Yes | No | No | No | No |

### 3.3 Authentication

**Client portal (`[client].courierrecycling.com`):**
- Email + password via Supabase Auth
- Magic link option for infrequent users
- Role assigned at invite by reco-admin
- Session tokens with 24-hour expiry
- Future: SSO integration if a client requests it

**Ops portal (`ops.courierrecycling.com`):**
- Email + password for reco-admin, reco, and transport roles
- Magic link option for transport providers

**Prison staff login (simplified):**
- Prison staff access `ops.courierrecycling.com/prison`
- Username = prison facility name (e.g. "Møgelkær", "Sdr. Omme", "Renbæk")
- Login via magic link sent to facility email, or a persistent login link bookmarked on the facility tablet
- No password required. Session expires after 7 days (longer than other roles, to reduce re-authentication friction)
- Each form submission includes a free-text "Name" field so individual staff members are identified without requiring individual accounts
- One account per facility, not per staff member. This keeps it as simple as the Google Form it replaces.

---

## 4. Core Modules

### 4.1 Pickup Booking

This module replaces the current Google Sheets pickup request form.

**Submission flow (client user):**

1. Client user selects country and city/location (auto-set if `client` role is locked to a location; selectable from all markets if `client-global`)
2. Pickup address auto-fills from the location record
3. Enters gear quantities per product type (product list is dynamic, pulled from the client's product registry):
   - For Wolt: Clothing, Bike Bags, Car Bags, Inner Bags, Heating Plates
   - For a future client: whatever products are registered for that tenant
4. Enters shipment dimensions: number of pallets, estimated weight
5. Selects preferred pickup date (minimum 72 hours from submission, per contract)
6. Adds notes (optional)
7. Submits request

**What happens on submission:**
- Request saved with status `submitted`
- Notification sent to reco-admin (email + in-app)
- Client user receives confirmation email with request ID
- Request appears in reco's pickup queue

**reco-admin actions on a pickup request:**
- Review and confirm quantities
- Book transport: select provider, select destination prison (or provider warehouse for consolidation), enter transport cost, confirm pickup date
- Transport booking is recorded as a fact, not a negotiation. reco books externally or instructs the provider directly.
- Status progression: `submitted` → `confirmed` → `transport_booked` → `picked_up` → `at_warehouse` (optional, consolidation only) → `in_transit` → `delivered` → `intake_registered`

**Cancellation rules:**
- Client can cancel up to 24 hours before pickup (per contract)
- reco-admin can cancel at any time with reason

**Multiple active pickups:** A location can have multiple pickup requests open simultaneously. There is no restriction. If a market submits a second pickup while the first is still in progress, both are tracked independently.

**Data captured per request:**

| Field | Type | Required |
|---|---|---|
| Country | Dropdown (from market list). Auto-set for `client` role. | Yes |
| City/location | Dropdown (from locations within selected market). Auto-set for `client` role. Pickup address auto-fills from location record. | Yes |
| Contact name | Auto-filled from user profile | Yes |
| Contact email | Auto-filled from user profile | Yes |
| Contact phone | Auto-filled from user profile | Yes |
| Quantity per product | Integer per product (dynamic from product registry) | Yes (can be 0) |
| Number of pallets | Integer | Yes |
| Estimated weight (kg) | Decimal | No |
| Pallet dimensions (LxWxH cm) | Text | No |
| Preferred pickup date | Date | Yes |
| Notes | Text | No |
| Photos of packed pallets | File upload (max 5) | Yes |

### 4.2 Transport Management

**Purpose:** Track transport from client offices to prison facilities. reco never receives physical deliveries. Two transport models coexist.

**Transport provider registry:**
- reco-admin registers transport providers in the system
- Each provider has: company name, contact person, email, phone, service regions, rate structure (optional), provider type (`direct` or `consolidation`), warehouse address (consolidation providers only)
- A provider can support both modes

---

#### Model A — Direct Transport

The provider picks up from the client market and delivers straight to a prison. This is the default model.

**Booking flow (reco-admin):**

1. reco-admin reviews confirmed pickup request
2. Books transport (either externally in the provider's own system, or by instructing the provider directly)
3. Records the booking in the platform:
   - Select transport provider
   - Select destination prison facility
   - Enter transport cost (EUR) — known at time of booking
   - Confirm pickup date
4. Status: `transport_booked`
5. If the provider has platform access, they see the assignment and update status
6. If the provider has no platform access, reco-admin updates status manually

**Status lifecycle (direct):**
`transport_booked` → `picked_up` → `in_transit` → `delivered`

---

#### Model B — Consolidation Transport

The provider picks up from one or more client markets and holds pallets at their warehouse. When they have enough volume (max 7 pallets per truck) or reco instructs them, they ship a consolidated load to a prison. A single outbound shipment may contain pallets from multiple pickup requests, potentially from different markets and different clients.

**Pickup and warehouse flow:**

1. reco-admin books a pickup as above, but selects destination as "Provider warehouse" instead of a prison
2. Provider picks up from the market
3. Provider marks pickup as `picked_up`
4. Provider marks pickup as `at_warehouse` — pallets are now held at their location
5. Pallets sit in the provider's warehouse inventory within the platform

**Outbound shipment flow:**

1. Provider (or reco-admin) creates an **outbound shipment** from the warehouse:
   - Selects which held pickups/pallets to include in this shipment
   - Selects destination prison facility
   - Total pallet count auto-calculated (max 7 per shipment, enforced as soft warning)
2. Outbound shipment is created with its own tracking
3. Provider marks outbound shipment: `dispatched` → `in_transit` → `delivered`
4. On delivery, the linked pickup requests all update to `delivered`

**Provider warehouse view (`ops.courierrecycling.com`):**

The consolidation provider sees a dedicated warehouse management screen:

| Column | Data |
|---|---|
| Pickup reference | PU-2026-0042 |
| Client | Wolt |
| Market/country | Czech Republic |
| Products | 4× Bike Bag, 2× Car Bag |
| Pallets | 3 |
| Arrived at warehouse | 12 Mar 2026 |
| Days held | 7 |

Actions available:
- Mark as received at warehouse
- Select pallets for outbound shipment
- View history of outbound shipments

**Status lifecycle (consolidation):**
Pickup level: `transport_booked` → `picked_up` → `at_warehouse` → `in_outbound_shipment` → `delivered`
Outbound shipment level: `created` → `dispatched` → `in_transit` → `delivered`

---

**What transport providers with platform access can do:**
- See assigned pickups
- Update pickup status (picked up, at warehouse, in transit, delivered)
- View their warehouse inventory (consolidation providers)
- Create outbound shipments from warehouse stock (consolidation providers)
- Add delivery notes and upload proof of delivery
- Cannot see pricing, prison processing data, or other providers' shipments

**What transport providers without platform access trigger:**
- reco-admin manages all status updates manually on their behalf
- The transport provider record exists in the registry but has no user account

**reco-admin can:**
- Override any status
- Reassign to different provider
- Edit transport cost
- Create outbound shipments on behalf of a provider
- Set alerts for pallets held at warehouse longer than a threshold (configurable, default 14 days)
- View transport cost history and trends

### 4.3 Prison Intake and Counting

**Purpose:** Record what actually arrives at the prison, compare to what was booked, and create the foundation for all downstream tracking. Prison staff perform the intake count, not reco.

**Access:** `ops.courierrecycling.com/prison` — pre-authenticated per facility via bookmarked magic link on facility tablet.

**Incoming Deliveries view:**

Prison staff see a list of expected deliveries. Two types appear:

- **Direct deliveries:** Single pickup request, single client, single market. Shown as one line.
- **Consolidated deliveries:** An outbound shipment from a provider warehouse. Shown as a group, expanded into its component pickups. Each original pickup is a separate intake form.

This means consolidated deliveries are registered as multiple intakes (one per original pickup), not as a single bulk intake. This keeps every form identical: one client, one market, one set of products. The system groups them visually under the outbound shipment reference, but the data model stays simple.

**Intake flow (prison staff):**

When a delivery arrives at the prison:

1. Prison staff opens their facility dashboard, sees "Incoming Deliveries" section
2. For a direct delivery: taps the single expected shipment
3. For a consolidated delivery: sees the outbound shipment expanded into component pickups, taps each one in turn
4. For an unexpected delivery: taps "New Intake"
5. Fills out the intake form:

| Field | Type | Notes |
|---|---|---|
| Staff name | Free text | Who received the delivery |
| Client | Dropdown | Select from list of active clients (e.g. "Wolt"). Pre-selected if opened from an expected delivery. |
| Origin market/country | Dropdown | Pre-populated from the pickup request if linked. Editable. |
| Delivery date | Date | Defaults to today |
| Quantities per product | Integer per product | Product list pulled from the selected client's product registry. Covers both bags and clothing. |
| Batch/lot numbers | Text (optional) | Per product, for defect tracking |
| Photos of delivery | File upload (optional) | What the pallets looked like on arrival |
| Notes | Text (optional) | |

6. Submits the intake
7. System auto-compares actual quantities to the booked quantities (from the linked pickup request)
8. If any line item discrepancy exceeds threshold (configurable, default 15%), system flags for reco-admin review
9. reco-admin receives notification of the intake and any discrepancy alerts

**If delivery is expected (linked to a pickup request):**
- Client, origin market, and product list are pre-populated
- Prison staff confirms or adjusts the quantities

**If delivery is unexpected (no linked pickup):**
- Prison staff selects the client from a dropdown and enters all details manually
- reco-admin is alerted to investigate

**Discrepancy tracking:**
- Every intake line records both `informed_quantity` (from pickup request) and `actual_quantity` (from prison intake)
- Dashboard shows discrepancy rate by country, by product, and by prison facility over time
- Persistent problem markets get flagged automatically

**Batch/lot tracking (for manufacturing defect handling):**
- Optional field: batch number / lot number per product
- reco-admin can flag specific batch numbers as defective in the system
- Any intake matching a flagged batch triggers a quarantine alert visible to both prison staff and reco-admin
- Quarantined items cannot proceed to reuse without explicit reco-admin override

### 4.4 Prison Processing

**Purpose:** Track washing and packing of items after intake. This is the second step in the prison workflow, after intake counting.

**Access:** Same as intake — `ops.courierrecycling.com/prison`

**Prison staff see two main sections on their facility dashboard:**
1. **Incoming Deliveries** — expected and received shipments (intake workflow, Section 4.3)
2. **Processing Queue** — items that have been received and need washing/packing

**Processing report flow:**

1. Prison staff taps "New Processing Report"
2. Fills out the form:

| Field | Type | Notes |
|---|---|---|
| Staff name | Free text | Who did the work |
| Client | Dropdown | Select from active clients |
| Activity type | Wash or Pack | |
| Product type | Dropdown | From selected client's product registry |
| Quantity per size | Integer per size bucket (XXS through XXXL) | For clothing only. For bags, just total quantity. |
| Date | Date | Defaults to today |
| Notes | Text (optional) | |

3. Submits the report

**Design principles (apply to both intake and processing):**
- Maximum two taps to reach any form
- Large touch targets (tablet-first)
- Danish labels and instructions
- Facility context is pre-set from login. Staff cannot accidentally submit against the wrong prison.
- Client dropdown is always visible and required. Prison staff need to know which company's goods they're handling.
- Product list updates dynamically based on selected client

**Pipeline visibility:**
- Items received (from intake) but not yet washed show as "awaiting processing"
- Items marked Wash but not yet Pack show as "in progress"
- Items marked Pack show as "ready to ship"
- Items dispatched (from outbound dispatch module, Section 4.5) show as "shipped"
- Dashboard displays processing pipeline per prison: how many items at each stage, per client
- reco-admin can view aggregate processing volume across all prisons and all clients
- Full traceability chain: pickup request → transport → prison intake → wash → pack → dispatch

**QC tracking (future enhancement):**
- Reject/fail count per batch (items that fail QC after washing)
- Reject reason (torn, stained, broken zipper, etc.)
- Reject rate by prison facility, gear type, and client

### 4.5 Prison Outbound Dispatch (Clothing)

**Purpose:** Track when processed clothing leaves the prison and ships to the redistribution partner (e.g. SEKO). Closes the loop on the reuse track.

**Scope:** Clothing (reuse stream) only. Bag recycling outbound is out of scope for now.

**Access:** reco-admin creates dispatch records at `ops.courierrecycling.com`. Prison staff can view outbound history for their facility but cannot create dispatches.

**Dispatch flow:**

1. Prison staff mark clothing items as Pack (ready to ship)
2. Items are packed into boxes. Each box is labelled with a SKU code matching the product type and size.
3. reco-admin creates an outbound dispatch record:

| Field | Type | Notes |
|---|---|---|
| Prison facility | Dropdown | Which prison is shipping |
| Client | Dropdown | Whose clothing is being shipped |
| Dispatch date | Date | When the boxes left the prison |
| Destination | Text | e.g. "SEKO Logistics, Stockholm" |
| Carrier / transport provider | Text | Who collected the boxes |
| Notes | Text (optional) | |

4. Packing list (attached to the dispatch):

| Field | Type | Notes |
|---|---|---|
| Product type | Dropdown | From client's product registry (reuse-stream products only) |
| Size | Dropdown | XXS through XXXL |
| SKU code | Text | Applied to the physical box |
| Quantity | Integer | Items in this box |

Multiple packing list lines per dispatch (one per box or per SKU/size combination).

5. Dispatch status: `created` → `picked_up` → `delivered`

**What this enables:**
- Tracking how long items sit at prison after packing before they're shipped
- Confirming what was sent to SEKO vs. what was packed
- Full traceability: pickup request → prison intake → wash → pack → dispatch → SEKO
- Client dashboard can show "items dispatched for redistribution" as a metric

**Data model:**

**prison_dispatches**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| prison_facility_id | UUID | FK → prison_facilities |
| dispatch_date | Date | |
| destination | Text | e.g. "SEKO Logistics" |
| carrier | Text | Nullable |
| status | Enum | created, picked_up, delivered |
| notes | Text | Nullable |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**prison_dispatch_lines** (packing list)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| dispatch_id | UUID | FK → prison_dispatches |
| product_id | UUID | FK → client_products |
| size | Enum | xxs, xs, s, m, l, xl, xxl, xxxl |
| sku_code | Text | SKU label applied to the physical box |
| quantity | Integer | Items in this box/line |

### 4.6 Dashboard

**Purpose:** Single view of the entire operation. Replaces the Data Studio dashboard referenced in the global contract.

**Four dashboard contexts:**

#### reco Dashboard — Aggregated View (`ops.courierrecycling.com`)

Available to reco-admin and reco roles. Shows data across all clients. A client selector dropdown at the top allows switching to a single-client view at any time.

**Cross-client overview:**
- Total active clients
- Active pickups by status across all clients
- Pallets currently held at consolidation warehouses (with ageing alerts)
- Deliveries awaiting intake (all clients)
- Total items processed: all-time, YTD, current quarter, current month (all clients combined)
- Revenue summary across all clients (total, by client, by stream)
- Uninvoiced deliveries across all clients

**Volume tracking (all clients combined, filterable by client):**
- Breakdown by stream: PVCycling vs. PreLoved
- Breakdown by country (across all clients)
- Breakdown by product type
- Trend chart: monthly volume over time
- Client comparison: side-by-side volume per client

**Transport (all clients combined, filterable):**
- Transport cost per shipment (EUR)
- Average cost per item by country
- Transport cost trend over time
- Current vs. historic cost comparison (flagging anomalies like Q1 2026)
- Warehouse inventory: pallets currently held at consolidation provider warehouses, with ageing alerts
- Outbound shipment history

**Financial tracking (all clients combined, filterable):**
- Uninvoiced deliveries (count and estimated value)
- Recently invoiced deliveries
- Revenue by client
- Revenue by stream (bags EUR, clothing DKK)
- Invoice status distribution

**Prison performance (across all clients):**
- Processing volume by facility
- Wash/Pack pipeline depth
- Reporting frequency by facility (flag facilities that haven't reported in >14 days)
- Items ready for redistribution (packed but not yet dispatched)
- Items dispatched: outbound clothing shipments, with SKU-level packing lists
- Average time from Pack to dispatch (days items sit at prison after packing)
- Which clients' items are at which facility

**ESG metrics (all clients combined, filterable by client):**
- Reuse rate (items reused / total items processed)
- Recycling rate
- Total material recycled by type (auto-calculated: product material grams × items processed). Example output: "943 kg polypropylene recovered from 1,000 bike bags"
- Material breakdown chart: what materials have been recovered, in what quantities, across which products and clients
- Estimated CO2 avoided (based on weight and material type, configurable formula)
- Landfill diversion rate
- Cumulative items processed since program start
- Exportable ESG summary per client or aggregated (PDF or CSV)

#### reco Dashboard — Client Context View (`ops.courierrecycling.com`)

Same sections as above, but filtered to a single selected client. Accessible by clicking on a client in the aggregated view or using the client selector. Identical data structure, just scoped.

#### Client Dashboard (`[client].courierrecycling.com`)

Available to `client` and `client-global` users.

**`client` users** see data scoped to their location:
- Active pickup requests from their location and their status
- Items sent vs. items received (with discrepancy flag)
- Historical volume sent by quarter
- Reuse rate for their location's gear
- Material recovered: breakdown by material type based on their location's processed items
- ESG summary for their location (items recycled, items reused, CO2 avoided)

**`client-global` users** see data across all markets and locations within their tenant:
- All active pickup requests across all markets
- Aggregated volume tracking by market, by product, by quarter
- Cross-market comparison charts
- Combined ESG summary for the entire tenant
- Can drill down into any individual market/location

Does NOT show (either role): prison details, internal costs, transport costs, other clients' data.

#### Transport Dashboard (`ops.courierrecycling.com`)

Available to transport providers. Shows shipments assigned to them across all clients.

- Assigned pickups awaiting collection
- Active shipments in transit
- Completed deliveries (last 30 days)
- **Consolidation providers also see:** Warehouse inventory (pallets held, by client, by market, days held), outbound shipment creation, outbound shipment history
- No financial or operational data visible

### 4.7 Financial Tracking (Lightweight)

**Purpose:** Prevent uninvoiced deliveries and track transport costs. This is not accounting software.

**Per delivery record:**

| Field | Type | Editable by |
|---|---|---|
| Transport cost (EUR) | Decimal | Total of both legs: market→destination + warehouse→prison (if consolidation). Auto-populated from transport booking. Editable by reco-admin. |
| Recycling/service fee (auto-calculated) | Decimal | System (based on intake quantities × product pricing) |
| Invoice status | Enum: `not_invoiced` / `invoiced` / `paid` | reco-admin |
| Invoice number | Text (free reference) | reco-admin |
| Invoice date | Date | reco-admin |
| Notes | Text | reco-admin |

**Auto-calculations:**
- Transport cost per item = total transport cost (both legs) / total items in shipment
- Estimated invoice amount = sum of (quantity × product sell price) for all intake line items, using the price active at the time of delivery, plus total transport cost
- These calculations pull from `transport_bookings` (market→destination cost + warehouse→prison cost), `product_pricing` (sell price per product), and `intake_record_lines` (actual quantities counted by prison staff)

**Pricing is managed at the product level** in the Product Registry (Section 4.10). When prices change (per the 30-day notice clause in the Wolt contract), the admin adds a new pricing record with an `effective_from` date. Historical deliveries retain the rate that was active at the time of delivery.

**Dashboard alerts:**
- Deliveries older than 14 days with status `not_invoiced`
- Monthly uninvoiced revenue estimate

**Currency handling:**
- PVCycling revenue is in EUR. PreLoved revenue is in DKK. Transport costs are in EUR.
- reco-admin configures a system-level exchange rate (EUR↔DKK) in system settings. This rate is used for all cross-currency aggregations on dashboards and reports.
- Each user can set a preferred display currency in their profile (EUR or DKK). Default is EUR.
- All source data retains its original currency. The exchange rate is applied at display time only, never stored on financial records.
- When the exchange rate changes, reco-admin updates the system setting. Historical dashboard views use the currently configured rate (not a time-series of rates). This is a reporting convenience, not an accounting function.

### 4.8 Notifications

**Purpose:** Replace the email-and-hope workflow with structured alerts.

| Event | Recipients | Channel |
|---|---|---|
| New pickup request submitted | reco-admin | Email + in-app |
| Pickup confirmed by reco | Client submitter | Email + in-app |
| Transport booked | Transport provider (if has platform access), client submitter | Email + in-app |
| Pickup collected by transport | reco-admin, client submitter | In-app |
| Pallets received at warehouse | reco-admin | In-app |
| Pallets held at warehouse >14 days | reco-admin | Email + in-app |
| Outbound shipment dispatched | reco-admin, destination prison | Email + in-app |
| Delivery completed (direct or outbound) | reco-admin, destination prison | In-app |
| Prison intake submitted | reco-admin | In-app |
| Intake count discrepancy >15% | reco-admin | Email + in-app |
| Defective batch match on intake | reco-admin, prison staff | Email + in-app |
| Prison processing report submitted | reco-admin | In-app |
| Delivery not invoiced after 14 days | reco-admin | Email + in-app |
| Prison facility inactive >14 days | reco-admin | Email |

**Notification preferences:** Users can mute in-app notifications per event type. Email notifications for critical events (discrepancy, uninvoiced, defective batch) cannot be muted.

### 4.8b Data Correction and Edit Policy

**Purpose:** Allow corrections to submitted data without losing the original record. Errors happen. Prison staff miscount. reco-admin needs to fix things.

**Edit-in-place with audit trail:**

All editable records (intake records, intake lines, processing reports, transport bookings, financial records, pickup requests) support edit-in-place. When a field is changed:

1. The new value is saved to the record
2. The audit log captures: who edited, when, which field, old value, new value
3. A visual indicator ("edited") appears on the record in the UI, with a link to the edit history

**Who can edit what:**

| Record Type | Prison staff can edit | reco-admin can edit |
|---|---|---|
| Intake records | Yes, own facility's records, within 48 hours of submission | Yes, any record, any time |
| Processing reports (Wash/Pack) | Yes, own facility's records, within 48 hours of submission | Yes, any record, any time |
| Transport bookings | No | Yes |
| Financial records | No | Yes |
| Pickup requests | No | Yes (status, quantities, dates) |
| Prison dispatches | No | Yes |

**48-hour edit window for prison staff:** After 48 hours, prison-submitted records are locked. Only reco-admin can make further corrections. This prevents historical data from silently changing weeks later while still giving prison staff time to catch mistakes.

**No delete, only void:** Records are never deleted. If a record is completely wrong (e.g. duplicate submission), reco-admin can mark it as `voided` with a reason. Voided records are excluded from calculations and dashboards but remain visible in the audit trail.

### 4.9 FAQ and Manuals

**Purpose:** Self-service knowledge base so client contacts and prison staff can answer common questions without contacting reco.

**Structure:**

Two manual contexts, served based on user role and domain:

**Client Office Manual** (served on `[client].courierrecycling.com`):
- How to pack gear for shipment
- What gear types are accepted
- Minimum shipment sizes
- How to count and report quantities accurately
- How to book a pickup (platform walkthrough)
- What to do if a pickup needs to be cancelled
- FAQs (e.g. "Can we send helmets?", "What happens to the gear?", "How do I track my shipment?")
- Packing best practices (photos, step-by-step)

**Prison Operations Manual** (served on `ops.courierrecycling.com/prison`):
- How to receive a delivery and submit an intake report (platform walkthrough)
- How to count and record quantities per product type
- What to do if a delivery arrives that wasn't expected
- QC checklist for jackets (zippers, pockets, elastics, holes, stains)
- QC checklist for rain pants (elastics, holes, stains, colour, reflectives)
- Packing workflow (6 steps from the existing manual)
- Equipment needed (labels, bags, boxes, tape)
- How to submit processing reports (platform walkthrough)
- Gear type and size reference

**Format:** Markdown-rendered pages within the platform. reco-admin can edit content directly. Supports images and embedded PDFs. Versioned (audit trail of changes).

### 4.10 Product Registry

**Purpose:** Define each client's products with material composition, photos, and pricing. This is the foundation for accurate ESG reporting (material recycled = grams per material × items processed) and for onboarding new clients beyond Wolt.

**Product definition (per client):**

Each product registered in the system has:

| Field | Type | Required |
|---|---|---|
| Product name | Text (e.g. "Bike Bag (2022)") | Yes |
| Product code | Text (unique per tenant) | Yes |
| Product group | Text (e.g. "Bike Bag"). Groups related products for aggregated reporting. | No |
| Processing stream | `recycling` or `reuse`. Determines routing at prison. | Yes |
| Description | Text | No |
| Photos | File upload (up to 5 images) | No |
| Weight (total grams) | Decimal | Yes |
| Active | Boolean | Yes |

**Product versioning approach:** When a client releases a redesigned product (e.g. new Bike Bag), create a new product record: "Bike Bag (2025)" alongside the existing "Bike Bag (2022)". Both stay active. Both have their own material composition and pricing. Prison staff select the correct one at intake using product photos to tell them apart. When old products stop arriving (could be years), reco-admin deactivates them. Historical records are untouched because they link to the product that existed at the time.

The `product_group` field ties related products together for dashboard reporting. The reco dashboard can show "total Bike Bags recycled" across all versions within a group.

**Material composition (per product):**

Each product has one or more material lines:

| Field | Type | Required |
|---|---|---|
| Material name | Text (from material library) | Yes |
| Weight (grams) | Decimal | Yes |
| Recycling cost per kg (DKK) | Decimal | No |
| Recycling cost per kg (EUR) | Decimal | No |
| Recycling outcome | Enum: recycled, reprocessed, incinerated, landfill | No |

**Pre-loaded Wolt product data (from workbook):**

| Product | Total Weight | Key Materials |
|---|---|---|
| Bike Bag | 2,680g | Polypropylene 943g, PVC 386g, PE+Aluminium 296g, Polyester 294g, Foam 292g, Remains 260g, Cotton-polyester 98g, Zipper Metal 54g, POM 37g, Metal Screws 15g, Copper 4g, Nylon 1g |
| Car Bag | 918g | Polyester 555g, Foam 187g, Aluminum/Foam 90g, Remains 80g, POM 6g |
| Inner Bag | 324g | Polyester 237g, Aluminum/Foam 62g, Remains 25g |
| Heating Plate | 703g | Mica Plate 181g, Polypropylene 156g, Aluminum 150g, El (electrical) 146g, Polyester 44g, Foam 26g |

**Auto-calculations powered by this data:**

- Total material recycled per type = material grams × number of items processed (from intake records)
- Example: 1,000 bike bags processed = 943kg polypropylene, 386kg PVC, 294kg polyester, etc.
- These totals feed directly into the ESG dashboard
- Breakdown available by: material type, product type, country, time period

**Material library:**

A global (not tenant-scoped) reference table of known materials. When adding material composition to a product, users pick from this library or add new entries. This ensures consistent naming across clients (e.g. "Polyester" is always "Polyester", not sometimes "PES" or "poly").

**Client pricing (per product):**

Each product also carries client-facing pricing, visible only to reco-admin:

| Field | Type | Notes |
|---|---|---|
| Sell price per item | Decimal | What the client pays reco |
| Currency | Enum: EUR, DKK | |
| Effective from | Date | |
| Effective to | Date | Nullable (null = current) |

For Wolt, pre-loaded:
- Bike Bag: €4.29
- Car Bag: €4.14
- Inner Bag: €4.09
- Heating Plate: €2.99
- Clothing (PreLoved): DKK 35

This replaces the separate `pricing_config` table from v1.0. Pricing now lives at the product level within the client context.

### 4.11 Client Onboarding

**Purpose:** Structured interface for setting up new clients (tenants) when reco signs a new partner beyond Wolt. Accessible only to reco-admin.

**Onboarding steps:**

**Step 1 — Company details:**
- Company name
- Legal entity name
- Subdomain slug (e.g. "wolt" → wolt.courierrecycling.com). Auto-suggested from company name, editable. Validated for uniqueness and URL safety.
- CVR / VAT number
- Country
- Address
- Primary contact name, email, phone
- Billing contact name, email (if different)
- Contract reference (text, not the actual contract)

**Step 2 — Branding:**
- Logo upload (displayed in client portal header)
- Favicon upload
- Primary colour (HEX picker)
- Secondary colour (HEX picker)
- Background colour (HEX picker)
- Text colour (HEX picker)
- Accent colour (HEX picker)
- Heading font (select from allowed list or upload custom)
- Body font (select from allowed list or upload custom)
- Live preview: shows how the client portal will look with the selected branding
- "Skip" option: uses reco default branding (can be configured later)

**Step 3 — Markets and locations:**
- Add one or more markets (countries) where the client operates
- Per market: add one or more locations (cities/offices)
- Per location: city name, full pickup address, local contact name, email, phone

**Step 4 — Product catalog:**
- Add products using the Product Registry interface (Section 4.10)
- Upload product photos
- Enter material composition per product
- Set pricing per product

**Step 5 — User invitations:**
- Invite client users (email + role assignment)
- Invite transport providers associated with this client

**Step 6 — Review and activate:**
- Summary screen showing all entered data including branding preview
- reco-admin confirms and activates the tenant
- System creates the tenant record, provisions the subdomain, seeds the markets and products, sends invitation emails
- Client portal is live immediately at `[slug].courierrecycling.com`

**Wolt is pre-configured.** All existing Wolt data (markets, contacts, products, pricing, historical records) is loaded during initial platform deployment. The onboarding flow is for new clients only.

### 4.12 Data Import (Historical Migration)

**Purpose:** Migrate all historical data from 2022-2026 into the platform at launch.

**Sources to import:**

| Source | Data | Target Module |
|---|---|---|
| Google Sheets pickup request log | All pickup requests (Jan 2023 - Mar 2026) | Pickup Booking |
| Prison delivery intake log | All deliveries and counts (Jul 2022 - Mar 2026) | Intake and Counting |
| GreenLoop Google Form | Prison washing/packing data (Jun 2025 - Sep 2025) | Prison Processing |
| Invoice binder | Invoice references and amounts (Sep 2022 - Mar 2026) | Financial Tracking |
| TransportCostSummary spreadsheet | Transport costs by shipment | Financial Tracking |
| Wolt Recycling Workbook | Material composition per product | Product Registry |

**Import requirements:**
- CSV/XLSX upload with field mapping UI
- Validation step before commit (preview mapped data, flag errors)
- Imported records marked with `source: import` flag (distinguishable from live data)
- Import is one-time per source; no ongoing sync

### 4.13 Email Processing (Future Module)

**Purpose:** Automatically extract pickup requests or shipment updates from emails sent to a dedicated inbox (e.g. pickups@reco.dk).

**Scope (Phase 2):**
- Dedicated email inbox monitored by the platform
- Incoming emails parsed for: country, gear type, quantities, dates
- Parsed data populates a draft pickup request for reco-admin review
- Admin confirms or edits before the request goes live
- Original email stored as attachment on the request record

**Why Phase 2:** Requires NLP/LLM integration for reliable extraction. The structured form is the priority.

---

## 5. Data Model (Core Entities)

### 5.1 Entity Relationship Overview

```
tenant
  └── tenant_branding
  └── user (role-scoped)
  └── market (country)
        └── market_location (city/office with address)
  └── client_product (with product_group and processing_stream)
        └── product_photo
        └── product_material
        └── product_pricing
  └── pickup_request
        └── pickup_request_line (product-based quantities)
        └── transport_booking (direct or consolidation, two-leg cost)
        └── intake_record (submitted by prison staff)
              └── intake_record_line
        └── financial_record
  └── prison_report
        └── prison_report_line
  └── prison_dispatch (outbound clothing shipments from prison)
        └── prison_dispatch_line (packing list with SKU codes)
  └── batch_flag (defective batch registry)
  └── notification
  └── manual_page
  └── audit_log

transport_provider (global — linked to clients via transport_provider_clients)
  └── transport_provider_clients (join table: provider ↔ tenant)
  └── outbound_shipment (consolidation: groups multiple transport_bookings into one truck)

prison_facility (global — serves multiple clients)
material_library (global)
system_settings (exchange rates, thresholds)
```

### 5.2 Key Tables

**tenants**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| slug | Text | Unique. Subdomain identifier, e.g. "wolt" → wolt.courierrecycling.com |
| name | Text | Display name, e.g. "Wolt" |
| legal_name | Text | e.g. "Wolt Enterprises OY" |
| vat_number | Text | Nullable |
| country | Text | Company country |
| address | Text | Nullable |
| primary_contact_name | Text | |
| primary_contact_email | Text | |
| primary_contact_phone | Text | Nullable |
| billing_contact_name | Text | Nullable |
| billing_contact_email | Text | Nullable |
| contract_reference | Text | Nullable |
| active | Boolean | |
| created_at | Timestamp | |

**tenant_branding**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants. Unique (one branding record per tenant) |
| logo_url | Text | Nullable. Falls back to reco logo |
| favicon_url | Text | Nullable. Falls back to reco brand mark |
| primary_colour | Text | HEX value. Nullable. Falls back to `#ED1C24` |
| secondary_colour | Text | HEX value. Nullable. Falls back to `#9FA4A6` |
| background_colour | Text | HEX value. Nullable. Falls back to `#FAF9F4` |
| text_colour | Text | HEX value. Nullable. Falls back to `#000000` |
| accent_colour | Text | HEX value. Nullable. Falls back to `#ED1C24` |
| heading_font | Text | Nullable. Falls back to Aileron / Inter |
| body_font | Text | Nullable. Falls back to Aileron / Inter |

All nullable fields fall back to reco's brand identity when not set. Partial branding is supported (e.g. logo only, or logo + colours but default fonts).

**users**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, Supabase Auth UID |
| tenant_id | UUID | FK → tenants. Nullable for reco-admin, reco, transport, prison roles (they exist outside tenant context) |
| email | Text | Unique |
| name | Text | |
| role | Enum | reco-admin, reco, client, client-global, transport, prison |
| location_id | UUID | FK → market_locations. Nullable. Required for `client` role (locks them to a specific location). |
| prison_facility_id | UUID | FK → prison_facilities. Nullable. Required for prison role |
| can_view_financials | Boolean | Default false. Only relevant for `reco` role. |
| active | Boolean | |

**markets**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| country_code | Text | ISO 3166-1 alpha-2 |
| country_name | Text | |
| status | Enum | active, dormant, historical |

**market_locations** (cities/offices within a market)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| market_id | UUID | FK → markets |
| city | Text | e.g. "Prague", "Brno", "Helsinki" |
| address | Text | Full pickup address for this location |
| contact_name | Text | Nullable |
| contact_email | Text | Nullable |
| contact_phone | Text | Nullable |
| active | Boolean | |

A market (country) has one or more locations (cities). Pickup requests are booked from a specific location, giving transport providers the exact pickup address. Client users with the `client` role are locked to a specific location. Client users with the `client-global` role can book from any location across all markets.

**pickup_requests**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| request_number | Serial | Human-readable ID (e.g. PU-2026-0042) |
| market_id | UUID | FK → markets |
| location_id | UUID | FK → market_locations. Specific city/office for this pickup. |
| submitted_by | UUID | FK → users |
| status | Enum | submitted, confirmed, transport_booked, picked_up, at_warehouse, in_outbound_shipment, in_transit, delivered, intake_registered, cancelled |
| pallet_count | Integer | |
| estimated_weight_kg | Decimal | Nullable |
| pallet_dimensions | Text | Nullable |
| preferred_pickup_date | Date | |
| confirmed_pickup_date | Date | Nullable |
| notes | Text | Nullable |
| cancelled_at | Timestamp | Nullable |
| cancellation_reason | Text | Nullable |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**pickup_request_lines** (quantities per product)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| pickup_request_id | UUID | FK → pickup_requests |
| product_id | UUID | FK → client_products |
| quantity | Integer | Informed quantity for this product |

This replaces the hardcoded `bike_bag_count`, `car_bag_count` columns from v1.0. With a product registry, each client's products are different. A Wolt pickup has lines for Bike Bag, Car Bag, Inner Bag, Heating Plate, Clothing. A future client might have completely different product types. The line-item model handles both without schema changes.

**transport_providers**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | Text | Company name |
| contact_name | Text | |
| contact_email | Text | |
| contact_phone | Text | Nullable |
| service_regions | Text[] | Country codes they serve |
| supports_consolidation | Boolean | Whether this provider holds goods at a warehouse |
| warehouse_address | Text | Nullable. Required if supports_consolidation = true. |
| has_platform_access | Boolean | Whether provider staff log in to the platform |
| created_at | Timestamp | |

**transport_provider_clients** (links providers to specific clients)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| transport_provider_id | UUID | FK → transport_providers |
| tenant_id | UUID | FK → tenants |
| created_at | Timestamp | |

Provider details (name, address, contact info) are stored globally once. The join table controls which clients a provider can see pickups for. When reco-admin onboards a new client, they link existing providers or add new ones. A provider with platform access only sees pickups for clients they are linked to.

**transport_bookings** (replaces transport_assignments)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| pickup_request_id | UUID | FK → pickup_requests |
| transport_provider_id | UUID | FK → transport_providers |
| delivery_mode | Enum | direct, consolidation |
| destination_prison_id | UUID | FK → prison_facilities. Nullable. Set for direct; null for consolidation (prison set on outbound shipment). |
| status | Enum | transport_booked, picked_up, at_warehouse, in_outbound_shipment, in_transit, delivered |
| pickup_address | Text | Auto-filled from market_location address |
| pickup_date | Date | Confirmed pickup date |
| transport_cost_market_to_destination_eur | Decimal | Cost from market to prison (direct) or market to warehouse (consolidation). Known at time of booking. |
| transport_cost_warehouse_to_prison_eur | Decimal | Nullable. Only for consolidation. Cost from warehouse to prison. Set when outbound shipment is created, allocated per pickup by pallet count. |
| pallet_count_at_booking | Integer | Pallets for this specific pickup. Used for pro-rata cost allocation on consolidated outbound shipments. |
| delivery_notes | Text | Nullable |
| proof_of_delivery_url | Text | Nullable (file reference) |
| warehouse_received_date | Date | Nullable. When pallets arrived at provider warehouse (consolidation only) |
| outbound_shipment_id | UUID | FK → outbound_shipments. Nullable. Set when included in a consolidated shipment. |
| created_at | Timestamp | |
| updated_at | Timestamp | |

For direct deliveries: `destination_prison_id` is set, status goes `transport_booked` → `picked_up` → `in_transit` → `delivered`.
For consolidation: `destination_prison_id` is null at booking. Status goes `transport_booked` → `picked_up` → `at_warehouse`. Then when included in an outbound shipment: `in_outbound_shipment` → `in_transit` → `delivered`. The destination prison comes from the outbound shipment.

**outbound_shipments** (consolidation provider ships warehouse stock to prison)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| transport_provider_id | UUID | FK → transport_providers |
| destination_prison_id | UUID | FK → prison_facilities |
| status | Enum | created, dispatched, in_transit, delivered |
| total_pallets | Integer | Auto-calculated from included bookings |
| transport_cost_eur | Decimal | Total cost for warehouse→prison leg |
| dispatch_date | Date | Nullable |
| delivery_date | Date | Nullable |
| delivery_notes | Text | Nullable |
| proof_of_delivery_url | Text | Nullable |
| created_at | Timestamp | |
| updated_at | Timestamp | |

An outbound shipment links to multiple `transport_bookings` via the `outbound_shipment_id` FK on the booking. When the outbound shipment is marked `delivered`, all linked bookings update to `delivered` and their pickup requests update to `delivered`.

**Consolidation cost allocation:** When reco-admin enters the warehouse→prison transport cost on the outbound shipment, the system allocates it across the included bookings pro-rata by pallet count. Example: outbound shipment costs €700 and contains 3 bookings (3 pallets, 2 pallets, 2 pallets). The first booking gets €300, the second and third get €200 each. This populates `transport_cost_warehouse_to_prison_eur` on each booking.

**intake_records** (submitted by prison staff, not reco)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants. Selected by prison staff from client dropdown. |
| prison_facility_id | UUID | FK → prison_facilities. Auto-set from login. |
| pickup_request_id | UUID | FK → pickup_requests. Nullable. Linked if delivery was expected; null if unexpected delivery. |
| staff_name | Text | Free text. Who received the delivery. |
| received_date | Date | Defaults to today |
| discrepancy_flagged | Boolean | Auto-set if any line item exceeds threshold |
| quarantine_flagged | Boolean | Auto-set if batch matches defect list |
| photos | Text[] | File references for delivery photos |
| notes | Text | Nullable |
| created_at | Timestamp | |

**intake_record_lines** (actual quantities per product, submitted by prison staff)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| intake_record_id | UUID | FK → intake_records |
| product_id | UUID | FK → client_products |
| actual_quantity | Integer | What actually arrived, counted by prison staff |
| batch_numbers | Text[] | Batch/lot numbers for this product in this delivery |

Discrepancy is calculated per line: compare `intake_record_lines.actual_quantity` against the matching `pickup_request_lines.quantity` for the same product.

**financial_records**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| intake_record_id | UUID | FK → intake_records |
| transport_cost_eur | Decimal | Sum of both legs from transport booking (market→destination + warehouse→prison). Editable by reco-admin. |
| estimated_invoice_amount | Decimal | Auto-calculated from intake quantities × product pricing + transport cost |
| currency | Enum | EUR, DKK |
| invoice_status | Enum | not_invoiced, invoiced, paid |
| invoice_number | Text | Nullable |
| invoice_date | Date | Nullable |
| notes | Text | Nullable |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**prison_facilities** (global, not tenant-scoped — prisons process items for multiple clients)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| code | Text | e.g. "M", "R", "S" |
| name | Text | e.g. "Møgelkær Fængsel". Also used as the facility login username. |
| address | Text | Delivery address for transport providers |
| contact_email | Text | For magic link delivery |
| contact_phone | Text | Nullable |
| active | Boolean | |

**prison_reports**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants. Auto-resolved from the delivery assignment |
| prison_facility_id | UUID | FK → prison_facilities. Auto-set from login context |
| activity_type | Enum | wash, pack |
| staff_name | Text | Free text. Entered per submission by prison staff |
| submitted_at | Timestamp | |
| notes | Text | Nullable |

**prison_report_lines**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| prison_report_id | UUID | FK → prison_reports |
| product_id | UUID | FK → client_products. Dynamic per client (replaces hardcoded gear type enum) |
| size_xxs | Integer | Default 0 |
| size_xs | Integer | Default 0 |
| size_s | Integer | Default 0 |
| size_m | Integer | Default 0 |
| size_l | Integer | Default 0 |
| size_xl | Integer | Default 0 |
| size_xxl | Integer | Default 0 |
| size_xxxl | Integer | Default 0 |

**client_products**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| product_code | Text | Unique per tenant, e.g. "B-BB0002" |
| name | Text | e.g. "Bike Bag (2022)" |
| product_group | Text | Nullable. Groups related products for reporting, e.g. "Bike Bag". Dashboard can aggregate across group. |
| processing_stream | Enum | `recycling` or `reuse`. Determines routing: recycling = disassembly track, reuse = wash/pack track. Configurable per product so a future bag reuse stream is a config change, not a rebuild. |
| description | Text | Nullable |
| total_weight_grams | Decimal | Total product weight |
| active | Boolean | |
| created_at | Timestamp | |

**product_photos**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| product_id | UUID | FK → client_products |
| file_url | Text | Supabase Storage reference |
| sort_order | Integer | Display ordering |
| uploaded_at | Timestamp | |

**product_materials**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| product_id | UUID | FK → client_products |
| material_id | UUID | FK → material_library |
| weight_grams | Decimal | Grams of this material in one unit |
| recycling_cost_dkk_per_kg | Decimal | Nullable |
| recycling_cost_eur_per_kg | Decimal | Nullable |
| recycling_outcome | Enum | recycled, reprocessed, incinerated, landfill. Nullable |

**material_library** (global, not tenant-scoped)
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | Text | Unique, e.g. "Polyester", "PVC", "Polypropylene" |
| category | Text | Nullable, e.g. "Plastic", "Metal", "Textile" |
| created_at | Timestamp | |

**product_pricing**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| product_id | UUID | FK → client_products |
| sell_price_per_item | Decimal | What the client pays reco |
| currency | Enum | EUR, DKK |
| effective_from | Date | |
| effective_to | Date | Nullable (null = current) |

**batch_flags**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| batch_number | Text | |
| reason | Text | e.g. "Manufacturing defect — do not reuse" |
| flagged_by | UUID | FK → users |
| flagged_at | Timestamp | |

**audit_log**
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenant_id | UUID | FK → tenants |
| user_id | UUID | FK → users |
| action | Text | e.g. "intake_created", "invoice_status_changed" |
| entity_type | Text | e.g. "pickup_request", "financial_record" |
| entity_id | UUID | |
| metadata | JSONB | Changed fields, old/new values |
| created_at | Timestamp | |

---

## 6. Non-Functional Requirements

### 6.1 Performance

- Dashboard loads in under 2 seconds for up to 50,000 records
- Search and filter results return in under 500ms
- Concurrent users: support up to 50 simultaneous users (sufficient for current scale across all markets)

### 6.2 Availability

- 99.5% uptime target (Supabase and Vercel SLAs cover this)
- Planned maintenance windows communicated 48 hours in advance

### 6.3 Security

- All traffic over HTTPS
- Supabase RLS enforced on every table
- API routes protected by auth middleware
- File uploads scanned for type (only images, PDFs, CSVs accepted)
- Rate limiting on auth endpoints
- No sensitive data in URL parameters

### 6.4 Backup and Recovery

- Supabase automated daily backups (point-in-time recovery for Pro plan)
- Monthly manual backup export to reco-controlled storage
- Recovery time objective: 4 hours
- Recovery point objective: 24 hours

### 6.5 Localisation

- Primary UI language: English
- Prison module: Danish labels and instructions as secondary language option
- Date format: DD/MM/YYYY (European convention)
- Currency display: EUR and DKK with explicit labels

### 6.6 Accessibility

- WCAG 2.1 AA compliance target
- Keyboard navigable
- Screen reader compatible form labels
- Minimum contrast ratios met (reco brand palette already compliant: black on off-white)

---

## 7. UI and Brand Application

### 7.1 Design System — Ops Portal (`ops.courierrecycling.com`)

The ops portal always uses reco's visual identity:

| Element | Specification |
|---|---|
| Background | Off-white `#FAF9F4` |
| Primary text | Black `#000000` |
| Accent / CTAs | Reco Red `#ED1C24` (sparingly, per brand rules) |
| Secondary elements | Grey `#9FA4A6` |
| Headings | Aileron (or closest web-safe equivalent: Inter or similar clean sans-serif) |
| Subheadings, buttons, code | Consolas (monospace) |
| Body | Aileron / Inter |

### 7.2 Design System — Client Portals (`[client].courierrecycling.com`)

Client portals load branding from the `tenant_branding` table as CSS custom properties. All components reference these variables exclusively.

```css
:root {
  --brand-primary: var(--tenant-primary, #ED1C24);
  --brand-secondary: var(--tenant-secondary, #9FA4A6);
  --brand-bg: var(--tenant-bg, #FAF9F4);
  --brand-text: var(--tenant-text, #000000);
  --brand-accent: var(--tenant-accent, #ED1C24);
}
```

If a client provides no branding, their portal renders identically to the ops portal (full reco identity). Partial branding is supported: a client might upload a logo and set primary colour, leaving everything else at default.

### 7.3 Design System — Marketing Site (`courierrecycling.com`)

The marketing site uses reco's brand identity with courierrecycling.com-specific adaptations as needed (e.g. hero illustrations, case study layouts). Follows the reco marketing writing style guide (Section 1 of the brand identity: energetic, grounded, technically confident, understated nerd humour).

### 7.4 UI Principles (All Domains)

- Clean, minimal layouts. Generous whitespace.
- Tables for data-dense views. Cards for status summaries.
- Accent colour reserved for primary CTAs and critical alerts only. Never used as background colour.
- Status badges use colour coding: green (complete), amber (in progress/attention), red (blocked/alert), grey (inactive).
- Mobile-responsive. Prison module must work on tablets.
- No decorative illustrations in the platform UI (those are for the marketing site per brand guide).
- Prison interface: extra-large touch targets, minimal navigation, Danish language support.

---

## 8. Phased Delivery Plan

### Phase 1 — Foundation (Weeks 1-8)

**Deliverables:**
- Subdomain routing middleware (ops.courierrecycling.com + wolt.courierrecycling.com)
- Wildcard DNS configuration
- Auth system with all six roles (reco-admin, reco, client, client-global, transport, prison)
- Per-user financial visibility toggle for reco role
- Simplified prison login (facility-level accounts, magic links, Name field per submission)
- User management (invite, deactivate, role assignment)
- Tenant and market registry with locations/cities (Wolt pre-configured with all known market addresses)
- Product registry with material composition, product groups, and processing stream (pre-loaded with Wolt products)
- Material library (global reference table)
- Pickup booking form and queue (on wolt.courierrecycling.com), location-based with auto-filled addresses
- Transport provider registry (with consolidation/direct flag, warehouse address, client linking)
- Transport booking module: direct mode + consolidation mode with warehouse inventory and outbound shipments (on ops.courierrecycling.com)
- Transport cost: two-leg model (market→destination + warehouse→prison) with pro-rata pallet allocation
- Basic notification system (email on key events)
- System settings (facility registry, exchange rate config, per-user currency preference)

**Data migration:**
- Import pickup request log (2023-2026)
- Import Wolt product data and material compositions from workbook

**Outcome:** Wolt market contacts book pickups at wolt.courierrecycling.com. reco-admin manages the pipeline and books transport at ops.courierrecycling.com. Consolidation provider can track warehouse inventory and create outbound shipments. Google Sheets retired.

### Phase 2 — Processing (Weeks 9-14)

**Deliverables:**
- Prison intake and counting module at ops.courierrecycling.com/prison (tablet-optimised, Danish labels)
- Incoming deliveries view: direct and consolidated deliveries, with per-pickup intake forms
- Discrepancy tracking and alerts
- Batch/lot tracking and quarantine flags
- Prison processing forms (Wash/Pack)
- Prison outbound dispatch module (clothing): dispatch records, packing lists with SKU codes, dispatch status tracking
- Prison facility management
- Prison queue view (deliveries, processing pipeline, and outbound dispatch per facility, across all clients)
- Edit-in-place with audit trail (intake records, processing reports, all prison-submitted data)
- 48-hour edit window for prison staff; reco-admin override for any record
- Void functionality for duplicate/erroneous records

**Data migration:**
- Import prison delivery intake log (2022-2026)
- Import GreenLoop form data (2025)

**Outcome:** Full chain from pickup to prison processing tracked in one system. Google Forms retired. Prison staff submit reports from bookmarked tablet links.

### Phase 3 — Intelligence (Weeks 15-20)

**Deliverables:**
- reco dashboard: aggregated cross-client view + per-client context switching (ops)
- Client dashboard: scoped per-location view for `client` role, cross-market aggregated view for `client-global` role (client subdomain)
- Transport dashboard (ops)
- Financial tracking module with product-level pricing
- Invoice status management
- ESG metrics with material-level recycling totals (grams × items = kg per material)
- ESG export (PDF report, CSV data) per client and aggregated
- Data export (CSV, PDF report generation)

**Data migration:**
- Import invoice binder references
- Import transport cost spreadsheet

**Outcome:** Complete operational visibility across all domains. Historical data queryable. Uninvoiced deliveries impossible to miss. Wolt gets ESG data on their subdomain.

### Phase 4 — Knowledge and Polish (Weeks 21-24)

**Deliverables:**
- FAQ and manual system (client version on client subdomain, prison version on ops)
- Notification preferences and tuning
- Audit log viewer
- Platform documentation
- Performance optimisation and load testing

**Outcome:** Platform fully self-service. Users can onboard and operate without contacting reco.

### Phase 5 — Scale and Automation (Post-launch, timeline TBD)

**Deliverables:**
- Client onboarding wizard (structured setup for new tenants with branding preview)
- courierrecycling.com marketing site (public stats, case studies, contact form)
- Email processing module (auto-extract pickup requests from incoming email)
- Automated periodic ESG report generation (per client and aggregated)
- Client API endpoints (if clients want to pull ESG data programmatically)
- Custom domain support (e.g. client prefers recycling.wolt.com instead of wolt.courierrecycling.com)

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Prison staff don't adopt the new form | Processing data goes dark (already happened with Google Form) | Facility-level accounts, bookmarked tablet links, two-tap access, Danish language, training session at each facility |
| Client market contacts resist switching from email/sheets | Parallel systems, data fragmentation | reco stops accepting requests via old channels after Phase 1 go-live. Hard cutover. |
| Historical data import has quality issues | Dashboards show incorrect trends | Validation step in import flow. Flag imported records. Allow manual corrections. |
| Supabase RLS misconfiguration | Data leak between tenants or roles | Automated RLS policy tests in CI. Manual audit before each release. |
| Transport cost data is inconsistent across years | Financial dashboard misleading | Clear date-range filters. Q1 2026 flagged as anomalous in UI with explanation tooltip. |
| Counting discrepancies persist despite platform | Billing accuracy doesn't improve | The platform makes discrepancies visible and measurable. Visibility is the first step. Add packing photo requirements for repeat offenders. |
| Client branding creates accessibility issues | Low contrast, unreadable text on client portals | Enforce minimum WCAG AA contrast ratios at the branding config level. Reject colour combinations that fail. |
| Prison staff select wrong client on intake form | Intake tagged to wrong tenant, billing and reporting errors | Pre-populate client from linked pickup request whenever possible. Manual selection only for unexpected deliveries. Clear visual confirmation before submit. |
| Pallets sit at consolidation warehouse indefinitely | Delayed processing, lost goods, stale inventory | Auto-alert when pallets held >14 days (configurable). Warehouse inventory view shows ageing. reco-admin can escalate. |
| Consolidation shipments mix multiple clients | Complex intake at prison, harder to reconcile | Outbound shipments expand into per-pickup intake forms at the prison. Each form is single-client. System handles the grouping. |
| Marketing site exposes client-specific data | Competitive intelligence leak | Public stats API only returns aggregates. No client names, no per-client breakdowns. Case studies require explicit reco-admin approval before publishing. |

---

## 10. What This PRD Does Not Cover

- Actual invoice generation (use accounting software)
- Payment processing
- Tax or VAT calculations
- Courier personal data management (stays in Wolt's systems)
- SEKO integration (redistribution is downstream of reco's scope)
- Recycling partner management (confidential, NDA-protected, stays offline)
- Mobile native apps (responsive web is sufficient for current scale)
- Internal prison cost structures (these are strictly internal to reco and must never appear in any client-visible portal, export, or the marketing site)
- courierrecycling.com content strategy (marketing copy, case studies, SEO — separate project)

---

## 11. Open Questions

| Question | Owner | Needed By |
|---|---|---|
| Does Wolt want API access to pull ESG data programmatically? | Bragi → Chia-Ching | Phase 5 |
| Should transport providers be able to submit their own invoices through the platform? | Bragi | Phase 1 |
| Is there a preferred SSO provider if Wolt requests it? | Bragi → Wolt IT | Phase 4 |
| What is the minimum reporting frequency reco wants to enforce for prison facilities? | Bragi → prison contacts | Phase 2 |
| Should the platform generate the Data Studio-style reports referenced in the global contract, or link to a separate BI tool? | Bragi | Phase 3 |
| Should clients be able to customise their FAQ/manual content, or is it always managed by reco? | Bragi | Phase 4 |
| Do prison facility tablets have reliable internet, or should the prison form support offline submission with sync? | Bragi → prison contacts | Phase 2 |
| Should the marketing site support multiple languages (EN, DA, others)? | Bragi | Phase 5 |
| Will any client want a custom domain (e.g. recycling.wolt.com) instead of wolt.courierrecycling.com? | Bragi → Wolt | Phase 5 |

---

*End of document.*
