# Feature Research

**Domain:** Multi-tenant circular economy logistics operations SaaS — pickup booking, transport coordination, prison processing, financial tracking, ESG reporting
**Researched:** 2026-03-19
**Confidence:** HIGH (primary context from verified PRD + PROJECT.md; secondary research from web sources for pattern validation)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users assume exist. Missing these = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pickup request submission form | Replaces Google Form; client contacts need a structured way to book — this is the entry point for the entire operation | MEDIUM | Dynamic product list per tenant, photo upload, location auto-fill from user profile |
| Shipment status tracking (real-time or near-real-time) | Anyone who books a pickup needs to know where it is; without this, they email reco | MEDIUM | Status enum with clear progression; must be visible to client role with no extra navigation |
| Role-based access control | Different users see different data and perform different actions; any leak breaks trust | HIGH | Six roles with strict permission matrix; RLS at DB layer is non-negotiable |
| Multi-tenant data isolation | reco sells to multiple clients — data must be strictly isolated or the platform cannot be trusted | HIGH | RLS on every table; middleware-based tenant resolution from hostname |
| Audit trail on all edits | Operations platforms with corrections must show who changed what and when; regulators, clients, and internal dispute resolution all require this | HIGH | Full field-level old/new value capture; visual "edited" indicator on records |
| Email notifications on key events | Users don't live inside the platform; key actions (new booking, delivery confirmed, discrepancy alert) must push out | MEDIUM | Transactional email for critical events; in-app for secondary events |
| Dashboard with current operational status | Any ops platform must have a home view that answers "what needs attention right now" | MEDIUM | Different views per role; tables + status badges + alert counts |
| Data export (CSV/PDF) | Operations teams always need to pull data into reports, compliance documents, or external tools | MEDIUM | Per-module export; ESG export is a named requirement |
| Search and filter on all data tables | Operations platforms have hundreds of records; without search, the data is effectively inaccessible | LOW-MEDIUM | Filter by status, date range, client, country at minimum |
| Edit-in-place with 48-hour window for limited roles | Errors happen; prison staff need to correct miscounts before records are locked | MEDIUM | Time-boxed edit for prison role; unlimited for reco-admin; voiding instead of deletion |
| Secure authentication | Platform holds financial and operational data; auth must be robust | MEDIUM | Email+password, magic link, simplified facility-level login for prison |
| No-delete / void policy | Prevents accidental data loss; maintains audit integrity across historical records | LOW | Void with reason field; excluded from calculations but visible in audit log |
| In-app notifications | Users need to see unread alerts when they log in without relying on email | LOW-MEDIUM | Dismissible per event type; critical events unmutable |
| FAQ / manual system | Reduces support burden; both prison staff and client contacts have operational questions they should self-serve | MEDIUM | Markdown-rendered, role-scoped (client version vs prison version), editable by reco-admin |

### Differentiators (Competitive Advantage)

