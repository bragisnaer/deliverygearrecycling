# Phase 5: Prison Intake and Counting - Research

**Researched:** 2026-03-20
**Domain:** Prison tablet UX, intake schema design, discrepancy detection, batch quarantine, Danish i18n, Drizzle/RLS for prison role
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Intake Form Layout and Navigation**
- Prison home screen shows a prominent "Register Incoming Delivery" primary action button → tap to see expected deliveries list → tap a delivery to open the pre-populated intake form (2 taps maximum)
- Product quantity inputs use large + / − spinner buttons with the current quantity displayed in the centre — tablet-friendly, reduces mis-taps on shared facility tablets
- Discrepancy warnings shown inline (yellow highlight per product row) but do NOT block submission; prison staff can submit; reco-admin is notified automatically. Only confirmed quarantine (batch flag match) blocks submission
- After successful intake submission: success confirmation screen showing client, market, products counted, and reference number; "Register Another Delivery" and "Back to Home" buttons

**Expected vs Unexpected Delivery UX**
- Expected deliveries displayed as a card grid — each card shows client name, origin market, expected date, and reference number; tapping opens the pre-populated intake form
- "Expected: X" shown beside each quantity input; when staff changes a value, a badge shows the difference (e.g. "−3 from expected") — visible before submit
- Consolidated shipments shown as collapsible outbound shipment card (showing shipment reference) with nested per-pickup intake forms inside
- History tab on the prison home screen shows the facility's past intake records for the last 30 days with search

**Discrepancy and Quarantine Handling**
- Discrepancy warnings: inline yellow warning per product row — "Expected 100, you entered 130 (+30%)" — visible before submit, not just after
- Only confirmed batch flag quarantine blocks submission; discrepancy warnings are non-blocking (submission proceeds, reco-admin notified)
- Quarantine override: "Quarantine Queue" section in the ops portal intake area — admin reviews blocked intake records and clicks "Override and Allow" with a required reason note
- Unexpected delivery alerts surfaced via in-app notification bell in ops portal + badge on intake queue table; email notifications for unexpected deliveries deferred to Phase 9

**Discrepancy Dashboard**
- Three-tab layout: By Country, By Product, By Facility — each showing discrepancy rate % with trend arrow over time
- Auto-flag persistent problem market: discrepancy rate >15% in ≥3 of the last 6 months — shown as persistent flag badge on the country row
- Visible to reco-admin and reco roles only (no financial toggle required); not visible to transport providers

### Claude's Discretion
- Exact Danish translation strings for form labels and instructions
- Specific shadcn component selection for spinner inputs (may require custom wrapper around shadcn Input)
- Database trigger vs application-level discrepancy_flagged calculation approach
- RLS policy details for prison role (locked to prison_facility_id from JWT)
- Persistent problem market auto-flag implementation (DB view vs computed column vs application-level)

### Deferred Ideas (OUT OF SCOPE)
- Email notifications for unexpected deliveries — deferred to Phase 9 (Notifications and Manuals)
- Configurable persistent problem market threshold in system settings — hardcoded rule (>15% in 3 of 6 months) sufficient for Phase 5; can be made configurable in a future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTAKE-01 | Prison staff access intake forms at `ops.courierrecycling.com/prison` via facility-pre-authenticated session; facility context locked from login | Prison login already exists (Phase 2); `prison_facility_id` in JWT; RLS pattern verified in schema |
| INTAKE-02 | Incoming deliveries view: direct deliveries (single line), consolidated deliveries (per-pickup forms grouped under outbound shipment reference) | `outbound_shipments` + `outbound_shipment_pickups` + `transport_bookings` schema fully available; grouping pattern established |
| INTAKE-03 | Intake form fields: staff name, client, origin market, delivery date, quantities per product, batch/lot numbers, photos, notes | New `intake_records` + `intake_lines` tables required; product list from `products` table; batch/lot captured per line |
| INTAKE-04 | Expected deliveries: client, origin market, product list pre-populated from pickup request; staff confirms/adjusts quantities | Join `pickups` → `pickup_lines` → `products`; `informed_quantity` from `pickup_lines.quantity`; pre-population at page render |
| INTAKE-05 | Unexpected deliveries: staff selects client from dropdown, enters all details manually; reco-admin alert | Client list from `tenants`; notification insert to `notifications` table with type `unexpected_delivery` |
| INTAKE-06 | System auto-compares actual vs informed quantities; if any line exceeds configurable threshold, `discrepancy_flagged` set and reco-admin notified | `system_settings.discrepancy_alert_threshold_pct` already in DB (default 15); application-level comparison in Server Action on submit |
| INTAKE-07 | Batch/lot numbers checked against `batch_flags` table; if match, `quarantine_flagged` set; both parties notified; reco-admin override required | New `batch_flags` table required; override stored on `intake_records`; override reason field |
| INTAKE-08 | Discrepancy dashboard: rate by country, product, facility, over time; persistent problem markets auto-flagged | Aggregation query over `intake_records` + `intake_lines` + `pickup_lines`; persistent flag computed in application layer |
</phase_requirements>

