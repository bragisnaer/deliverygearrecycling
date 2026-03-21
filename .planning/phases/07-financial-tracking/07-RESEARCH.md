# Phase 7: Financial Tracking - Research

**Researched:** 2026-03-21
**Domain:** Financial record management, invoice lifecycle, currency display, alert widgets
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None — user deferred all implementation decisions to Claude's judgment.

### Claude's Discretion

All implementation choices are at Claude's discretion. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIN-01 | Each delivered intake record has a financial record with: transport cost (EUR, sum of both legs), estimated invoice amount (auto-calculated), invoice status (`not_invoiced` / `invoiced` / `paid`), invoice number, invoice date, notes | Schema design, auto-create trigger pattern, two-leg cost assembly |
| FIN-02 | Estimated invoice amount uses the product pricing record with `effective_to = null` (current) at time of delivery | Temporal pricing query pattern from Phase 3 |
| FIN-03 | Invoice status, number, date, and notes are editable by reco-admin | Edit-in-place pattern, audit trail integration |
| FIN-04 | Dashboard alert: deliveries older than 14 days with `not_invoiced`; monthly uninvoiced revenue estimate | Alert query pattern, 14-day threshold from system_settings |
| FIN-05 | Exchange rate (EUR/DKK) configured by reco-admin; applied at display time only, never stored; users can set preferred display currency (EUR/DKK, default EUR) | display-time-only pattern established in settings, user preference storage approach |
| FIN-06 | Financial data visible to reco-admin always; reco role only if `can_view_financials` toggle is on; never to client/transport/prison roles | RLS policy pattern, can_view_financials flag already in users table |
</phase_requirements>

---

## Summary

Phase 7 introduces a `financial_records` table anchored 1:1 to `intake_records`, auto-populated when an intake record is created. Each financial record assembles the two-leg transport cost (already stored on `transport_bookings.transport_cost_market_to_destination_eur` and `outbound_shipment_pickups.allocated_cost_eur`), calculates an estimated invoice amount from current product pricing × actual quantities, and tracks invoice lifecycle status. A user-preference table stores EUR/DKK display currency per user, with the system-level exchange rate already live in `system_settings`.

The implementation is greenfield schema work plus application logic layered on top of well-established Phase 1–6 patterns. There are no runtime state concerns — this is additive only. The most nuanced element is the invoice amount calculation: it must query `product_pricing` records where `effective_to IS NULL` at the time the function runs (not a historical snapshot), which is the "current pricing" interpretation required by FIN-02. Transport cost assembly requires joining through `pickup_id` → `transport_bookings` (leg 1) and `outbound_shipment_id` → `outbound_shipment_pickups.allocated_cost_eur` (leg 2).

The 14-day uninvoiced alert (FIN-04) reads from `system_settings.warehouse_ageing_threshold_days` — the same configurable threshold used for warehouse ageing. The monthly uninvoiced revenue estimate is a SUM of `estimated_invoice_amount_eur` WHERE `invoice_status = 'not_invoiced'` AND `created_at >= start of current month`. Currency toggle (FIN-05) is display-only; user preference is stored in a `user_preferences` table (new, keyed to `users.id`) or as a cookie — cookie is simpler and avoids a new table.

**Primary recommendation:** Use a DB trigger (same pattern as IN-YYYY-NNNN reference trigger) to auto-insert the `financial_records` row on `intake_records` INSERT, then run the invoice amount calculation as a Server Action on-demand or on first view. Do not store the calculated amount in the trigger — use a Server Action that writes `estimated_invoice_amount_eur` post-insert so it can access RLS-scoped product_pricing data.

---

## Standard Stack

### Core (all already in use — no new installations)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | Schema definition, queries | All prior phases |
| @repo/db | workspace | Schema exports, withRLSContext | All prior phases |
| zod | existing | Input validation in Server Actions | All prior phases |
| react-hook-form + @hookform/resolvers | existing | Form state for invoice edit UI | Phases 3–6 |
| sonner | existing | Toast feedback on save | Phases 3–6 |
| shadcn/ui (Card, Table, Badge, Dialog, Select) | existing | UI primitives | Phases 3–6 |

