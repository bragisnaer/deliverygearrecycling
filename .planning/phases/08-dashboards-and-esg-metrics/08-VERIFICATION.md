---
phase: 08-dashboards-and-esg-metrics
verified: 2026-03-21T11:30:00Z
status: passed
score: 13/13 must-haves verified
---

# Phase 8: Dashboards and ESG Metrics Verification Report

**Phase Goal:** reco-admin, client, and transport users each have a role-scoped dashboard showing their most important operational data; ESG metrics are calculated from actual intake records and are exportable
**Verified:** 2026-03-21T11:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ESG calculation engine computes material weights, reuse rate, and CSV correctly | VERIFIED | `lib/esg-calculator.ts` — 4 pure functions, 15 tests anchored to Wolt seed data (1000 bike bags = 943kg Polypropylene) |
| 2 | ESG metrics page displays material breakdown, reuse rate, CO2 pending, and methodology inline | VERIFIED | `app/(ops)/esg/page.tsx` — parallel fetch via `Promise.all`, `MaterialBreakdownTable`, `EsgSummaryCard`, `MethodologyBlock` all wired |
| 3 | ESG data is exportable as CSV and PDF | VERIFIED | `app/(ops)/esg/export/route.ts` — auth-protected GET handler, CSV via `serializeEsgCsv`, PDF via `@react-pdf/renderer` with `Content-Disposition` header |
| 4 | ESG calculations use temporal composition join (effective_from/effective_to) | VERIFIED | `app/(ops)/esg/actions.ts` line 77-79: `pm.effective_from <= ir.delivery_date AND (pm.effective_to IS NULL OR pm.effective_to > ir.delivery_date)` |
| 5 | Ops dashboard shows active pickups, consolidation ageing, prison pipeline, revenue summary | VERIFIED | `app/(ops)/dashboard/page.tsx` — all 5 sections present with `Promise.all` for parallel fetch |
| 6 | Ops dashboard client context switcher scopes all data to a single tenant | VERIFIED | `app/(ops)/dashboard/components/client-context-switcher.tsx` — `<form method="GET">` with `<select name="client">`, `searchParams.client` drives all query filters |
| 7 | Client role user sees only their own location's pickup activity and ESG data | VERIFIED | `app/(client)/overview/page.tsx` — `locationId = session.user.location_id` for `client` role, passed to all 4 action calls |
| 8 | Client-global role sees aggregated cross-market data with market drill-down | VERIFIED | `app/(client)/overview/page.tsx` — `isGlobal = role === 'client-global'`, pill badge drill-down links, `getClientLocations` fetched for global |
| 9 | Transport dashboard shows pickup queue with stats; consolidation providers see warehouse inventory | VERIFIED | `app/(ops)/transport/portal/page.tsx` — `TransportStats` card row, `WarehouseInventorySection` conditionally rendered on `providerInfo?.provider_type === 'consolidation'` |
| 10 | ESG page is accessible from ops nav bar | VERIFIED | `app/(ops)/ops-nav-bar.tsx` line 14: `{ label: 'ESG', href: '/esg' }` in `NAV_ITEMS` |
| 11 | ESG methodology is shown inline (formula and inputs visible) | VERIFIED | `app/(ops)/esg/components/methodology-block.tsx` — `<details>` element with formula and all input sources listed |
| 12 | ESG client summary widget shows material recovery and reuse rate per client | VERIFIED | `app/(client)/overview/components/esg-summary-widget.tsx` — displays totalItems, totalWeightKg, reuseRate, top 3 materials |
| 13 | Composite indexes exist for ESG temporal joins and dashboard aggregates | VERIFIED | `packages/db/migrations/0007_esg_dashboard_indexes.sql` — 8 `CREATE INDEX IF NOT EXISTS` statements; registered in `_journal.json` at idx 5 |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/esg-calculator.ts` | Pure ESG calculation functions | VERIFIED | 82 lines, exports `sumMaterialWeights`, `calculateReuseRate`, `calculateCO2Avoided`, `serializeEsgCsv`, `MaterialWeightRow` |
| `apps/web/lib/esg-calculator.test.ts` | Unit tests anchored to Wolt seed values | VERIFIED | 192 lines, 15 tests in 4 describe blocks, contains `943` anchor value |
| `apps/web/app/(ops)/esg/page.tsx` | ESG metrics page with server-fetched data | VERIFIED | 167 lines, `force-dynamic`, `Promise.all` parallel fetch, all components rendered |
| `apps/web/app/(ops)/esg/actions.ts` | Server actions for ESG data queries | VERIFIED | Exports `getEsgData`, `getProcessingStreamCounts`, `getEsgTenants`; `'use server'` directive |
| `apps/web/app/(ops)/esg/components/methodology-block.tsx` | Inline methodology display | VERIFIED | Contains `Calculation methodology` in `<summary>`, renders formula and inputs |
| `apps/web/app/(ops)/esg/components/esg-summary-card.tsx` | Summary stat cards with pending state | VERIFIED | Renders `pending` prop as italic "Pending" text |
| `apps/web/app/(ops)/esg/components/material-breakdown-table.tsx` | Material weight table | VERIFIED | Imports `Table` from `@/components/ui/table`, renders rows with right-aligned weight/items |
| `apps/web/app/(ops)/esg/export/route.ts` | GET handler for PDF and CSV export | VERIFIED | Auth check, CSV branch, PDF branch via `renderToBuffer`, `Content-Disposition` headers |
| `apps/web/app/(ops)/esg/components/esg-pdf-document.tsx` | React-PDF document component | VERIFIED | Imports `Document` from `@react-pdf/renderer`, contains "ESG Report" title |
| `apps/web/next.config.ts` | `serverExternalPackages` for @react-pdf/renderer | VERIFIED | Line 9: `serverExternalPackages: ['@react-pdf/renderer']` |
| `apps/web/app/(ops)/dashboard/page.tsx` | Full ops dashboard replacing stub | VERIFIED | 114 lines, `force-dynamic`, `Promise.all` with 5 queries, `UninvoicedAlert`, `ClientContextSwitcher` |
| `apps/web/app/(ops)/dashboard/actions.ts` | Dashboard query functions | VERIFIED | Exports all 5: `getPickupStatusSummary`, `getConsolidationAgeing`, `getPrisonPipeline`, `getRevenueSummary`, `getDashboardTenants` |
| `apps/web/app/(ops)/dashboard/components/client-context-switcher.tsx` | Client filter dropdown | VERIFIED | Contains `<form method="GET"` and `<select name="client">` |
| `apps/web/app/(ops)/dashboard/components/pickup-status-summary.tsx` | Pickup status badge grid | VERIFIED | Exists, renders status badges from data array |
| `apps/web/app/(ops)/dashboard/components/consolidation-ageing-table.tsx` | Ageing table with color indicators | VERIFIED | Exists, imports `Table` from `@/components/ui/table` |
| `apps/web/app/(ops)/dashboard/components/prison-pipeline-card.tsx` | Prison pipeline table | VERIFIED | Exists, renders facility rows |
| `apps/web/app/(ops)/dashboard/components/revenue-summary-card.tsx` | Revenue summary stat cards | VERIFIED | Exists, accepts `currency` prop for EUR/DKK display |
| `apps/web/app/(client)/overview/page.tsx` | Client dashboard replacing stub | VERIFIED | 129 lines, `force-dynamic`, role-branching `client` vs `client-global`, `Promise.all` parallel fetch |
| `apps/web/app/(client)/overview/actions.ts` | Client-scoped query functions | VERIFIED | Exports `getClientPickupActivity`, `getClientSentVsReceived`, `getClientVolumeByQuarter`, `getClientEsgSummary`, `getClientLocations`; imports `sumMaterialWeights` |
| `apps/web/app/(client)/overview/components/esg-summary-widget.tsx` | Client ESG summary widget | VERIFIED | Imports `MaterialWeightRow` from `@/lib/esg-calculator`, renders totalItems, material weight, reuse rate, top 3 materials |
| `apps/web/app/(client)/overview/components/discrepancy-flag.tsx` | Sent vs received discrepancy table | VERIFIED | Exists, renders discrepancy pct with color coding |
| `apps/web/app/(client)/overview/components/volume-by-quarter-table.tsx` | Historical volume by quarter | VERIFIED | Exists, renders quarterly item counts |
| `apps/web/app/(client)/overview/components/pickup-activity-card.tsx` | Active pickups and recent list | VERIFIED | Exists, renders active status counts and recent list |
| `apps/web/app/(ops)/transport/portal/page.tsx` | Enhanced transport portal | VERIFIED | 239 lines, `TransportStats` added, `WarehouseInventorySection` conditionally rendered |
| `apps/web/app/(ops)/transport/portal/actions.ts` | Transport query functions | VERIFIED | Exports `getTransportProviderInfo`, `getWarehouseInventory`, `getOutboundShipmentHistory` alongside existing `getAssignedPickups` |
| `apps/web/app/(ops)/transport/portal/components/transport-stats.tsx` | Transport stat cards | VERIFIED | Exists, renders 4 stat cards |
| `apps/web/app/(ops)/transport/portal/components/warehouse-inventory-section.tsx` | Warehouse inventory | VERIFIED | Exists, imports `Table` from `@/components/ui/table` |
| `packages/db/migrations/0007_esg_dashboard_indexes.sql` | Composite indexes for Phase 8 queries | VERIFIED | 8 `CREATE INDEX IF NOT EXISTS` statements, includes `WHERE voided = false` partial indexes |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `esg-calculator.test.ts` | `lib/esg-calculator.ts` | `import { sumMaterialWeights }` | WIRED | Line 4: direct import, 15 tests pass |
| `app/(ops)/esg/actions.ts` | `lib/esg-calculator.ts` | `import { sumMaterialWeights }` | WIRED | Lines 7-10: imports `sumMaterialWeights`, `calculateReuseRate`, `calculateCO2Avoided` |
| `app/(ops)/esg/page.tsx` | `app/(ops)/esg/actions.ts` | `getEsgData()` | WIRED | Line 19: `Promise.all([getEsgData(...), getProcessingStreamCounts(...), getEsgTenants()])` |
| `app/(ops)/esg/export/route.ts` | `lib/esg-calculator.ts` | `import { serializeEsgCsv }` | WIRED | Line 9: `serializeEsgCsv, calculateReuseRate` imported and called |
| `app/(ops)/dashboard/page.tsx` | `app/(ops)/dashboard/actions.ts` | `Promise.all` parallel fetch | WIRED | Lines 48-55: all 5 query functions called in `Promise.all` |
| `app/(ops)/dashboard/page.tsx` | `financial/components/uninvoiced-alert.tsx` | `import UninvoicedAlert` | WIRED | Line 4: import, rendered at line 71 gated by `hasFinancialAccess` |
| `app/(client)/overview/page.tsx` | `app/(client)/overview/actions.ts` | `Promise.all` parallel fetch | WIRED | Lines 46-51: all 4 action calls in `Promise.all` |
| `app/(client)/overview/actions.ts` | `lib/esg-calculator.ts` | `import { sumMaterialWeights }` | WIRED | Line 5: `sumMaterialWeights, calculateReuseRate` imported; called in `getClientEsgSummary` |
| `app/(ops)/transport/portal/page.tsx` | `app/(ops)/transport/portal/actions.ts` | `getAssignedPickups()` | WIRED | Line 136: `getAssignedPickups()` called; `getTransportProviderInfo`, `getWarehouseInventory`, `getOutboundShipmentHistory` also wired |
| `packages/db/migrations/0007_esg_dashboard_indexes.sql` | `intake_records` table | indexes on intake_records | WIRED | `intake_records_tenant_delivery_date_idx` and `intake_records_delivery_date_idx` both target `intake_records` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ESG-01 | 08-01 | Total material recycled per type from intake × product_materials | SATISFIED | `sumMaterialWeights` in `esg-calculator.ts` + temporal join in `esg/actions.ts` |
| ESG-02 | 08-01 | 1000 bike bags = 943kg polypropylene, etc. | SATISFIED | Test in `esg-calculator.test.ts` line 13-70, all 12 material weights verified |
| ESG-03 | 08-01 | Reuse rate: reuse stream items / total processed | SATISFIED | `calculateReuseRate` exported and used in page, actions, and client dashboard |
| ESG-04 | 08-02 | CO2 avoided — formula pending state shown | SATISFIED | `calculateCO2Avoided` returns `{ value_kg: null, formula_pending: true }`; ESG page shows "Formula pending" card |
| ESG-05 | 08-07 | Temporal composition join uses effective_from/effective_to | SATISFIED | Temporal join in `esg/actions.ts` and `overview/actions.ts`; composite index `product_materials_product_effective_idx` in migration |
| ESG-06 | 08-02 | ESG methodology shown inline (formula and inputs visible) | SATISFIED | `MethodologyBlock` component renders `<details>` with formula and all inputs listed |
| ESG-07 | 08-03 | ESG summary exportable as PDF and CSV | SATISFIED | `export/route.ts` serves CSV via `serializeEsgCsv` and PDF via `@react-pdf/renderer`; auth-protected |
| DASH-01 | 08-04 | Ops dashboard: pickups by status, ageing, uninvoiced, volume, revenue, pipeline | SATISFIED | All 5 sections present in `dashboard/page.tsx` with dedicated actions and components |
| DASH-02 | 08-04 | Ops dashboard: client context switching scopes all data | SATISFIED | `ClientContextSwitcher` + `searchParams.client` passed to all 5 dashboard queries |
| DASH-03 | 08-05 | Client dashboard: own location pickup activity, discrepancy, volume, ESG | SATISFIED | `overview/page.tsx` with `locationId = session.user.location_id` for client role |
| DASH-04 | 08-05 | Client-global dashboard: aggregated cross-market, drill-down | SATISFIED | `isGlobal` branching in page, `getClientLocations` fetched, market pill badge drill-down links |
| DASH-05 | 08-06 | Transport dashboard: assigned pickups, stats, consolidation warehouse section | SATISFIED | `TransportStats` always shown; `WarehouseInventorySection` gated on `provider_type === 'consolidation'` |
| DASH-06 | 08-07 | Dashboard loads under 2s for 50k records; filters under 500ms | SATISFIED (infrastructure) | 8 composite indexes in `0007_esg_dashboard_indexes.sql` covering all Phase 8 hot paths; cannot verify timing without load test (flagged for human) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/(ops)/esg/actions.ts` | 93 | `return { ..., reuseRate: 0, ... }` — hardcoded 0 in `getEsgData` return | INFO | Not a stub — the page and export route both call `calculateReuseRate` independently. The `EsgData.reuseRate` field is always 0 but is never displayed directly; callers compute it from `streamCounts`. No user-visible impact. |