---

## Summary

Phase 5 builds on a fully operational schema from Phases 1–4. The prison role, JWT claims, RLS pattern, facility registry, product registry, pickup records with line items, outbound shipments, and the notification table are all already in place. The primary new work is schema (intake_records, intake_lines, batch_flags tables), a tablet-first prison shell in Danish, Server Actions for intake submission with discrepancy detection and quarantine logic, an ops portal intake queue, and a discrepancy analytics dashboard.

The most technically complex areas are: (1) the discrepancy detection logic — read `discrepancy_alert_threshold_pct` from `system_settings` at submit time and compare per product line; (2) the quarantine override flow — blocked intake records need an override field and a reco-admin action; (3) the discrepancy dashboard aggregation — rolling 6-month window with per-facility, per-product, per-country grouping. All three are application-level logic over existing DB infrastructure, not new infrastructure.

Danish i18n is new to this project. `next-intl` is not yet installed. The prison tablet shell needs a messages file (`messages/da.json`) and a locale routing setup scoped only to the `/prison/` route segment. The simplest approach given the project's structure is a lightweight next-intl setup restricted to the prison routes, without full App Router i18n routing (which would require restructuring the existing route groups).

**Primary recommendation:** Implement discrepancy detection and quarantine in the Server Action at submit time (application-level, not DB trigger) — this is simpler to test, easier to read `system_settings` in context, and consistent with the project's withRLSContext pattern. Use application-level aggregation for the discrepancy dashboard (SQL window functions over intake data), not a materialised view, to avoid migration complexity.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-intl | ^3.26.3 (current as of 2026-03) | Danish i18n for prison tablet UI | Only i18n library in the Next.js App Router ecosystem with first-class server component support |
| drizzle-orm | ^0.45.1 (already installed) | Schema definition, RLS, queries | Project standard — all prior phases use it |
| zod | ^3.24.1 (already installed) | Server Action input validation | Project standard |
| react-hook-form | ^7.54.0 (already installed) | Prison tablet intake form | Project standard; RHF + zod resolver pattern established |
| shadcn/ui | (already installed) | UI components | Project standard; select + skeleton + alert new installs this phase |
| @base-ui/react | ^1.3.0 (already installed) | Collapsible consolidated shipment card (Accordion/details) | Already used for dialogs and combobox in prior phases |
| lucide-react | ^0.469.0 (already installed) | Plus/Minus icons for spinner, TrendingUp/Down for dashboard | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^1.7.4 (already installed) | Toast notifications on successful submission | Project standard for non-blocking feedback |
| resend | ^6.9.4 (already installed) | Email alerts for discrepancy/quarantine (INTAKE-06, INTAKE-07) | Already wired in Phase 4 for pickup notifications |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-intl | react-i18next | react-i18next has no server component support; next-intl is purpose-built for App Router |
| Application-level discrepancy calc | DB trigger | DB trigger cannot read `system_settings.discrepancy_alert_threshold_pct` cleanly in a trigger context; application-level is simpler to test and maintain |
| Application-level persistent flag | PostgreSQL materialised view | Materialised view requires refresh job; application-level SQL aggregation with window function is simpler and sufficient for v1 data volumes |

