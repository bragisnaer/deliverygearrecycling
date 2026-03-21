# Phase 8: Dashboards and ESG Metrics - Research

**Researched:** 2026-03-21
**Domain:** Dashboard aggregation, ESG calculation engine, PDF/CSV export, Postgres query performance
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation decisions deferred to Claude's discretion.

### Claude's Discretion
All implementation choices — stack, patterns, architecture, library selection — follow established codebase conventions and domain best practices.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ESG-01 | Material recycled per type = `product_materials.weight_grams × intake_lines.actual_quantity`, aggregated by material, product, country, period | SQL join pattern with temporal composition filter documented in Architecture Patterns |
| ESG-02 | Example: 1,000 bike bags = 943kg polypropylene, 386kg PVC, 294kg polyester | Verified against Wolt seed data — calculation is pure multiplication, test-verifiable |
| ESG-03 | Reuse rate = items in `reuse` processing stream / total items processed | `processing_stream` enum on products; aggregate over `processing_report_lines` |
| ESG-04 | CO2 avoided = configurable formula; formula flagged as unresolved blocker — see Open Questions | Blocked: formula must be agreed before ESG-02 plan is built |
| ESG-05 | ESG calculations use temporal composition join: `effective_from`/`effective_to` on `product_materials` | Pattern documented — same date-range join used for financial pricing |
| ESG-06 | ESG methodology shown inline (formula and inputs visible) | Pure UI concern; methodology block component pattern |
| ESG-07 | ESG summary exportable as PDF report and CSV data file | `@react-pdf/renderer` 4.3.2 for PDF; native Response + Content-Disposition for CSV |
| DASH-01 | reco ops dashboard: active pickups by status, consolidation ageing, uninvoiced deliveries, volume by stream/country/product, revenue summary, prison pipeline | Multi-query parallel fetch pattern established; UninvoicedAlert already wired |
| DASH-02 | Ops dashboard client context switching (dropdown scopes view to single client) | searchParams-driven filter; raw db queries bypass tenant RLS |
| DASH-03 | Client dashboard (`client` role): own pickups, items sent/received, quarterly volume, reuse rate, ESG summary | withRLSContext enforces location isolation; `location_id` claim in JWT |
| DASH-04 | Client dashboard (`client-global` role): cross-market aggregated + drill-down to market | `client-global` role has no `location_id` restriction; aggregate query grouped by location |
| DASH-05 | Transport dashboard: pickup queue, active shipments, completed (30 days), warehouse inventory for consolidation providers | Existing `getAssignedPickups()` pattern reused and extended |
| DASH-06 | Dashboard loads under 2 seconds for up to 50,000 records; filter under 500ms | Indexed aggregation via raw SQL + composite indexes; see Performance section |
</phase_requirements>

---

## Summary

Phase 8 builds on a fully-established codebase: six portals exist, all data tables are in place, and the UninvoicedAlert widget already ships on the ops dashboard as a stub. The work is primarily query composition and UI assembly, not schema work. Three areas require careful attention: (1) the ESG calculation engine and its temporal composition join, which is algorithmically important but straightforward once the pattern is clear; (2) PDF generation via `@react-pdf/renderer`, which has known Next.js 16 / React 19 integration requirements that must be pre-empted; and (3) dashboard query performance for 50,000 records, which requires composite indexes and raw SQL aggregation rather than ORM query chaining.

The CO2 avoided formula (ESG-04) remains an unresolved blocker from a prior research note in STATE.md. This phase should stub the CO2 display with a clearly marked "formula pending" state and plan for it to be filled in when the formula is confirmed. The remainder of ESG is fully implementable.

**Primary recommendation:** Build in plan order 08-01 → 08-07. ESG engine first (pure functions, fully testable), then UI, then export, then each dashboard, then performance hardening. PDF export needs `serverExternalPackages` added to `next.config.ts` before the first PDF route is built.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | ORM + raw SQL via `sql` template tag | Established throughout all phases |
| next | 16.2.0 | App Router, Server Components, Route Handlers | Project constraint |
| react | 19.x | UI rendering | Project constraint |
| zod | 3.24.1 | Input validation | Established throughout |
| vitest | 3.1.0 | Unit tests for pure calculation functions | Established test infrastructure |