### No New Dependencies

This phase requires no new npm packages. Every capability needed (DB, forms, toasts, UI) is already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
packages/db/src/schema/
└── financial.ts           # financial_records table + invoice_status enum

apps/web/app/(ops)/
└── financial/
    ├── page.tsx           # Financial records list (reco-admin + reco with flag)
    ├── [id]/
    │   └── page.tsx       # Financial record detail + invoice edit
    ├── components/
    │   ├── invoice-edit-form.tsx    # Client component for status/number/date/notes
    │   └── uninvoiced-alert.tsx     # Dashboard widget (also used in dashboard)
    └── actions.ts         # Server Actions
```

### Pattern 1: Financial Record Schema

The `financial_records` table is 1:1 with `intake_records`. It uses a unique FK to enforce the 1:1 relationship.

```typescript
// packages/db/src/schema/financial.ts
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'not_invoiced',
  'invoiced',
  'paid',
])

export const financialRecords = pgTable(
  'financial_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    intake_record_id: uuid('intake_record_id')
      .notNull()
      .unique()
      .references(() => intakeRecords.id),
    tenant_id: text('tenant_id').notNull().references(() => tenants.id),
    // Two-leg transport cost — sum stored here for fast display
    transport_cost_eur: numeric('transport_cost_eur', { precision: 12, scale: 4 }),
    // Calculated: sum(actual_quantity * price_eur) + transport_cost_eur
    estimated_invoice_amount_eur: numeric('estimated_invoice_amount_eur', {
      precision: 12, scale: 4,
    }),
    invoice_status: invoiceStatusEnum('invoice_status').notNull().default('not_invoiced'),
    invoice_number: text('invoice_number'),    // nullable
    invoice_date: timestamp('invoice_date'),   // nullable
    notes: text('notes'),                      // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('financial_records_intake_record_id_idx').on(t.intake_record_id),
    index('financial_records_tenant_id_idx').on(t.tenant_id),
    index('financial_records_invoice_status_idx').on(t.invoice_status),
    // Fail-closed
    pgPolicy('financial_records_deny_all', {
      as: 'restrictive', for: 'all', using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('financial_records_reco_admin_all', {
      as: 'permissive', to: recoAdminRole, for: 'all',
      using: sql`true`, withCheck: sql`true`,
    }),
    // reco with can_view_financials: SELECT only
    pgPolicy('financial_records_reco_read', {
      as: 'permissive', to: recoRole, for: 'select',
      using: sql`EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = current_setting('request.jwt.claim.sub', true)
          AND u.can_view_financials = true
      )`,
    }),
    // NO client/transport/prison access (FIN-06)
  ]
)
```

**RLS note:** The `reco` role policy for `financial_records` is the only policy in the codebase that checks `can_view_financials`. The `users` table already has this column (AUTH-08). The EXISTS subquery pattern matches `product_materials_client_read` from Phase 3.

### Pattern 2: Auto-Create Trigger

Use a DB trigger on `intake_records` INSERT to create the `financial_records` skeleton row. This matches the `IN-YYYY-NNNN` reference trigger from Phase 5. The trigger only inserts the row — it does NOT calculate the invoice amount (pricing query requires RLS context).

```sql
-- In migration SQL (not drizzle-kit generated)
CREATE OR REPLACE FUNCTION create_financial_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO financial_records (
    intake_record_id,
    tenant_id,
    invoice_status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.tenant_id,
    'not_invoiced',
    NOW(),
    NOW()
  )
  ON CONFLICT (intake_record_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER financial_record_on_intake_insert
  AFTER INSERT ON intake_records
  FOR EACH ROW EXECUTE FUNCTION create_financial_record();
```

**Why SECURITY DEFINER:** The trigger runs as the function owner (superuser), bypassing RLS. This is the same approach used by `audit_log_trigger()` in Phase 6. The `ON CONFLICT DO NOTHING` makes it idempotent for imported historical data.

### Pattern 3: Invoice Amount Calculation

This is a Server Action (not a trigger) because:
1. It needs to query `product_pricing` with the RLS pattern
2. It runs in application context where `withRLSContext` is available
3. It can be called during intake creation AND re-triggered if pricing changes

```typescript
// In financial/actions.ts
export async function calculateAndStoreInvoiceAmount(
  intakeRecordId: string
): Promise<{ estimated_invoice_amount_eur: string; transport_cost_eur: string }> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    // 1. Get intake lines with actual quantities
    const lines = await tx
      .select({
        product_id: intakeLines.product_id,
        actual_quantity: intakeLines.actual_quantity,
      })
      .from(intakeLines)
      .where(eq(intakeLines.intake_record_id, intakeRecordId))

    // 2. Get current pricing for each product (effective_to IS NULL = current)
    // FIN-02: use pricing active at time of delivery
    let productTotal = new Decimal('0')
    for (const line of lines) {
      const [pricing] = await tx
        .select({ price_eur: productPricing.price_eur })
        .from(productPricing)
        .where(and(
          eq(productPricing.product_id, line.product_id),
          isNull(productPricing.effective_to)
        ))
        .limit(1)
      if (pricing?.price_eur) {
        productTotal = productTotal.plus(
          new Decimal(pricing.price_eur).times(line.actual_quantity)
        )
      }
    }

    // 3. Get transport costs (two-leg model from Phase 4)
    const intakeRecord = await tx
      .select({
        pickup_id: intakeRecords.pickup_id,
        outbound_shipment_id: intakeRecords.outbound_shipment_id,
      })
      .from(intakeRecords)
      .where(eq(intakeRecords.id, intakeRecordId))
      .limit(1)

    // Leg 1: market → destination (on transport_bookings)
    // Leg 2: allocated pro-rata cost from outbound_shipment_pickups
    // Assembly logic joins through pickup_id
    ...
  })
}
```

**Decimal arithmetic:** Use the `decimal.js` or `dinero.js` library — BUT checking the codebase, there are no financial calculation libraries installed. The existing pattern uses Drizzle `numeric` type returned as strings and `parseFloat()` / `toFixed(4)`. The `calculateProRataAllocation` function in Phase 4 uses plain string arithmetic with `toFixed(4)`. Follow the same approach: convert to `number`, compute, output with `toFixed(4)`. This avoids float precision issues for the quantities and prices involved (not high-frequency trading).

### Pattern 4: Two-Leg Transport Cost Assembly

The two-leg model (Phase 4, TRANS-07) stores costs as follows:

| Cost component | Table | Column | When present |
|----------------|-------|--------|-------------|
| Leg 1 (market → destination/warehouse) | `transport_bookings` | `transport_cost_market_to_destination_eur` | Always (direct + consolidation) |
| Leg 2 (warehouse → prison, pro-rata share) | `outbound_shipment_pickups` | `allocated_cost_eur` | Consolidation only |

Assembly query for a given intake_record:
```typescript
// intake_record → pickup_id → transport_bookings (leg 1)
// intake_record → pickup_id → outbound_shipment_pickups (leg 2)
const [booking] = await tx
  .select({
    leg1: transportBookings.transport_cost_market_to_destination_eur,
  })
  .from(transportBookings)
  .where(eq(transportBookings.pickup_id, intakeRecord.pickup_id))
  .limit(1)