**Installation (new packages only):**
```bash
pnpm --filter @repo/web add next-intl
pnpm --filter @repo/web add shadcn # already installed; run add commands:
# npx shadcn add select skeleton alert
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── prison/                        # Prison tablet shell (no ops sidebar)
│   │   ├── layout.tsx                 # Facility-pre-auth gate + tablet shell layout
│   │   ├── page.tsx                   # Home: "Registrer Levering" + History tab
│   │   ├── incoming/
│   │   │   └── page.tsx              # Expected deliveries card grid
│   │   ├── intake/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx          # Pre-populated intake form (expected flow)
│   │   │   │   └── success/
│   │   │   │       └── page.tsx      # Post-submit confirmation screen
│   │   │   └── new/
│   │   │       └── page.tsx          # Manual intake form (unexpected flow)
│   │   └── actions.ts                # Prison Server Actions (submitIntake, etc.)
│   └── (ops)/
│       └── intake/
│           ├── page.tsx              # Intake queue (All / Discrepancy / Quarantine / Unexpected tabs)
│           ├── actions.ts            # Ops intake actions (overrideQuarantine, etc.)
│           └── discrepancy/
│               └── page.tsx          # Discrepancy dashboard (By Country / By Product / By Facility)
├── messages/
│   └── da.json                       # Danish strings for prison tablet
└── i18n/
    └── request.ts                    # next-intl server config (getRequestConfig)

packages/db/src/schema/
└── intake.ts                         # New: intake_records, intake_lines, batch_flags
```

### Pattern 1: Prison Role Server Action with withRLSContext

The prison role is locked to `prison_facility_id` in JWT. Server Actions in `apps/web/app/prison/actions.ts` use `auth()` to get the session and build JWTClaims with `facility_id` for the RLS context.

```typescript
// Source: established pattern from Phase 4 pickups/actions.ts
async function requirePrisonSession() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'prison') {
    throw new Error('Unauthorized: prison role required')
  }
  return {
    ...session.user,
    sub: session.user.id!,
    // facility_id already in session from Custom Access Token Hook (Phase 2)
  }
}

export async function submitIntake(formData: FormData) {
  const user = await requirePrisonSession()
  // All DB ops via withRLSContext(user, ...) — prison_role RLS enforces facility isolation
}
```

### Pattern 2: Discrepancy Detection at Submit Time

Application-level comparison in the Server Action, reading threshold from `system_settings`:

```typescript
// Source: project pattern — application-level business logic in Server Actions
const [settings] = await withRLSContext(user, (tx) =>
  tx.select({ threshold: systemSettings.discrepancy_alert_threshold_pct })
    .from(systemSettings)
    .where(eq(systemSettings.id, 1))
    .limit(1)
)
const threshold = settings?.threshold ?? 15

const discrepancyLines = intakeLines.filter((line) => {
  if (!line.informed_quantity) return false
  const pct = Math.abs((line.actual_quantity - line.informed_quantity) / line.informed_quantity) * 100
  return pct > threshold
})
const discrepancyFlagged = discrepancyLines.length > 0
```

### Pattern 3: Intake Schema with Batch Quarantine

New tables in `packages/db/src/schema/intake.ts`:

```typescript
// Source: established Drizzle schema pattern (pickups.ts, transport.ts)

export const intakeRecords = pgTable('intake_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  prison_facility_id: uuid('prison_facility_id').notNull()
    .references(() => prisonFacilities.id),
  pickup_id: uuid('pickup_id')              // nullable — null for unexpected deliveries
    .references(() => pickups.id),
  outbound_shipment_id: uuid('outbound_shipment_id')  // nullable — set for consolidation
    .references(() => outboundShipments.id),
  tenant_id: text('tenant_id').notNull()    // for RLS + Phase 7 financial linking
    .references(() => tenants.id),
  staff_name: text('staff_name').notNull(),
  delivery_date: timestamp('delivery_date').notNull(),
  origin_market: text('origin_market'),     // nullable — free text country/market
  is_unexpected: boolean('is_unexpected').notNull().default(false),
  discrepancy_flagged: boolean('discrepancy_flagged').notNull().default(false),
  quarantine_flagged: boolean('quarantine_flagged').notNull().default(false),
  quarantine_overridden: boolean('quarantine_overridden').notNull().default(false),
  quarantine_override_reason: text('quarantine_override_reason'), // nullable
  quarantine_overridden_by: uuid('quarantine_overridden_by')
    .references(() => users.id),           // nullable
  quarantine_overridden_at: timestamp('quarantine_overridden_at'), // nullable
  notes: text('notes'),
  reference: text('reference').notNull().default(''), // IN-YYYY-NNNN via DB trigger
  delivered_at: timestamp('delivered_at').notNull().defaultNow(), // for Phase 7
  submitted_by: uuid('submitted_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, ...)

export const intakeLines = pgTable('intake_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  intake_record_id: uuid('intake_record_id').notNull()
    .references(() => intakeRecords.id, { onDelete: 'cascade' }),
  product_id: uuid('product_id').notNull().references(() => products.id),
  informed_quantity: integer('informed_quantity'), // nullable — from pickup_lines; null for unexpected
  actual_quantity: integer('actual_quantity').notNull(),
  batch_lot_number: text('batch_lot_number'),       // nullable — optional per INTAKE-03
  discrepancy_pct: numeric('discrepancy_pct', { precision: 8, scale: 2 }), // nullable
  quarantine_flagged: boolean('quarantine_flagged').notNull().default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, ...)

export const batchFlags = pgTable('batch_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  batch_lot_number: text('batch_lot_number').notNull().unique(),
  reason: text('reason').notNull(),
  flagged_by: uuid('flagged_by').references(() => users.id),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, ...)
```

### Pattern 4: next-intl Minimal Setup (Prison Routes Only)

No full App Router locale routing needed. next-intl supports a "without i18n routing" setup that is simpler — use `NextIntlClientProvider` in the prison layout with a static `da` locale.

```typescript
// Source: next-intl docs — "use without i18n routing" pattern
// apps/web/i18n/request.ts
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async () => {
  return {
    locale: 'da',
    messages: (await import('../messages/da.json')).default,
  }
})

// apps/web/app/prison/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function PrisonLayout({ children }) {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider locale="da" messages={messages}>
      {/* tablet shell */}
      {children}
    </NextIntlClientProvider>
  )
}
```

**next.config.ts update required:**
```typescript
import createNextIntlPlugin from 'next-intl/plugin'
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')
export default withNextIntl(nextConfig)
```

### Pattern 5: Discrepancy Dashboard Aggregation (SQL)

Application-level SQL via Drizzle for the dashboard tabs. No materialised view. Rolling 6-month window uses `date_trunc` + `generate_series` pattern.

```typescript
// Source: standard PostgreSQL pattern; Drizzle sql`` template tag
import { sql } from 'drizzle-orm'

// By Country — example query structure
const byCountry = await withRLSContext(user, (tx) =>
  tx.execute(sql`
    SELECT
      ir.origin_market AS country,
      COUNT(*) AS total_deliveries,
      SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END) AS flagged_count,
      ROUND(
        100.0 * SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END) / COUNT(*),
        1
      ) AS discrepancy_rate_pct
    FROM intake_records ir
    WHERE ir.delivered_at >= NOW() - INTERVAL '6 months'
    GROUP BY ir.origin_market
    ORDER BY discrepancy_rate_pct DESC
  `)
)
```

**Persistent problem market flag (application-level):**
```typescript
// After fetching monthly discrepancy rates per country:
// Count months where rate > threshold; flag if count >= 3 of last 6 months
const persistentFlag = monthlyRates.filter(m => m.rate > threshold).length >= 3
```

### Pattern 6: RLS for Prison Role

Prison role has `prison_facility_id` in JWT (as `facility_id` claim — confirmed in `auth.ts` users schema and `tenants.ts` prison_facilities policy). RLS on intake tables uses this claim:

```typescript
// Source: established pattern from tenants.ts prison_facilities_prison_read policy
pgPolicy('intake_records_prison_read_insert', {
  as: 'permissive',
  to: prisonRole,
  for: 'select',
  using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
}),
pgPolicy('intake_records_prison_insert', {
  as: 'permissive',
  to: prisonRole,
  for: 'insert',
  withCheck: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
}),
```