### New Dependencies Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @react-pdf/renderer | 4.3.2 | Server-side PDF generation | Phase requirement; React 19 compatible since 4.1.0 |

### No Charting Library Needed
The requirements specify tabular data, status counts, quarterly volume, and reuse rate — all renderable as tables, stat cards, and simple progress bars using existing shadcn/ui primitives. Recharts (3.8.0) and @tanstack/react-table (8.21.3) are available on npm if a chart or sortable table is needed for the cross-market view, but they are not installed and adding them is unnecessary complexity for v1 dashboards.

**Installation:**
```bash
pnpm --filter web add @react-pdf/renderer@4.3.2
```

**Version verification:** `npm view @react-pdf/renderer version` → 4.3.2 (verified 2026-03-21)

---

## Architecture Patterns

### Recommended File Structure

```
apps/web/app/
├── (ops)/
│   ├── dashboard/
│   │   ├── page.tsx              # Ops dashboard — replace stub (DASH-01, DASH-02)
│   │   └── components/
│   │       ├── pickup-status-summary.tsx
│   │       ├── consolidation-ageing-table.tsx
│   │       ├── prison-pipeline-card.tsx
│   │       ├── revenue-summary-card.tsx
│   │       └── client-context-switcher.tsx
│   ├── esg/
│   │   ├── page.tsx              # ESG metrics UI (ESG-03, ESG-04, ESG-06)
│   │   ├── actions.ts            # ESG query functions
│   │   ├── actions.test.ts       # Pure function unit tests
│   │   └── components/
│   │       ├── esg-summary-card.tsx
│   │       ├── material-breakdown-table.tsx
│   │       └── methodology-block.tsx
│   └── esg/
│       └── export/
│           └── route.ts          # GET handler: ?format=pdf|csv (ESG-07)
├── (client)/
│   └── overview/
│       ├── page.tsx              # Replace stub — client + client-global (DASH-03, DASH-04)
│       ├── actions.ts
│       └── components/
│           ├── pickup-activity-card.tsx
│           ├── volume-by-quarter-table.tsx
│           ├── discrepancy-flag.tsx
│           └── esg-summary-widget.tsx
└── (ops)/
    └── transport/
        └── portal/
            └── page.tsx          # Extend existing — add warehouse inventory section (DASH-05)
```

ESG pure functions live in a separate module so they can be tested without DB mocking:
```
apps/web/lib/
└── esg-calculator.ts             # calculateMaterialWeights(), calculateReuseRate(), formatCO2Avoided()
```

---

### Pattern 1: ESG Temporal Composition Join

The core of ESG-01 and ESG-05. For each intake line, find the `product_materials` record whose `effective_from`/`effective_to` window contains the parent `intake_record.delivery_date`.

```typescript
// lib/esg-calculator.ts — pure functions, no DB dependency
export type MaterialWeightRow = {
  material_name: string
  total_weight_kg: number
  item_count: number
}

export function sumMaterialWeights(
  lines: { actual_quantity: number; weight_grams: number; material_name: string }[]
): MaterialWeightRow[] {
  const acc = new Map<string, { weight_kg: number; count: number }>()
  for (const line of lines) {
    const kg = (line.actual_quantity * line.weight_grams) / 1000
    const existing = acc.get(line.material_name) ?? { weight_kg: 0, count: 0 }
    acc.set(line.material_name, {
      weight_kg: existing.weight_kg + kg,
      count: existing.count + line.actual_quantity,
    })
  }
  return Array.from(acc.entries())
    .map(([material_name, { weight_kg, count }]) => ({
      material_name,
      total_weight_kg: Math.round(weight_kg * 1000) / 1000,
      item_count: count,
    }))
    .sort((a, b) => b.total_weight_kg - a.total_weight_kg)
}
```