const [allocation] = await tx
  .select({ leg2: outboundShipmentPickups.allocated_cost_eur })
  .from(outboundShipmentPickups)
  .where(eq(outboundShipmentPickups.pickup_id, intakeRecord.pickup_id))
  .limit(1)

const transportCost = (parseFloat(booking?.leg1 ?? '0') +
  parseFloat(allocation?.leg2 ?? '0')).toFixed(4)
```

**Edge case:** Unexpected deliveries (`is_unexpected = true`) have `pickup_id = null`. For these, transport cost = '0.0000'. The financial record is still created (FIN-01 says "each delivered intake record").

### Pattern 5: Currency Display Toggle

FIN-05: exchange rate applied at display time only. The system-level rate lives in `system_settings.exchange_rate_eur_dkk` (already implemented). User preference (EUR vs DKK) is stored as a cookie — no new table required. This matches the "applied at display time only" principle already described in the settings form description text.

```typescript
// Cookie name: 'display_currency' — value: 'EUR' | 'DKK'
// Set via a Server Action or route handler, read in Server Components

export function formatCurrency(
  amountEur: string | null,
  currency: 'EUR' | 'DKK',
  exchangeRate: string
): string {
  if (!amountEur) return '—'
  const eur = parseFloat(amountEur)
  if (currency === 'DKK') {
    const dkk = eur * parseFloat(exchangeRate)
    return `${dkk.toFixed(2)} DKK`
  }
  return `€${eur.toFixed(2)}`
}
```

**Alternative considered:** Storing preference in `users` table column. Rejected — requires migration and RLS-scoped update. Cookie approach is zero-schema, immediately available on all pages, and consistent with the "display only" principle.

### Pattern 6: Uninvoiced Delivery Alert (FIN-04)

14-day threshold uses `system_settings.warehouse_ageing_threshold_days` — same field, same meaning. The alert query:

```typescript
// Count of not_invoiced deliveries older than 14 days
const alerts = await tx
  .select({ count: count(), total_eur: sum(financialRecords.estimated_invoice_amount_eur) })
  .from(financialRecords)
  .innerJoin(intakeRecords, eq(intakeRecords.id, financialRecords.intake_record_id))
  .where(and(
    eq(financialRecords.invoice_status, 'not_invoiced'),
    lt(intakeRecords.delivered_at, sql`NOW() - INTERVAL '${threshold} days'`),
    eq(intakeRecords.voided, false)
  ))