`intake_lines` and `batch_flags` (read-only for prison) follow the EXISTS subquery pattern established in `pickup_lines` (tenant isolation via parent table).

### Anti-Patterns to Avoid

- **Building a spinner from scratch with raw HTML:** Use a custom wrapper around `shadcn Input` with `lucide Plus/Minus` buttons — keeps it in the established component vocabulary and accessible (aria-label on buttons, aria-live on the quantity display).
- **DB trigger for discrepancy_flagged:** Cannot reliably read `system_settings` within a trigger. Use application-level check in Server Action where `system_settings` can be queried in context.
- **Full App Router i18n routing for Danish:** Restructuring all routes under `/[locale]/` is destructive to the existing route groups. Use next-intl without routing, scoped to the prison layout only.
- **prison_role reading intake_lines via tenant_id:** `intake_lines` has no direct tenant_id. Use EXISTS subquery on parent `intake_records.prison_facility_id` — same pattern as `pickup_lines` using parent `pickups.tenant_id`.
- **Storing discrepancy_pct as integer:** Use `numeric(8,2)` — discrepancy can be fractional (e.g. 16.67%). Integer truncation loses precision for dashboard aggregations.
- **Quarantine blocking at DB level:** Quarantine block must be enforced in the Server Action (check `batch_flags` before insert), not via a DB constraint — override flow requires conditional bypass, which is cleaner at application level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Danish i18n string management | Custom string map / React context | next-intl | Type-safe keys, server component support, proper pluralisation, ICU message format |
| Quantity spinner input | Pure `<input type="number">` | Custom wrapper: shadcn Input + lucide Plus/Minus buttons | Native number input has poor mobile/tablet UX; spinner pattern with 44px touch targets is required |
| Discrepancy % calculation | Inline math per component | Pure function `calculateDiscrepancyPct(actual, informed)` exported from a lib file | Needs to run both client-side (live row highlighting) and server-side (flagging at submit); pure function enables both |
| Notification insert | Direct DB write in Server Action body | Shared `createNotification()` helper (already used in Phase 4) | Consistent notification structure; non-blocking (try/catch wrapper) |
| Persistent problem market badge | Separate dashboard query | Application-level filter over the monthly aggregation already fetched | Avoids a second query; computed in the same pass as the monthly rate data |

---

## Common Pitfalls

### Pitfall 1: Prison Role Cannot Read intake_lines via Direct Policy

**What goes wrong:** Adding `prison_facility_id` to `intake_lines` so RLS can filter it directly — creates schema redundancy and drift from the established pattern.

**Why it happens:** The prison role needs to read its own intake lines but `intake_lines` has no facility column.

**How to avoid:** Use an EXISTS subquery policy: `EXISTS (SELECT 1 FROM intake_records ir WHERE ir.id = intake_lines.intake_record_id AND ir.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true))` — identical to the `pickup_lines_client_read` pattern.

**Warning signs:** If you find yourself adding `prison_facility_id` to `intake_lines`, stop — use EXISTS instead.

### Pitfall 2: withRLSContext Used with Prison Session Returns Wrong Claims Shape

**What goes wrong:** `withRLSContext` requires a `JWTClaims` object that includes `sub`. The prison session stores `facility_id` on `session.user` (from the Custom Access Token Hook) but the field is called `facility_id`, not `prison_facility_id`.

**Why it happens:** `users.facility_id` column name (auth.ts) differs from `prison_facilities.id` (the FK value). The JWT claim injected by the Custom Access Token Hook is `facility_id` (from Phase 2).

**How to avoid:** In `requirePrisonSession()`, build the claims object with `facility_id: session.user.facility_id` — NOT `prison_facility_id`. The RLS policy uses `current_setting('request.jwt.claim.facility_id', true)`.

**Warning signs:** RLS returning empty results for prison role despite correct facility_id in JWT.

### Pitfall 3: next-intl useTranslations Called in Server Component Without Provider

**What goes wrong:** Server components under `/prison/` try to call `useTranslations()` (client-only hook) or `getTranslations()` without the `getRequestConfig` wired in `next.config.ts`.

**Why it happens:** next-intl requires the plugin wrapper in `next.config.ts` to inject the request config. Without it, `getMessages()` returns undefined.