No stub implementations found. No missing data flows. No placeholder components.

---

### Human Verification Required

#### 1. DASH-06 Load Performance

**Test:** Import 50,000+ intake records and load `/dashboard` and `/esg` pages; run a client filter.
**Expected:** Dashboard page renders in under 2 seconds; filter response under 500ms.
**Why human:** Cannot verify timing with static analysis. Indexes exist to support it but require a populated DB and load measurement.

#### 2. ESG PDF Download

**Test:** Navigate to `/esg/export?format=pdf` as reco-admin; click "Download PDF" on the ESG page.
**Expected:** Browser downloads a PDF file named `esg-report-{timestamp}.pdf` containing material breakdown table and methodology section.
**Why human:** `renderToBuffer` + `@react-pdf/renderer` server-side rendering requires a live Next.js environment to verify end-to-end.

#### 3. Client-Global Cross-Market Drill-Down

**Test:** Log in as `client-global` user; click a market pill badge on the Dashboard.
**Expected:** All data sections (discrepancy, volume, ESG) re-scope to the selected location; URL shows `?location={id}`.
**Why human:** Role-branching and `searchParams.location` interaction requires a seeded DB with multiple locations.

#### 4. Transport Portal — Consolidation Warehouse Section

**Test:** Log in as a transport user linked to a `consolidation` provider; view `/transport/portal`.
**Expected:** `TransportStats` summary row appears above tabs; "Warehouse Inventory" and "Outbound Shipment History" sections appear below tabs.
**Why human:** Requires a `transport_providers` record with `provider_type = 'consolidation'` and a user linked to it.