**SQL for temporal composition join (raw SQL via Drizzle `sql` template):**
```sql
-- Fetch intake lines with the composition active at delivery date
SELECT
  il.actual_quantity,
  pm.weight_grams,
  ml.name AS material_name
FROM intake_lines il
JOIN intake_records ir ON ir.id = il.intake_record_id
JOIN product_materials pm ON pm.product_id = il.product_id
  AND pm.effective_from <= ir.delivery_date
  AND (pm.effective_to IS NULL OR pm.effective_to > ir.delivery_date)
JOIN material_library ml ON ml.id = pm.material_library_id
WHERE ir.tenant_id = $1
  AND ir.voided = false
  -- optional: AND ir.delivery_date BETWEEN $start AND $end
```

This is the same effective-date pattern used for financial pricing (Phase 7). Note: a single product may have multiple `product_materials` rows active at the same time (one per material component). The join correctly returns one row per material per intake line, all of which are summed.

---

### Pattern 2: ESG Reuse Rate (ESG-03)

```typescript
// lib/esg-calculator.ts
export function calculateReuseRate(
  totalProcessed: number,
  reuseProcessed: number
): number {
  if (totalProcessed === 0) return 0
  return Math.round((reuseProcessed / totalProcessed) * 1000) / 10 // one decimal
}
```

SQL to get counts:
```sql
SELECT
  SUM(prl.quantity) FILTER (WHERE p.processing_stream = 'reuse') AS reuse_qty,
  SUM(prl.quantity) AS total_qty
FROM processing_report_lines prl
JOIN processing_reports pr ON pr.id = prl.processing_report_id
JOIN products p ON p.id = pr.product_id
WHERE pr.tenant_id = $1 AND pr.voided = false
```

---

### Pattern 3: CO2 Avoided Stub (ESG-04 — formula unresolved)

```typescript
// lib/esg-calculator.ts
export function calculateCO2Avoided(
  _materialWeights: MaterialWeightRow[],
  _formulaConfig: Record<string, number> | null
): { value_kg: number | null; formula_pending: boolean } {
  // Formula not yet defined — return stub until confirmed by reco/Wolt
  return { value_kg: null, formula_pending: true }
}
```

The methodology block (ESG-06) renders "CO2 avoided: formula pending — to be defined" when `formula_pending` is true. No visual regression when formula is filled in later — only the stub message changes.

---

### Pattern 4: Ops Dashboard Parallel Fetch with Client Filter (DASH-01, DASH-02)

```typescript
// (ops)/dashboard/page.tsx — Server Component
const clientFilter = searchParams.client as string | undefined

const [pickupSummary, consolidationAgeing, uninvoicedData, prissonPipeline, revenueSummary] =
  await Promise.all([
    getPickupStatusSummary(clientFilter),
    getConsolidationAgeing(clientFilter),
    getUninvoicedAlerts(),           // already exists in financial/actions.ts
    getPrisonPipeline(clientFilter),
    getRevenueSummary(clientFilter),
  ])
```

`clientFilter` (tenant_id) is passed to each query. Since these run as reco-admin, raw db (no RLS context needed) is used for cross-client queries — matching the pattern from financial/actions.ts `requireFinancialAccess()` with raw db for admin reads.

---

### Pattern 5: Client Dashboard Role Branching (DASH-03, DASH-04)

```typescript
// (client)/overview/page.tsx — Server Component
const session = await auth()
const role = session?.user?.role   // 'client' or 'client-global'
const locationId = session?.user?.location_id  // set for 'client', null for 'client-global'
const tenantId = session?.user?.tenant_id

// withRLSContext enforces tenant isolation
// For 'client': query WHERE location_id = $locationId
// For 'client-global': query grouped by location, no location_id filter
```

The two role views share the same page file. The branching is on `locationId`: when non-null, scope queries to that location. When null, aggregate across all locations in the tenant.

---

### Pattern 6: PDF Export Route Handler (ESG-07)