**How to avoid:** Add `createNextIntlPlugin('./i18n/request.ts')` to `next.config.ts` before any prison pages use translations. Add this in Plan 05-02 (tablet shell) before any translated strings are rendered.

**Warning signs:** `Error: No intl messages found` or `getMessages() returned undefined`.

### Pitfall 4: Quarantine Block Not Enforced Server-Side

**What goes wrong:** Quarantine block is enforced only client-side (submit button disabled) but the Server Action does not re-check `batch_flags` before inserting.

**Why it happens:** Client-side state can be manipulated; the submit button state is cosmetic only.

**How to avoid:** Server Action must query `batch_flags` for each `batch_lot_number` in the intake lines before inserting. If any match and no override is present, return `{ error: 'quarantine_blocked' }`. Defence-in-depth, consistent with the AUTH-10 and RLS fail-closed philosophy in this project.

**Warning signs:** Missing a batch_flags check in `submitIntake()`.

### Pitfall 5: Discrepancy Dashboard N+1 Query

**What goes wrong:** Fetching discrepancy rates with one query per country/product/facility row.

**Why it happens:** Natural instinct when adapting the per-pickup detail pattern.

**How to avoid:** Use a single aggregate SQL query per tab (GROUP BY) — the Drizzle `sql` template tag supports raw SQL for complex aggregations. Fetch one result set per tab, not one query per row.

**Warning signs:** Loading the dashboard tab triggers dozens of DB round-trips.

### Pitfall 6: intake_records Reference Number Generation

**What goes wrong:** Forgetting that the `reference` column (e.g. `IN-2026-0001`) needs a DB trigger, identical to the `PU-YYYY-NNNN` trigger on pickups.

**Why it happens:** The `reference` column is added with `.default('')` just like `pickups.reference`, but the trigger is in a manual migration SQL file, not in Drizzle schema — easy to miss in the plan.

**How to avoid:** Plan 05-01 (intake schema) must include the manual migration SQL for the `IN-YYYY-NNNN` trigger, mirroring the pickup reference trigger from Phase 4 Plan 01.

**Warning signs:** All intake records showing reference `''` after submission.

### Pitfall 7: Auto-Dismiss Timer on Success Screen Blocked by Navigation

**What goes wrong:** `setTimeout(() => router.push('/prison'), 10000)` runs even if the user has already navigated away, causing a double-navigation or stale-state error.

**Why it happens:** React 19 `useEffect` cleanup is not applied to `setTimeout` unless explicitly cleared.

**How to avoid:** Store the timeout ref and clear it in the `useEffect` cleanup function. Use `useRouter` from `next/navigation` for the push — standard Next.js App Router pattern.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Intake Form: Quantity Spinner Component

```typescript
// Source: UI-SPEC.md component inventory + established shadcn Input pattern
'use client'
import { Minus, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface QuantitySpinnerProps {
  value: number
  onChange: (value: number) => void
  informedQty?: number
  threshold: number
}

export function QuantitySpinner({ value, onChange, informedQty, threshold }: QuantitySpinnerProps) {
  const discrepancyPct = informedQty
    ? Math.abs((value - informedQty) / informedQty) * 100
    : 0
  const hasDiscrepancy = informedQty !== undefined && discrepancyPct > threshold

  return (
    <div className={['rounded-md border p-3', hasDiscrepancy ? 'border-amber-200 bg-amber-50' : 'border-border'].join(' ')}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Reducer antal"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-border"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="w-16 text-center font-heading text-xl font-semibold">
          {value}
        </span>
        <button
          type="button"
          aria-label="Forøg antal"
          onClick={() => onChange(value + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-border"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {informedQty !== undefined && (
        <p className="mt-1 text-sm text-muted-foreground">
          Forventet: {informedQty}
          {hasDiscrepancy && (
            <span className="ml-2 text-amber-700" role="status">
              {value > informedQty ? `+${(value - informedQty)}` : `${(value - informedQty)}`} fra forventet
            </span>
          )}
        </p>
      )}
    </div>
  )
}
```

### Prison Session Helper (replicate requireRecoAdmin pattern)