---

### Notes

**Internal inconsistency (non-blocking):** `getEsgData` in `apps/web/app/(ops)/esg/actions.ts` returns `reuseRate: 0` hardcoded (line 93). Both the ESG page and export route correctly bypass this by calling `calculateReuseRate(streamCounts.total_qty, streamCounts.reuse_qty)` directly after fetching `streamCounts`. The `EsgData.reuseRate` field is therefore dead — never consumed — but the displayed value is correct. This is a minor code quality issue, not a goal blocker.

**CO2 Avoided intentional stub:** `calculateCO2Avoided` always returns `{ value_kg: null, formula_pending: true }`. This is an acknowledged business blocker (ESG-04): the per-material CO2 formula has not been agreed with reco/Wolt. The UI correctly renders a "Formula pending" card. This is not a verification gap.

---

## Summary

All 13 observable truths verified. All 28 required artifacts confirmed to exist, be substantive, and be wired. All 13 requirement IDs (DASH-01 through DASH-06, ESG-01 through ESG-07) satisfied with implementation evidence. One info-level anti-pattern found (hardcoded `reuseRate: 0` in action return, bypassed correctly by callers). Four items flagged for human verification (load performance, PDF download, client-global drill-down, consolidation warehouse section) — none block automated goal verification.

**Phase 8 goal is achieved.**

---

_Verified: 2026-03-21T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