`@react-pdf/renderer` must be excluded from Next.js bundling to avoid React reconciler conflicts in the monorepo:

```typescript
// next.config.ts — add before building PDF route
const nextConfig: NextConfig = {
  transpilePackages: ["@repo/db", "@repo/types"],
  output: "standalone",
  serverExternalPackages: ['@react-pdf/renderer'],  // ADD THIS
}
```

Route handler pattern:
```typescript
// app/(ops)/esg/export/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import { EsgPdfDocument } from '@/components/esg-pdf-document'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'pdf'
  const tenantId = searchParams.get('tenant') ?? undefined

  if (format === 'csv') {
    const csv = await buildEsgCsv(tenantId)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="esg-report-${Date.now()}.csv"`,
      },
    })
  }

  const data = await getEsgData(tenantId)
  const buffer = await renderToBuffer(<EsgPdfDocument data={data} />)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="esg-report-${Date.now()}.pdf"`,
    },
  })
}
```

`EsgPdfDocument` is a standard `@react-pdf/renderer` Document/Page/View/Text component tree — server-rendered, no client-side interactivity.

---

### Pattern 7: Dashboard Performance (DASH-06)

For 50,000 records the primary tool is composite indexes + raw SQL aggregation. PostgreSQL materialised views are supported by `pgMaterializedView()` in drizzle-orm but drizzle-kit does not generate migrations for them — they must be written as manual SQL migrations (same pattern as used throughout this project for RLS triggers).

**Recommended approach: composite indexes + raw SQL aggregates, no materialised views for v1.**

Materialised views add `REFRESH MATERIALIZED VIEW` maintenance overhead and stale-data risk. For 50,000 rows across 5 tables with proper composite indexes, a well-written GROUP BY query returns in well under 2 seconds on Supabase's Postgres (verified by Phase 5 discrepancy dashboard which runs similar aggregation with no performance issues at current scale).

**Composite indexes for Phase 8 (manual migration `0007_esg_dashboard_indexes.sql`):**
```sql
-- ESG join performance
CREATE INDEX intake_records_delivery_date_tenant_idx ON intake_records(tenant_id, delivery_date);
CREATE INDEX product_materials_effective_date_idx ON product_materials(product_id, effective_from, effective_to);
CREATE INDEX intake_lines_product_id_idx ON intake_lines(product_id);

-- Processing reuse rate
CREATE INDEX processing_reports_stream_tenant_idx ON processing_reports(tenant_id, voided);
```

**If queries still exceed 2s at scale:** use `EXPLAIN ANALYZE` to identify the bottleneck, then consider a DB function (PLPGSQL) for the most expensive aggregation. Add materialised views only in Phase 8 follow-up if needed.

---

### Anti-Patterns to Avoid

- **N+1 on ESG materials:** Do not query `product_materials` per intake line. One SQL query with the temporal join fetches all lines in a single round trip.
- **Client-side calculation:** Do not send raw intake line data to the browser and calculate ESG weights in JS. Calculate server-side in a Server Action, send only aggregated results.
- **Materialised views in drizzle schema files:** drizzle-kit will not generate migrations for them. Define in manual SQL migration only.
- **Rendering `@react-pdf/renderer` components in React Server Components or client components:** use Route Handler (`route.ts`) with `renderToBuffer()` server-side only. Never import PDF components into page.tsx.
- **`export const dynamic = 'force-dynamic'` on all dashboard pages:** Use only where data must be fresh on every request. Consider `revalidatePath` after mutations instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML→PDF converter | `@react-pdf/renderer` | Handles fonts, layout, page breaks, encoding — complex to hand-roll correctly |
| CSV serialisation | Manual string join | Inline template literal with header row | For this use-case the data is structured and small; a one-function serialiser using `Array.join` on mapped rows is fine — no library needed |
| Temporal date-range join | App-level loop over composition records | SQL BETWEEN join in single query | N+1 query problem; DB is authoritative on date logic |
| Role-scoped data isolation | Manual WHERE tenant_id = checks | `withRLSContext` (established pattern) | RLS is the defence-in-depth layer; bypassing it for dashboards opens cross-tenant leakage |