Features that set reco Platform apart. These are not table stakes for generic logistics SaaS — they are specific to the circular economy + prison processing domain.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Material-level ESG calculation engine | Most logistics platforms track weight or volume. reco tracks material composition (polypropylene grams, PVC grams, etc.) per product and multiplies by items processed — giving clients exact kg recovered by material type. This is a genuine data asset competitors don't have. | HIGH | Requires product registry with material composition data; calculates CO2 avoided, reuse rate, landfill diversion rate. Powers client ESG reports with specific numbers rather than estimates. |
| Prison facility workflow with tablet-first UX | No commercial WMS targets Danish correctional facilities as a user. A two-tap form with large touch targets, Danish labels, facility-bookmarked login, and pre-populated fields from the pickup data reduces the friction that caused GreenLoop form abandonment. | HIGH | Simplified facility-level accounts (not per-staff); Name field per submission instead of per-user auth; 7-day sessions |
| Discrepancy detection and trending | Automatically compares informed vs actual quantities, flags items over threshold, and shows trend by country/product/facility. This directly addresses the documented +217% discrepancy problem. | MEDIUM | Per-line comparison at intake; dashboard view of persistent problem markets; configurable threshold |
| Two-leg transport cost model with pro-rata pallet allocation | Consolidation transport has a market→warehouse leg and a warehouse→prison leg. reco tracks both and allocates the second leg proportionally by pallet count. Most TMS platforms don't model this — they assume a single leg. | HIGH | Cost allocation formula is specific to the consolidation model; drives accurate per-item cost on financial records |
| Consolidation provider warehouse inventory view | Providers see exactly which pallets are held at their warehouse, for which client, from which market, and for how many days. Ageing alerts prevent goods sitting indefinitely. | MEDIUM | Days-held counter, configurable threshold alert, outbound shipment creation from warehouse stock |
| Batch/lot defect tracking with quarantine | Flagging specific batch numbers as defective and triggering quarantine alerts on intake prevents defective gear from entering the reuse stream. Most WMS products have this at a much higher price point. | MEDIUM | Batch flag registry; auto-match on intake; quarantine state requires reco-admin override to clear |
| Tenant branding with CSS custom properties | Client portal looks like the client's brand, not reco's — giving enterprise clients (Wolt) a professional experience without a separate deployment. Partial branding is supported. | MEDIUM | CSS variables at :root level per tenant; branding injected server-side from tenant_branding table; WCAG contrast validation at config time |
| Processing stream routing (recycling vs reuse) | Products are flagged as recycling or reuse stream at the product level. This drives workflow at the prison (recycling items don't go through Wash/Pack; reuse items do). Changing the stream for a product is a config change, not a code change. | MEDIUM | Drives prison processing pipeline state; future-proofs bag reuse stream if Wolt adds it |
| Public aggregated ESG stats (marketing site) | Anonymised aggregate metrics (total items processed, kg recovered, CO2 avoided) served via ISR as social proof on the marketing site. Demonstrates impact without exposing client data. | LOW-MEDIUM | Read-only aggregate API endpoint; ISR refresh (e.g. daily); no per-client data exposed |
| Client onboarding wizard with live branding preview | Structured multi-step form to configure a new tenant — company details, branding (with live preview), markets, products, users — in under an hour. Instant subdomain provisioning on activation. | HIGH | Covers tenant setup end-to-end; branding preview is a significant UX differentiator; slug uniqueness validation |
| Historical data import with field mapping UI | Migrating 4 years of operational data from spreadsheets into the platform at launch, with a validation step and import flag. This is what makes historical dashboards meaningful from day one. | HIGH | CSV/XLSX upload; field mapping UI; validation preview before commit; import flag on records |
| Product versioning via new product records | When Wolt releases a redesigned bag, a new product record is created alongside the old one. Historical records retain the pricing and material composition that was accurate at time of delivery. Time-travel accuracy without schema complexity. | LOW-MEDIUM | product_group ties versions together for aggregated reporting; effective_from/to on pricing |

### Anti-Features (Things to Deliberately NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Invoice generation | Ops teams want one less tool | reco is not an accounting platform; building invoicing means entering a different regulatory and liability space (VAT, legal formats by country, accounting rules) | Track invoice status, number, and date as metadata on the financial record; use accounting software (e.g. Dinero, Billy, e-conomic) for actual generation |
| Payment processing | Closes the loop for clients | PCI compliance, payment provider contracts, reconciliation complexity. Way out of scope for v1 and probably permanently. | Mark invoice status as `paid` with a date; source of truth stays in accounting software |
| Mobile native apps (iOS/Android) | Field staff "want an app" | Native apps require separate build pipelines, app store submissions, release cycles, and platform-specific maintenance. The actual use case (prison tablets, occasional client use) is well served by responsive web. | Tablet-first responsive web with PWA capabilities if offline is needed; home screen bookmark replaces app install |
| Per-staff prison accounts | "Proper" identity management | Prison staff are transient, shared-device workers. Per-staff accounts would require reco to manage identity for people who aren't reco's customers. GreenLoop form abandonment was partly caused by friction. | Facility-level accounts + Name field per submission. This preserves traceability without individual auth friction. |
| Offline-first with sync | Prison tablets may have poor connectivity | Offline sync is a significant engineering investment (conflict resolution, sync queues, local storage). The question of tablet connectivity is open — validate first before building offline mode. | Investigate actual connectivity at each facility. If poor, consider optimistic UI with retry rather than full offline sync. |
| SEKO integration | Close the loop all the way to the redistribution partner | SEKO is downstream of reco's scope. Their systems are not reco's to integrate. Attempting this creates a hard dependency on a third-party system reco does not control. | Track dispatch to SEKO by recording the outbound dispatch record; traceability ends at dispatch |
| Internal prison cost structures | reco might want full P&L visibility | Prison facility processing costs are internal to reco and confidential. They must never appear in any client-visible surface, export, or the marketing site. | Keep prison cost data in reco's accounting tool. The platform tracks what clients need, not what reco's internal margins are. |
| Recycling partner management | End-to-end supply chain visibility | Recycling partner relationships are under NDA. Exposing partner data in the platform creates data governance risk. | Track material stream outcomes at the product level (recycled, reprocessed, incinerated, landfill as enum); no partner names or terms |
| Real-time everything (WebSocket subscriptions on all data) | Modern apps are real-time | Supabase Realtime is powerful but overuse adds complexity and load. Most data on this platform is updated infrequently enough that polling or page refresh is sufficient. | Use Realtime selectively: in-app notifications for live events. Dashboard data refreshes on page load or manual refresh. |
| Full ESG framework compliance reporting (GRI, SASB, CSRD) | Enterprise ESG teams want framework-aligned outputs | Full framework compliance requires legal interpretation of reporting standards, versioning to standards changes, and potentially third-party verification. Way beyond v1 scope. | Provide exportable data in CSV and summary PDF. Let the client's ESG team or consultants map it to their required frameworks. Document clearly what each metric means. |
| Courier personal data | Full traceability of each item to the courier | Courier names, addresses, and deposit data are Wolt's data, covered by their GDPR obligations. reco has no legal basis to store this. | Track items by product type, market, and batch. Courier identity is not needed for reco's operational or ESG purposes. |
| Tax/VAT calculations | Automated billing | Tax rules vary by country, product type, and contract. Building this correctly requires accounting expertise, not engineering. | Financial records track pre-tax amounts. Tax calculation stays in accounting software. |

---

## Feature Dependencies

```
[Product Registry]
    └──required by──> [Pickup Booking Form] (dynamic product list)
    └──required by──> [Prison Intake Form] (product list per client)
    └──required by──> [ESG Calculation Engine] (material grams per product)
    └──required by──> [Financial Tracking] (sell price per product)
    └──required by──> [Prison Processing Reports] (size buckets per product)

[Pickup Booking]
    └──required by──> [Transport Management] (something to transport)
    └──required by──> [Prison Intake] (expected delivery data for pre-population)
    └──required by──> [Financial Records] (quantities for invoice calculation)

[Transport Management]
    └──required by──> [Consolidation Warehouse Inventory] (pickup assigned to warehouse)
    └──required by──> [Prison Intake] (expected delivery list)
    └──required by──> [Financial Records] (transport cost both legs)

[Prison Intake and Counting]
    └──required by──> [Prison Processing Reports] (items received → processing queue)
    └──required by──> [Financial Records] (actual quantities for invoice calculation)
    └──required by──> [ESG Calculation Engine] (actual items processed)
    └──required by──> [Discrepancy Tracking] (actual vs informed comparison)

[Prison Processing Reports (Wash/Pack)]
    └──required by──> [Prison Outbound Dispatch] (items must be packed before dispatch)
    └──required by──> [ESG Metrics] (reuse rate: packed items / total items)

[Audit Trail]
    └──required by──> [Edit-in-Place] (every edit creates an audit entry)
    └──required by──> [Void Policy] (void action is an audit event)

[Multi-Tenant Data Model]
    └──required by──> [All modules] (tenant_id on every table, RLS on every query)

[Auth + Role System]
    └──required by──> [All modules] (every action is role-gated)

[Notification System]
    └──enhances──> [Discrepancy Detection] (alerts on threshold breach)
    └──enhances──> [Financial Tracking] (uninvoiced delivery alerts)
    └──enhances──> [Warehouse Inventory] (ageing pallet alerts)
    └──enhances──> [Prison Intake] (expected delivery arrival alerts)

[Batch/Lot Tracking]
    └──enhances──> [Prison Intake] (quarantine flag on defective batch match)
    └──requires──> [Product Registry] (batch numbers are per product)

[ESG Calculation Engine]
    └──requires──> [Product Registry] (material composition data)
    └──requires──> [Prison Intake] (actual item counts)
    └──requires──> [Prison Processing Reports] (wash/pack data for reuse rate)
    └──enhances──> [Client Dashboard] (ESG summary per tenant)
    └──enhances──> [Marketing Site] (aggregated public stats)

[Client Onboarding Wizard]
    └──requires──> [Tenant Branding] (branding config is step 2)
    └──requires──> [Product Registry] (product setup is step 4)
    └──requires──> [Market/Location Registry] (step 3)
    └──requires──> [User Invitation System] (step 5)
```

### Dependency Notes

- **Product Registry is load-bearing for Phase 1:** Every module that involves item quantities depends on it. Must be seeded with Wolt data before any other module can function.
- **Prison Intake depends on Transport Management:** Expected deliveries are generated from confirmed transport bookings. Intake can handle unexpected deliveries without this link, but the core workflow requires it.
- **ESG Calculation Engine is a late-phase feature:** It requires accurate intake data (Phase 2) before the numbers mean anything. Building the engine in Phase 1 would produce misleading results from incomplete data.
- **Financial Records depend on both Transport and Intake:** The estimated invoice amount is `(actual quantity × product price) + transport cost`. Both inputs must exist.
- **Audit Trail must be in place before edit-in-place:** You cannot add edit windows without the log that captures what changed. These ship together.
- **Multi-tenant model and Auth are Phase 1 prerequisites:** Every other feature builds on top of them. They cannot be deferred.

---

## MVP Definition

The MVP is Phase 1 + Phase 2 per the PRD. Phase 1 retires Google Sheets for pickup and transport. Phase 2 retires Google Forms for prison processing. Together they make the core value proposition real.

### Launch With (Phase 1 — Weeks 1-8)

- [ ] Auth system with all six roles — without this, nothing else can be role-gated
- [ ] Multi-tenant data model with RLS — prerequisite for all data operations
- [ ] Product Registry (pre-loaded with Wolt data) — required by pickup form and downstream modules
- [ ] Pickup Booking Form (wolt.courierrecycling.com) — replaces Google Sheets entry point
- [ ] Pickup queue and status management (ops.courierrecycling.com) — reco-admin workflow
- [ ] Transport Management: direct and consolidation modes, two-leg cost model — full transport chain
- [ ] Consolidation warehouse inventory view — consolidation provider workflow
- [ ] Subdomain routing middleware — required for multi-tenant URL architecture
- [ ] Basic notification system (email on key events) — replaces email-and-hope
- [ ] System settings: exchange rate, facility registry, alert thresholds — operational configuration
- [ ] Historical data import: pickup request log (2023-2026) — dashboard meaningful from day one

### Add After Phase 1 (Phase 2 — Weeks 9-14)

- [ ] Prison intake and counting module (tablet-first, Danish labels) — when Phase 1 is stable and transport is tracking deliveries
- [ ] Discrepancy detection and alerts — requires intake data
- [ ] Batch/lot tracking and quarantine flags — requires intake data
- [ ] Prison processing reports (Wash/Pack) — requires intake to populate the queue
- [ ] Prison outbound dispatch (clothing) — requires Wash/Pack data
- [ ] Edit-in-place with audit trail and void — requires all prison modules to exist first
- [ ] 48-hour edit window for prison staff — pairs with audit trail
- [ ] Historical data import: prison intake log (2022-2026), GreenLoop form data

### Future Consideration (Phase 3+)

- [ ] ESG Calculation Engine and dashboards — Phase 3; requires accurate historical intake data from Phase 2 import
- [ ] Financial tracking module — Phase 3; requires intake quantities and transport costs both in system
- [ ] reco aggregated cross-client dashboard — Phase 3; requires financial and ESG data
- [ ] Client ESG dashboard and export — Phase 3; requires ESG engine
- [ ] FAQ / manual system — Phase 4; valuable but not blocking operations
- [ ] Audit log viewer — Phase 4; trail is being built throughout, viewer is a UI concern
- [ ] Client onboarding wizard — Phase 5; only needed when a second client arrives
- [ ] Marketing site (courierrecycling.com) with public stats — Phase 5; requires mature ESG data
- [ ] Email processing module (auto-extract pickups from inbox) — Phase 5; requires NLP/LLM; structured form is the priority

---

## Feature Prioritisation Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + roles + RLS | HIGH | MEDIUM | P1 |
| Product registry (Wolt pre-load) | HIGH | MEDIUM | P1 |
| Pickup booking form | HIGH | MEDIUM | P1 |
| Transport management (direct + consolidation) | HIGH | HIGH | P1 |
| Subdomain routing | HIGH | MEDIUM | P1 |
| Multi-tenant data model | HIGH | HIGH | P1 |
| Basic email notifications | HIGH | LOW | P1 |
| Prison intake + counting (tablet-first) | HIGH | HIGH | P1 |
| Discrepancy detection + alerts | HIGH | MEDIUM | P1 |
| Edit-in-place + audit trail | HIGH | MEDIUM | P1 |
| Prison processing reports (Wash/Pack) | HIGH | MEDIUM | P1 |
| Batch/lot tracking + quarantine | MEDIUM | MEDIUM | P2 |
| Prison outbound dispatch | MEDIUM | MEDIUM | P2 |
| Financial tracking module | HIGH | MEDIUM | P2 |
| ESG calculation engine | HIGH | HIGH | P2 |
| Dashboards (reco + client + transport) | HIGH | HIGH | P2 |
| Data export (CSV, PDF) | MEDIUM | LOW | P2 |
| FAQ / manual system | MEDIUM | LOW | P2 |
| Audit log viewer | MEDIUM | LOW | P2 |
| Client onboarding wizard | MEDIUM | HIGH | P3 |
| Marketing site with public stats | LOW | MEDIUM | P3 |
| Email processing module (AI extraction) | MEDIUM | HIGH | P3 |
| Custom domain support | LOW | HIGH | P3 |
| API endpoints for clients | LOW | MEDIUM | P3 |
| SSO integration | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have — blocks operations or replaces an existing system that will be retired
- P2: Should have — adds significant value once P1 is stable
- P3: Nice to have — future consideration, deferred until product-market fit

---

## Domain-Specific UX Patterns

Patterns observed in operations SaaS, logistics platforms, and circular economy tools that are directly applicable to reco Platform.

### Operations Dashboard Patterns

**Status badge + count cards at the top.** Operations dashboards should lead with the answer to "what needs attention right now" — typically a row of KPI cards (uninvoiced count, discrepancy count, pallets ageing at warehouse) above the main data table. This is standard in TMS and WMS platforms.

**Table-primary, card-secondary.** Dense operational data belongs in tables, not cards. Cards are for summary metrics. Sortable columns, filter inputs, and inline status badges are expected. Expandable rows for detail (e.g. consolidated outbound shipment expanding into component pickups).

**Role-contextual home view.** The home screen is different for each role. reco-admin sees cross-client aggregated alerts. A client user sees their market's open pickups. A prison user sees today's expected deliveries. Each role's dashboard is the answer to their primary daily question.

**Client context switcher for multi-client operators.** reco-admin and reco roles work across clients. A persistent client selector dropdown at the top of ops.courierrecycling.com is the standard pattern (used by agencies and MSPs across SaaS). Switching context filters all data without navigating away.

### Tablet Data Entry Patterns (Prison Module)

**Single-column forms.** Multi-column layouts require Z-pattern eye tracking that slows data entry and increases errors. Prison staff filling in intake counts on a tablet need a single vertical scroll path.

**Large touch targets.** Minimum 44×44px tap targets (Apple HIG) for all interactive elements. Integer steppers (+ / - buttons) for item counts are preferable to text input fields on a tablet — faster and eliminates fat-finger errors on numeric entry.

**Pre-population from context.** The most important tablet UX principle: never make prison staff re-enter data the system already knows. Client, market, and product list are pre-populated from the linked pickup request. Staff only enter what is genuinely new (actual quantities, their name, notes).

**Maximum two taps to reach any form.** The PRD correctly calls this out. Every extra tap is a reason to abandon. The bookmark points to the facility dashboard; one tap opens the intake form for an expected delivery.

**Confirmation screen before submit.** Tablets are prone to accidental taps. A summary confirmation screen before final submission prevents mis-submits on a form that cannot be easily deleted (only voided after the fact).

**Danish language for prison module.** This is not optional for adoption. The GreenLoop form worked in Danish. A Danish interface respects the actual users' language and reduces errors from misunderstood field labels.

**Facility context locked from login.** Prison staff must never need to select their own facility. It is set by the account they log in with. The only selection they make is the client (which company's goods they're handling) and this must be large and visually prominent.

### Multi-Role Access Patterns

**Permission-aware UI (hide, don't just disable).** Fields and navigation items that a user cannot access should not be visible at all, not just greyed out. Greys create confusion about whether the feature exists. For example, transport costs must be completely absent from client-visible surfaces.

**Role indicator in the navigation.** Users should always know which role they are operating under, especially for reco staff who can switch client contexts.

**Financial data behind an explicit toggle (reco role).** The per-user financial visibility toggle for the reco role is the right pattern for sensitive data that should be opt-in. This is used in legal and HR SaaS (e.g. salary data shown only when explicitly enabled for that user session).

**Unmutable critical alerts.** Discrepancy alerts, quarantine flags, and uninvoiced delivery reminders should not be silenceable — this is standard in compliance and operations tools where missing an alert creates a financial or safety risk.

### ESG Reporting Patterns

**Metric → source → formula.** Good ESG dashboards show each metric with its calculation methodology inline (e.g. "943 kg polypropylene — calculated from 1,000 bike bags × 943g polypropylene per bag"). This is table stakes for any ESG report that will be used in external reporting.

**Per-client and aggregated views.** Clients want their own numbers; reco wants totals. Both views should be generated from the same calculation engine to avoid discrepancies between what reco shows and what clients export.

**Exportable summary.** ESG data is ultimately consumed outside the platform — in annual reports, sustainability disclosures, procurement questionnaires. PDF export (human-readable) and CSV export (machine-readable for ESG frameworks) are both expected.

**CO2 calculation methodology must be documented.** The CO2 avoided calculation uses a configurable formula. That formula, its inputs, and its assumptions must be displayed alongside the number. This is especially important if clients use the figure in public reporting.

**Reuse vs. recycle distinction.** Reuse (clothing via PreLoved/SEKO) and recycling (bags via PVCycling) have different environmental impacts and different material recovery profiles. The ESG engine must track these separately and allow clients to report on both streams.

---

## Competitor Feature Analysis

No direct competitors exist in the narrow domain of prison-processed courier gear recycling management. The relevant reference points are the categories of tools reco replaces or competes with conceptually.

| Feature | Generic TMS (e.g. GoFreight, Freightview) | Generic WMS (e.g. Fishbowl, inFlow) | ESG Platforms (e.g. Watershed, Workiva) | reco Platform Approach |
|---------|-------------------------------------------|--------------------------------------|----------------------------------------|------------------------|
| Multi-tenant data isolation | Usually single-tenant or basic org separation | Typically single-tenant | Often multi-tenant (enterprise) | RLS on every table, subdomain-based tenant resolution |
| ESG material tracking | Not present | Not present | GHG emissions focus, limited material composition | Material-level (grams per material type) × items processed |
| Tablet-first data entry for non-professional users | Not designed for | Not designed for | Not designed for | Specific UX for prison facility staff on shared tablets |
| Consolidation transport model (two-leg cost) | Some TMS products handle it | Not applicable | Not applicable | Native two-leg model with pro-rata pallet cost allocation |
| Discrepancy detection (informed vs actual counts) | Freight invoice discrepancy (billing focus) | Inventory variance reporting | Not applicable | Per-product-line comparison at intake with trend dashboard |
| Batch/lot quarantine | Inventory lot tracking (generic) | Lot traceability (generic) | Not applicable | Defect flag registry with auto-match on intake |
| Processing stream routing (recycle vs reuse) | Not applicable | Not applicable | Not applicable | Product-level stream flag drives prison workflow routing |
| White-label client portals | Rarely | Rarely | Sometimes (enterprise) | Per-tenant branding via CSS custom properties with fallback |
| Prison module in Danish | Not applicable | Not applicable | Not applicable | Danish language option for prison UI |

**Conclusion:** reco Platform is not replacing one category of software — it is replacing a patchwork of Google Sheets, Google Forms, and email. The differentiators are not about beating competitors on feature checklists; they are about building something that actually works for the specific users (prison staff, Wolt market contacts, reco operations team) and the specific data model (circular economy material tracking, prison processing pipeline).

---

## Sources

- reco Platform PROJECT.md (primary source, verified) — `C:/Users/BragiHallsson/Projects/deliverygearrecycling/.planning/PROJECT.md`
- reco Platform PRD v1.5 (primary source, verified) — `C:/Users/BragiHallsson/Projects/deliverygearrecycling/PRD.md`
- [Best UI/UX Practices for B2B SaaS Platforms in 2025 — Callin](https://callin.io/best-ui-ux-practices-for-b2b-saas-platforms/) (MEDIUM confidence — web source)
- [6 steps to design thoughtful dashboards for B2B SaaS — UX Collective](https://uxdesign.cc/design-thoughtful-dashboards-for-b2b-saas-ff484385960d) (MEDIUM confidence — web source)
- [Data Table Design UX Patterns & Best Practices — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) (MEDIUM confidence — web source)
- [Dashboard UI/UX Design for Logistics & Supply Chain — AufaitUX](https://www.aufaitux.com/blog/dashboard-design-logistics-supply-chain-ux/) (MEDIUM confidence — web source)
- [Freight Invoice Auditing Software: Purpose, Features & Best Platforms — Avantiico](https://avantiico.com/freight-invoice-auditing-software/) (MEDIUM confidence — web source)
- [Top 10 ESG Reporting Software Platforms in 2025 — Credibl](https://www.crediblesg.com/blogs/top-10-esg-reporting-software-platforms-in-2025/) (MEDIUM confidence — web source)
- [Custom Domains and Subdomains for Multi-Tenant SaaS — DCHost](https://www.dchost.com/blog/en/custom-domains-and-subdomains-for-multi-tenant-saas/) (MEDIUM confidence — web source)
- [How to Calculate Recycling Impact — Okon Recycling](https://www.okonrecycling.com/consumer-recycling-initiatives/learn-about-recycling/calculate-recycling-impact/) (LOW confidence — web source, methodology reference only)

---

*Feature research for: reco Platform — multi-tenant circular economy logistics operations SaaS*
*Researched: 2026-03-19*