```

**Monthly revenue estimate:** Filter WHERE `created_at >= date_trunc('month', NOW())` and SUM `estimated_invoice_amount_eur` for all `not_invoiced` records. This is an estimate of revenue not yet invoiced this month.

### Pattern 7: Invoice Edit Form

Follows the exact pattern of `GeneralSettingsForm`: Client Component with `react-hook-form`, zod validation, `toast.success` on save, `formState.isDirty` guard on submit button.

```typescript
// apps/web/app/(ops)/financial/components/invoice-edit-form.tsx
'use client'
// Fields: invoice_status (Select), invoice_number (Input), invoice_date (Input type=date), notes (Textarea)
// On submit: calls updateInvoiceFields(id, values) Server Action
// Audit trail: updateInvoiceFields calls audit_log trigger automatically (Phase 6 pattern)
```

### Pattern 8: Role-Gated Page Access

The financial route uses `requireAuth(['reco-admin', 'reco'])` then checks `can_view_financials` for the `reco` role:

```typescript
// apps/web/app/(ops)/financial/page.tsx
const auth = await requireAuth(['reco-admin', 'reco'])
if (auth.user.role === 'reco' && !auth.user.can_view_financials) {
  redirect('/dashboard') // or notFound()
}
```

**Note:** RLS on `financial_records` already blocks `reco` without `can_view_financials` at the DB layer. The app-layer check provides a better UX (redirect vs. empty table or DB error).

### Recommended Project Structure (detailed)

```
packages/db/src/schema/
├── financial.ts           # NEW: financial_records, invoiceStatusEnum

packages/db/migrations/
├── 0005_financial.sql     # NEW: migration number TBD by drizzle-kit