```typescript
// Source: apps/web/app/(ops)/pickups/actions.ts — requireRecoAdmin pattern
async function requirePrisonSession() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'prison') {
    throw new Error('Unauthorized: prison role required')
  }
  return {
    ...session.user,
    sub: session.user.id!,
    // facility_id is on session.user from Custom Access Token Hook (Phase 2)
  }
}
```

### Batch Flag Lookup in submitIntake

```typescript
// Source: established withRLSContext pattern + new batch_flags table
const batchNumbers = intakeLines
  .map(l => l.batch_lot_number)
  .filter(Boolean) as string[]

let quarantineFlagged = false
if (batchNumbers.length > 0) {
  const flags = await withRLSContext(user, (tx) =>
    tx.select({ id: batchFlags.id, batch_lot_number: batchFlags.batch_lot_number })
      .from(batchFlags)
      .where(
        and(
          inArray(batchFlags.batch_lot_number, batchNumbers),
          eq(batchFlags.active, true)
        )
      )
  )
  quarantineFlagged = flags.length > 0
}

if (quarantineFlagged) {
  return { error: 'quarantine_blocked', flaggedBatches: flags.map(f => f.batch_lot_number) }
}
```

### Notification Insert for Unexpected Delivery

```typescript
// Source: notifications.ts schema + Phase 4 notification pattern
// Note: raw db used (not withRLSContext) when notifying reco-admin — same pattern as Phase 4
// (admin email query uses raw db because prison_role RLS cannot read reco-admin users cross-tenant)
await db.insert(notifications).values({
  type: 'unexpected_intake',
  title: 'Unexpected delivery registered',
  body: `Prison: ${facilityName}. Client: ${clientName}. Reference: ${intakeRef}`,
  entity_type: 'intake_record',
  entity_id: intakeRecordId,
}).catch(() => {}) // non-blocking — notification failure must not break intake submission
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router i18n (next.config `i18n`) | next-intl with App Router (no routing mode) | Next.js 13+ | Pages Router i18n not available in App Router; next-intl is the replacement |
| `format.js` / `react-intl` | next-intl | 2022–present | react-intl has no server component support |

**Deprecated/outdated:**
- `next/router` `locale` param: Not available in App Router. Use next-intl `getMessages()` / `useTranslations()` instead.
- `intl` config in `next.config.js`: Deprecated in App Router. Use next-intl plugin wrapper.

---

## Open Questions

1. **next-intl plugin compatibility with Next.js 16.2.0 + Turbopack on Windows**
   - What we know: Phase 1 documented that Turbopack on Windows has CSS import issues (resolved by inlining). next-intl uses a compiler plugin, not CSS.
   - What's unclear: Whether `createNextIntlPlugin` wraps `next.config.ts` cleanly with Next.js 16.2.0 (next-intl targets Next.js 13+; 16.x is very recent).
   - Recommendation: Add a Wave 0 validation step in Plan 05-02 — install next-intl, add the plugin, run `next build` to confirm no compilation errors before building any translated UI.

2. **Prison facility internet connectivity (from STATE.md open blocker)**
   - What we know: Offline form submission is explicitly out of scope (REQUIREMENTS.md). The spec assumes reliable connectivity at prison facilities.
   - What's unclear: Whether slow connectivity causes UX issues with Server Actions (no optimistic UI).
   - Recommendation: Add a visible loading state on the submit button (disable + spinner) to handle slow responses gracefully. This is a UX mitigation, not an offline solution.

3. **IN-YYYY-NNNN reference number sequence scope**
   - What we know: The PU-YYYY-NNNN trigger (Phase 4) is tenant-scoped with a per-year sequence.
   - What's unclear: Whether intake references should be per-facility or platform-wide.
   - Recommendation: Make intake references platform-wide (simpler trigger, unique across all facilities) — no requirement for per-facility scoping exists in the spec.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @repo/web test` |