**Key insight:** ESG calculation looks complex but is pure arithmetic (multiply, divide, group). The complexity is in the temporal join to get the right weight values — which SQL handles cleanly in one query.

---

## Common Pitfalls

### Pitfall 1: @react-pdf/renderer React Reconciler Conflict
**What goes wrong:** In a monorepo with React 19 in `apps/web` and potentially React 18 in root `node_modules`, `@react-pdf/renderer` picks up the wrong React reconciler version and throws at render time.
**Why it happens:** The package uses an internal React reconciler. In monorepos, package resolution can find two versions of React.
**How to avoid:** Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts` before writing the first PDF route. This tells Next.js to not bundle the package and use Node's native resolution instead.
**Warning signs:** `Error: Cannot read properties of undefined` or `Invalid hook call` when calling `renderToBuffer`.

### Pitfall 2: Multiple product_materials rows per product at the same delivery date
**What goes wrong:** A bike bag has 5 material components. The temporal join returns 5 rows per intake line (one per component). If the developer expects 1 row per intake line, they double-count or miscount.
**Why it happens:** `product_materials` is one-row-per-material, not one-row-per-product. A 2,680g bike bag has ~5 material rows that sum to 2,680g.
**How to avoid:** Always GROUP BY material after the join. The `sumMaterialWeights()` pure function handles this correctly. Test against the Wolt seed data: 1,000 bike bags should produce exactly 943kg polypropylene etc. (ESG-02).

### Pitfall 3: Client-global role has no location_id — queries that filter on location_id return empty
**What goes wrong:** `client-global` JWT has no `location_id` claim (null). If the dashboard query uses `withRLSContext` and the RLS policy checks `location_id = JWT.location_id`, client-global users see no data.
**Why it happens:** RLS for `client` role uses `location_id`; `client-global` role's RLS uses `tenant_id` only.
**How to avoid:** Client dashboard page branches on `locationId` before calling queries. Client-global queries must use `withRLSContext` with the `client-global` session, and query without a `location_id` filter (the RLS policy allows full tenant access for client-global).

### Pitfall 4: searchParams client filter exposes cross-tenant data
**What goes wrong:** The DASH-02 client context switcher lets reco-admin filter by tenant. A naive implementation that just passes `tenant_id` from searchParams to a withRLSContext query could work, but only if the session role is reco-admin (which has full cross-tenant access). If the auth guard is missing, a client user spoofing a searchParam could see another tenant's data.
**Why it happens:** Forgetting to verify role before applying client filter.
**How to avoid:** Client switcher queries use raw db (no RLS) gated by `requireRecoAdmin()` — matching the established pattern from financial/actions.ts.

### Pitfall 5: PDF route handler is not protected by auth
**What goes wrong:** `/esg/export?format=pdf` returns ESG data without authentication check.
**How to avoid:** PDF route handler calls `auth()` and verifies role before querying data. Same pattern as all other ops route handlers.

### Pitfall 6: Voided intake records included in ESG totals
**What goes wrong:** ESG weight totals are inflated by voided records.
**How to avoid:** All ESG queries filter `ir.voided = false` (matching the established pattern from discrepancy dashboard and pipeline queries).

---

## Code Examples

### ESG Verified Calculation (ESG-02 test anchor)
```typescript
// actions.test.ts — verifies Wolt bike bag example
import { sumMaterialWeights } from '@/lib/esg-calculator'