apps/web/app/(ops)/
├── ops-nav-bar.tsx        # ADD: 'Financial' nav item
└── financial/
    ├── page.tsx           # Financial records list
    ├── actions.ts         # All Server Actions + pure functions
    ├── actions.test.ts    # Vitest tests
    └── components/
        ├── invoice-edit-form.tsx
        ├── uninvoiced-alert.tsx
        └── currency-toggle.tsx
```

### Anti-Patterns to Avoid

- **Storing exchange-rate-converted amounts:** FIN-05 is explicit — only EUR stored, DKK computed at display. Never write `amount_dkk` to the DB.
- **Calculating invoice amount inside the DB trigger:** The trigger cannot access `product_pricing` with RLS — it runs as SECURITY DEFINER (no JWT claims). Calculate in the Server Action after trigger fires.
- **Re-querying exchange rate per row in a list:** Fetch system_settings once and pass it to the formatting function for the full list render.
- **Using `effective_from`/`effective_to` date-range filter for FIN-02:** The requirement says "current" pricing (`effective_to = null`), not point-in-time historical. The historical snapshot interpretation is for ESG calculations (PROD-05), not invoice estimation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit trail for invoice edits | Custom logging | Existing `audit_log_trigger` (Phase 6) fires automatically on any UPDATE to `financial_records` | Trigger is generic — covers all tables |
| Role access checking | Custom middleware | `requireAuth()` + existing RLS policies | Established pattern, defence-in-depth |
| Form validation | Manual if/else | zod + react-hook-form | Already installed, consistent with all prior forms |
| Toast feedback | Custom notification | `sonner` toast | Already installed |
| Decimal formatting | Custom `toFixed` wrapper | Inline `parseFloat(x).toFixed(2)` matching existing `calculateProRataAllocation` pattern | Consistent, no new dependency |

---

## Common Pitfalls

### Pitfall 1: Missing Financial Record for Unexpected Deliveries
**What goes wrong:** The trigger auto-creates financial records on intake insert. Unexpected deliveries (`is_unexpected = true`) have `pickup_id = null`, so transport cost lookup returns no rows. If the calculation crashes on null, the financial record stays incomplete.
**Why it happens:** The transport cost join assumes `pickup_id` is present.
**How to avoid:** Guard all transport cost queries with `if (intakeRecord.pickup_id)` — default to `'0.0000'` for unexpected deliveries.
**Warning signs:** Financial records with `transport_cost_eur = null` for unexpected intakes.

### Pitfall 2: Double Financial Records on Historical Import
**What goes wrong:** Phase 10 will import historical intake records. If the trigger fires on import, it creates financial records for all imported rows. If Phase 10 later tries to insert financial records from the import CSV, it hits the unique constraint.
**Why it happens:** `ON CONFLICT DO NOTHING` in the trigger handles this correctly — document it explicitly so Phase 10 is aware.
**How to avoid:** The `ON CONFLICT (intake_record_id) DO NOTHING` in the trigger is the correct guard. Phase 10 must be informed not to try to insert financial records for intakes that already have them.

### Pitfall 3: RLS Blocks reco Role from Calculating Invoice Amount
**What goes wrong:** `calculateAndStoreInvoiceAmount` needs to read `product_pricing`. The `reco` role has SELECT on `product_pricing`. But `financial_records_reco_read` requires `can_view_financials = true`. A `reco` user without this flag can read pricing but cannot write the result to `financial_records`.
**Why it happens:** The write path for financial records is reco-admin only.
**How to avoid:** `calculateAndStoreInvoiceAmount` is called only by reco-admin. The function uses `requireRecoAdmin()` guard, not `requireAuth(['reco-admin', 'reco'])`.

### Pitfall 4: product_pricing Rows Missing (product has no current pricing)
**What goes wrong:** A product has historical pricing records but no `effective_to = null` record (pricing expired, no current record set). The calculation returns `0` for that product line silently.
**Why it happens:** Historical imports or admin errors can leave products with no active pricing.
**How to avoid:** In the calculation result, return a `missing_pricing: string[]` list of product IDs that had no current pricing. Display a warning in the financial record detail UI.

### Pitfall 5: voided Intake Records Creating Alert Noise
**What goes wrong:** Voided intake records still have financial records. If not filtered, they appear in the uninvoiced alert count with potentially large amounts.
**Why it happens:** `voided` is on `intake_records`, not on `financial_records`. The alert query joins both tables.
**How to avoid:** Always JOIN `intake_records` in uninvoiced alert queries and filter `WHERE intake_records.voided = false`.

### Pitfall 6: Nav Item Missing
**What goes wrong:** The `financial/` route is built but not reachable — `OpsNavBar` has a hardcoded list and 'Financial' is not in it.
**Why it happens:** Happened with 'Dispatch' in Phase 6 — plan explicitly added the nav item.
**How to avoid:** Plan must include a task to add 'Financial' to `NAV_ITEMS` in `ops-nav-bar.tsx`.

---

## Code Examples

### Verified Pattern: withRLSContext query structure
```typescript
// Source: apps/web/app/(ops)/dispatch/actions.ts (Phase 6)
return withRLSContext(user, async (tx) => {
  const rows = await tx
    .select({ id: table.id, status: table.status })
    .from(table)
    .where(and(eq(table.tenant_id, tenantId), eq(table.voided, false)))
  return rows
})
```

### Verified Pattern: Effective-dated pricing query (current record)
```typescript
// Source: packages/db/src/schema/products.ts
// effective_to: null means current (PROD-04)
// Query pattern — use isNull() from drizzle-orm
const [pricing] = await tx
  .select({ price_eur: productPricing.price_eur })
  .from(productPricing)
  .where(and(
    eq(productPricing.product_id, productId),
    isNull(productPricing.effective_to)
  ))
  .limit(1)