| Full suite command | `pnpm --filter @repo/web test && pnpm --filter @repo/db test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTAKE-01 | Prison session guard rejects non-prison roles | unit | `pnpm --filter @repo/web test -- --grep "requirePrisonSession"` | ❌ Wave 0 |
| INTAKE-03 | submitIntake Server Action validates required fields (staff_name, delivery_date, min 1 line) | unit | `pnpm --filter @repo/web test -- --grep "submitIntake"` | ❌ Wave 0 |
| INTAKE-04 | Pre-population: intake lines pre-filled from pickup_lines quantities | unit | `pnpm --filter @repo/web test -- --grep "getExpectedDelivery"` | ❌ Wave 0 |
| INTAKE-05 | Unexpected delivery: client dropdown required, intake created with is_unexpected=true | unit | `pnpm --filter @repo/web test -- --grep "submitUnexpectedIntake"` | ❌ Wave 0 |
| INTAKE-06 | Discrepancy detection: lines exceeding threshold set discrepancy_flagged=true | unit | `pnpm --filter @repo/web test -- --grep "discrepancy"` | ❌ Wave 0 |
| INTAKE-06 | calculateDiscrepancyPct pure function — boundary cases (0%, exactly 15%, 15.01%) | unit | `pnpm --filter @repo/web test -- --grep "calculateDiscrepancyPct"` | ❌ Wave 0 |
| INTAKE-07 | Batch flag match blocks submission (returns quarantine_blocked error) | unit | `pnpm --filter @repo/web test -- --grep "quarantine"` | ❌ Wave 0 |
| INTAKE-07 | Quarantine override action: rejects empty reason (<10 chars), sets quarantine_overridden=true | unit | `pnpm --filter @repo/web test -- --grep "overrideQuarantine"` | ❌ Wave 0 |
| INTAKE-08 | Persistent problem market flag: country with >15% rate in ≥3 of last 6 months gets flagged | unit | `pnpm --filter @repo/web test -- --grep "persistent.*flag\|persistentFlag"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @repo/web test`
- **Per wave merge:** `pnpm --filter @repo/web test && pnpm --filter @repo/db test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/app/prison/actions.test.ts` — covers INTAKE-01, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07
- [ ] `apps/web/app/(ops)/intake/actions.test.ts` — covers INTAKE-07 quarantine override
- [ ] `apps/web/lib/discrepancy.test.ts` — covers `calculateDiscrepancyPct` pure function (INTAKE-06 boundary cases)
- [ ] `apps/web/lib/persistent-flag.test.ts` — covers persistent problem market logic (INTAKE-08)

---

## Sources

### Primary (HIGH confidence)
- Direct schema file reads: `packages/db/src/schema/pickups.ts`, `transport.ts`, `settings.ts`, `auth.ts`, `tenants.ts`, `notifications.ts` — confirmed RLS patterns, JWT claim names, existing table structure
- `apps/web/app/(ops)/pickups/actions.ts` — confirmed Server Action patterns, withRLSContext usage, requireRecoAdmin shape
- `apps/web/app/prison/login/page.tsx` — confirmed prison session exists from Phase 2
- `apps/web/app/(ops)/ops-nav-bar.tsx` — confirmed nav pattern for "Intake" addition
- `apps/web/package.json` — confirmed installed dependencies; next-intl NOT installed
- `apps/web/vitest.config.ts` — confirmed test framework and mock patterns
- `.planning/phases/05-prison-intake-and-counting/05-CONTEXT.md` — locked decisions
- `.planning/phases/05-prison-intake-and-counting/05-UI-SPEC.md` — component inventory, Danish copy, spacing contract
- `.planning/REQUIREMENTS.md` — INTAKE-01 through INTAKE-08 full text
- `.planning/STATE.md` — accumulated decisions and open blockers

### Secondary (MEDIUM confidence)
- next-intl "without i18n routing" pattern — documented approach in next-intl docs; consistent with project constraint of not restructuring existing route groups

### Tertiary (LOW confidence)
- next-intl compatibility with Next.js 16.2.0 (very recent version) — noted as Open Question; validate in Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages either already installed (confirmed from package.json) or well-established (next-intl)
- Architecture: HIGH — all patterns derived directly from existing codebase; no speculation
- Pitfalls: HIGH — derived from documented Phase 1–4 decisions in STATE.md and direct schema analysis
- Validation: HIGH — test framework confirmed from vitest.config.ts; test commands match existing scripts

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (next-intl version check; stable stack otherwise)