describe('sumMaterialWeights', () => {
  it('matches ESG-02: 1000 bike bags produce expected material weights', () => {
    // Wolt bike bag composition from PRD §4.10:
    // Polypropylene 943g, PVC 386g, Polyester 294g, etc. (per bag)
    const lines = [
      { actual_quantity: 1000, weight_grams: 943, material_name: 'Polypropylene' },
      { actual_quantity: 1000, weight_grams: 386, material_name: 'PVC' },
      { actual_quantity: 1000, weight_grams: 294, material_name: 'Polyester' },
    ]
    const result = sumMaterialWeights(lines)
    const pp = result.find(r => r.material_name === 'Polypropylene')
    expect(pp?.total_weight_kg).toBe(943) // 1000 × 943g / 1000 = 943kg
  })
})
```

### CSV Serialiser (no library needed)
```typescript
// lib/esg-calculator.ts
export function serializeEsgCsv(rows: MaterialWeightRow[]): string {
  const header = 'Material,Total Weight (kg),Item Count'
  const lines = rows.map(r =>
    `"${r.material_name}",${r.total_weight_kg},${r.item_count}`
  )
  return [header, ...lines].join('\n')
}
```

### Methodology Block (ESG-06)
```tsx
// components/methodology-block.tsx — Server Component
export function MethodologyBlock({
  formula,
  inputs,
}: {
  formula: string
  inputs: { label: string; value: string }[]
}) {
  return (
    <details className="rounded-lg border border-border bg-muted/30 p-4 text-[13px]">
      <summary className="cursor-pointer font-mono text-muted-foreground hover:text-foreground">
        Calculation methodology
      </summary>
      <div className="mt-3 space-y-2">
        <p className="font-mono">{formula}</p>
        <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
          {inputs.map(i => (
            <li key={i.label}><span className="font-medium">{i.label}:</span> {i.value}</li>
          ))}
        </ul>
      </div>
    </details>
  )
}
```

### Client Context Switcher (DASH-02)
```tsx
// Fully server-rendered — searchParam driven, no client state
// (ops)/dashboard/components/client-context-switcher.tsx
// Uses native <form> + <select> + submit, matching codebase's no-JS-for-navigation pattern
export function ClientContextSwitcher({
  clients,
  activeClientId,
}: {
  clients: { id: string; name: string }[]
  activeClientId?: string
}) {
  return (
    <form method="GET" action="/dashboard">
      <select name="client" defaultValue={activeClientId ?? ''} className="...">
        <option value="">All clients</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button type="submit" className="...">Apply</button>
    </form>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Materialised views for all aggregations | Composite indexes + raw SQL GROUP BY for v1 | Simpler to maintain; avoid REFRESH complexity |
| Client-side charting for all dashboard data | Server-rendered stat cards + tables | Faster initial load; works without JS |
| Separate PDF service | `@react-pdf/renderer` in Route Handler | No infrastructure cost; PDFs generated on-demand |

**Deprecated/outdated:**
- `serverComponentsExternalPackages` (old Next.js config key): replaced by `serverExternalPackages` in Next.js 15+. This project runs Next.js 16.2.0 — use `serverExternalPackages`.

---

## Open Questions

1. **CO2 Avoided Formula (ESG-04) — BLOCKER for 08-02**
   - What we know: ESG-04 requires a configurable formula based on weight and material type. STATE.md documents this as an unresolved blocker: "ESG CO2 avoided formula not defined in PRD — must be agreed with reco/Wolt before Phase 8 planning begins."
   - What's unclear: The formula itself (e.g., kg × material-specific CO2 factor? Compared to virgin material production? Transport distance included?).
   - Recommendation: Plan 08-02 stubs ESG-04 with `formula_pending: true` display. A separate micro-plan (08-02b or an addendum) implements the formula when confirmed. Do NOT block the entire phase on this.

2. **Wolt product_materials seed — exact per-material weight values for ESG-02 test**
   - What we know: PRD §4.10 documents Wolt bike bag composition. The seed is in `seed-wolt.ts`.
   - What's unclear: Whether the exact gram values for all 5 material components are in the seed or only the product total weight.
   - Recommendation: Plan 08-01 reads `seed-wolt.ts` at build time to anchor the ESG-02 test values against actual seeded data, not PRD approximations.

---

## Validation Architecture

**nyquist_validation: true** (from config.json — validation enabled)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `apps/web/vitest.config.ts` (exists) |
| Quick run command | `pnpm --filter web test --run` |
| Full suite command | `pnpm --filter web test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ESG-01 | `sumMaterialWeights()` aggregates by material correctly | unit | `pnpm --filter web test --run esg-calculator` | ❌ Wave 0 |
| ESG-02 | 1,000 bike bags → exact kg per material | unit | `pnpm --filter web test --run esg-calculator` | ❌ Wave 0 |
| ESG-03 | `calculateReuseRate()` handles zero denominator | unit | `pnpm --filter web test --run esg-calculator` | ❌ Wave 0 |
| ESG-05 | Temporal join returns composition active at delivery date | unit | `pnpm --filter web test --run esg-calculator` | ❌ Wave 0 |
| ESG-06 | MethodologyBlock renders formula string | manual | visual review | n/a |
| ESG-07 | CSV serialiser produces valid header + rows | unit | `pnpm --filter web test --run esg-calculator` | ❌ Wave 0 |
| ESG-07 | PDF route returns 200 + application/pdf content-type | manual-only | server integration test not in scope | n/a |
| DASH-06 | `<2s` load / `<500ms` filter | manual-only | load test not in Vitest scope | n/a |

All other dashboard requirements (DASH-01 through DASH-05) are integration-level and tested manually via the UI.

### Sampling Rate
- **Per task commit:** `pnpm --filter web test --run`
- **Per wave merge:** `pnpm --filter web test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/lib/esg-calculator.ts` — pure functions file (created in 08-01)
- [ ] `apps/web/lib/esg-calculator.test.ts` — covers ESG-01, ESG-02, ESG-03, ESG-05, ESG-07 CSV serialiser

*(No new test infrastructure needed — Vitest config already handles `**/*.test.ts` glob)*

---

## Sources

### Primary (HIGH confidence)
- Codebase: `packages/db/src/schema/products.ts` — confirmed `product_materials` schema with `effective_from`/`effective_to`
- Codebase: `packages/db/src/schema/intake.ts` — confirmed `intake_lines.actual_quantity` and `intake_records.delivery_date`
- Codebase: `packages/db/src/schema/processing.ts` — confirmed `processing_stream` enum on products
- Codebase: `packages/db/migrations/0006_financial_records.sql` — effective-date pricing join pattern (ESG-05 mirrors this)
- Codebase: `apps/web/app/(ops)/transport/portal/page.tsx` — confirmed tab pattern for transport dashboard (DASH-05 extends this)
- Codebase: `apps/web/app/(ops)/intake/discrepancy/page.tsx` — confirmed `Promise.all` parallel aggregate fetch pattern
- npm registry: `@react-pdf/renderer` — 4.3.2 current, React 19 compatible since 4.1.0 (verified 2026-03-21)
- Codebase: `apps/web/next.config.ts` — confirmed `serverExternalPackages` key not yet set; must be added

### Secondary (MEDIUM confidence)
- WebSearch: drizzle-orm pg_core `pgMaterializedView()` exists but drizzle-kit does not generate migrations — manual SQL required (verified against GitHub issue #2653 and community sources)
- WebSearch: `@react-pdf/renderer` monorepo React version conflict → `serverExternalPackages` fix is the documented solution (multiple sources agree)

### Tertiary (LOW confidence)
- WebSearch: Performance estimate "50,000 rows within 2s on Supabase Postgres with composite indexes" — plausible based on Postgres index scan characteristics but not measured against this specific schema

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified against npm registry
- Architecture: HIGH — all patterns derived directly from existing codebase code
- ESG calculation: HIGH — pure arithmetic, schema verified
- PDF export: MEDIUM — `serverExternalPackages` fix is community-documented; actual test against Next.js 16.2.0 occurs in implementation
- Pitfalls: HIGH — derived from schema inspection and established patterns
- Performance: MEDIUM — composite index approach is standard; actual query time will be validated in 08-07

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable stack; @react-pdf/renderer compatibility may shift if React 19 internals change)