```

### Verified Pattern: Numeric toFixed(4) for DB insert
```typescript
// Source: apps/web/app/(ops)/transport/outbound/actions.ts (calculateProRataAllocation)
const totalCost = parseFloat(totalCostEur)
const totalPallets = allocations.reduce((sum, a) => sum + a.palletCount, 0)
const result = allocations.map((a) => ({
  pickupId: a.pickupId,
  allocatedCostEur: ((totalCost * a.palletCount) / totalPallets).toFixed(4),
}))
```

### Verified Pattern: Singleton settings read
```typescript
// Source: apps/web/app/(ops)/settings/actions.ts pattern
// system_settings is a singleton (id=1, enforced by CHECK constraint)
const [settings] = await db.select().from(systemSettings).limit(1)
const threshold = settings?.warehouse_ageing_threshold_days ?? 14
```

### Verified Pattern: requireRecoAdmin guard
```typescript
// Source: apps/web/app/(ops)/dispatch/actions.ts
async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  return { ...session.user, sub: session.user.id! }
}
```

### Verified Pattern: Role-gated page with requireAuth
```typescript
// Source: apps/web/app/(ops)/intake/[id]/page.tsx
const auth = await requireAuth(['reco-admin', 'reco'])
// Then check sub-role:
if (auth.user.role === 'reco' && !auth.user.can_view_financials) {
  redirect('/dashboard')
}
```

### Verified Pattern: DB trigger SECURITY DEFINER (Phase 6)
```sql
-- Source: packages/db/migrations (audit_log_trigger pattern)
CREATE OR REPLACE FUNCTION my_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO target_table (...) VALUES (...);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing across all phases) |
| Config file | apps/web/vitest.config.ts (inferred from existing test files) |
| Quick run command | `pnpm vitest run apps/web/app/(ops)/financial/actions.test.ts` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIN-01 | Financial record created on intake insert | unit (pure function) | `pnpm vitest run apps/web/app/(ops)/financial/actions.test.ts` | Wave 0 |
| FIN-02 | Invoice amount uses current pricing (effective_to=null) | unit | same | Wave 0 |
| FIN-03 | updateInvoiceFields rejects non-reco-admin | unit | same | Wave 0 |
| FIN-04 | getUninvoicedAlerts returns records > threshold days | unit | same | Wave 0 |
| FIN-05 | formatCurrency converts EUR→DKK with exchange rate | unit (pure) | `pnpm vitest run apps/web/app/(ops)/financial/actions.test.ts` | Wave 0 |
| FIN-06 | reco without can_view_financials gets redirect | manual smoke | manual browse | — |

### Sampling Rate
- **Per task commit:** `pnpm vitest run apps/web/app/(ops)/financial/actions.test.ts`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/app/(ops)/financial/actions.test.ts` — covers FIN-01, FIN-02, FIN-03, FIN-04, FIN-05

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store amounts in multiple currencies | Store EUR only, compute DKK at display | Phase 1 (SETTINGS-01) | No migration needed |
| Invoice generation in platform | Out of scope — use accounting software | PRD definition | Do not build PDF invoices |

**Out of scope (confirmed by requirements):**
- Invoice generation (PDF): "use accounting software"
- Payment processing: not in scope
- Tax/VAT calculations: not in scope

---

## Open Questions

1. **Decimal precision for invoice totals**
   - What we know: existing codebase uses `toFixed(4)` for transport costs stored as `numeric(12,4)`
   - What's unclear: should the invoice total use 2 decimal places (money display) or 4 (storage precision)?
   - Recommendation: Store as `numeric(12,4)` (4 decimal places) for consistency; display with 2 decimal places. Matches existing pattern.

2. **Historical intakes with no transport bookings**
   - What we know: unexpected deliveries have null pickup_id; some imported historical intakes (Phase 10) may also lack transport bookings
   - What's unclear: should `transport_cost_eur = NULL` (unknown) or `'0.0000'` (zero) for these?
   - Recommendation: Use `NULL` to distinguish "not calculated" from "genuinely zero cost". The UI displays `—` for NULL amounts.

3. **When to recalculate invoice amount**
   - What we know: FIN-02 says "at time of delivery" but pricing can change after intake
   - What's unclear: should reco-admin be able to trigger recalculation?
   - Recommendation: Auto-calculate on financial record creation only. Add a "Recalculate" button in the invoice edit UI for reco-admin, which re-runs `calculateAndStoreInvoiceAmount`. Document that the stored amount reflects pricing at time of last calculation.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `packages/db/src/schema/*.ts` — verified all existing table structures, RLS patterns, and enum definitions
- Direct codebase inspection — `apps/web/app/(ops)/dispatch/actions.ts` — verified requireRecoAdmin pattern
- Direct codebase inspection — `apps/web/app/(ops)/transport/outbound/actions.ts` — verified calculateProRataAllocation toFixed(4) pattern
- Direct codebase inspection — `apps/web/app/(ops)/settings/general-settings-form.tsx` — verified exchange rate display-only pattern
- Direct codebase inspection — `packages/db/migrations/0004_tense_chronomancer.sql` — verified trigger pattern for intake records

### Secondary (MEDIUM confidence)
- Requirements document — `.planning/REQUIREMENTS.md` — FIN-01 through FIN-06 requirements text
- Project STATE.md — established decisions about two-leg cost model, RLS patterns, withRLSContext usage

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, verified in codebase
- Architecture: HIGH — direct inspection of prior-phase patterns, no speculation
- Schema design: HIGH — follows established Drizzle pgTable + pgPolicy patterns exactly
- Invoice calculation logic: MEDIUM — logic derived from requirements + existing pricing schema; no prior implementation to reference
- Pitfalls: HIGH — derived from actual prior-phase decisions in STATE.md

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack — dependencies unlikely to change)
