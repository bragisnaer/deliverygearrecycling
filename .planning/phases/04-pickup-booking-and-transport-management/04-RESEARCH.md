# Phase 4: Pickup Booking and Transport Management - Research

**Researched:** 2026-03-20
**Domain:** Next.js 16 App Router / Drizzle ORM / Supabase RLS / multi-role data modelling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pickup Booking Form**
- Product quantities displayed as a scrollable table with one row per product from the client's registry and a number input per row — consistent with Phase 3's inline editable material composition table
- Photo upload supports both drag-and-drop and click-to-pick (file picker fallback) — consistent with product photo upload in Phase 3
- 72-hour lead time enforced as a hard block: date picker disables all dates within 72h of submission; no override possible
- Pallet count is entered manually; total estimated weight is auto-calculated (unit weight × quantity per product + pallet weight × pallet count) — no manual weight entry required on the form

**Status and Queue Management**
- reco-admin pickup queue is a single table with status filter tabs (submitted / confirmed / transport_booked / etc.) — consistent with ops portal table + tabs pattern
- Status transitions and transport booking actions live within the pickup detail page (not inline table buttons) — keeps the queue table clean
- Cancellation requires a confirmation modal with a reason textarea (applies to both client self-cancel and reco-admin cancel with reason)
- Client users access their pickup list from a dedicated "Pickups" page in the client portal — consistent with the ops portal "Products" primary nav pattern; dashboard comes in Phase 8

**Transport Management UX**
- reco-admin books transport (direct or consolidation) from within the pickup detail page via a "Book Transport" action on any confirmed pickup — contextual, no extra navigation
- Consolidation warehouse inventory is a table with colour-coded ageing (days held; turns red when threshold exceeded) — consistent with ops portal table style
- Outbound shipment creation uses a checkbox table to select held pickups from warehouse inventory — accessible and tablet-friendly
- Outbound shipment cost split: system proposes pro-rata allocation (total cost ÷ total pallets × pallet count per pickup); user can manually override individual pickup allocations; running sum displayed to ensure allocations balance to total before confirming

### Claude's Discretion
- Exact DB function approach for PU-YYYY-NNNN reference number generation (sequence vs trigger)
- RLS policy details for transport provider visibility (only linked clients' pickups)
- Specific colour thresholds for ageing indicator (e.g. orange at 7 days, red at threshold)
- Pickup confirmation email implementation detail (Server Action → Resend call; background jobs/notifications come in Phase 9)
- Exact shadcn component selection for status tabs and transport booking modals

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PICKUP-01 | client/client-global submit pickup with: location (auto-set for client), dynamic product quantities, pallet count, estimated weight, pallet dimensions, preferred date, notes, up to 5 photos | Schema section (pickups table), Form pattern, photo upload reuse |
| PICKUP-02 | Human-readable reference number PU-YYYY-NNNN | DB function / sequence pattern for padded reference |
| PICKUP-03 | client role auto-fills pickup address from location record; not editable | locations table must be introduced this phase; client address derivation from user.location_id |
| PICKUP-04 | Preferred pickup date enforces 72-hour lead time | Client-side date picker disable + Server Action validation |
| PICKUP-05 | Multiple active pickups per location simultaneously — no restriction | No unique constraint needed; document explicitly |
| PICKUP-06 | Client cancel up to 24h before confirmed date; reco-admin cancel any time with reason | Status + cancellation_reason column; 24h guard in action |
| PICKUP-07 | Pickup status lifecycle: submitted → confirmed → transport_booked → picked_up → at_warehouse → in_outbound_shipment → in_transit → delivered → intake_registered | pgEnum; status transition guard in Server Actions |
| PICKUP-08 | On submission: reco-admin email + in-app alert; client confirmation email with request ID | Resend install; simple transactional Server Action call; in-app notification row |
| TRANS-01 | Transport provider registry: name, contact, regions, type (direct/consolidation), warehouse address, has_platform_access | transport_providers table |
| TRANS-02 | Providers linked to tenants via join table; providers only see linked clients' pickups | transport_provider_clients join table; transport_role RLS using EXISTS subquery |
| TRANS-03 | reco-admin books direct transport: provider, destination prison, cost EUR, confirm pickup date | transport_bookings table; direct type |
| TRANS-04 | reco-admin books consolidation transport: provider, "provider warehouse" destination; cost = market→warehouse leg | transport_bookings table; consolidation type; first-leg cost only |
| TRANS-05 | Consolidation provider warehouse inventory view: held pickups with client, market, products, pallet count, arrival date, days held | View/query pattern; arrival_date derived from status transition timestamp |
| TRANS-06 | Outbound shipment creation: select held pickups, destination prison, warehouse→prison cost; soft 7-pallet warning | outbound_shipments + outbound_shipment_pickups join table |
| TRANS-07 | Two-leg cost model: market→destination cost on booking; warehouse→prison cost pro-rata on outbound shipment | Two cost columns on transport_bookings; warehouse_to_prison_cost_eur on outbound_shipments and allocated per pickup |
| TRANS-08 | Transport providers can update status, add notes, upload proof of delivery; cannot see pricing/prison data/other providers | transport_role RLS; proof_of_delivery_path in storage |
| TRANS-09 | reco-admin in-app alert when pallets held > configurable threshold | notifications table (lightweight); check on warehouse inventory query; ageing computed from at_warehouse timestamp |
| TRANS-10 | Outbound shipment delivery cascades delivered status to all linked pickup requests | Server Action: mark outbound delivered → batch-update linked pickups |
</phase_requirements>

---

## Summary

Phase 4 is the largest schema-introduction phase in the project, adding four to five new tables (pickups, pickup_lines, transport_providers, transport_provider_clients, transport_bookings, outbound_shipments, outbound_shipment_pickups) plus a lightweight notifications table. All patterns follow the well-established Phase 3 baseline: `pgTable + pgPolicy` restrictive deny-all plus per-role permissive grants, `withRLSContext()` wrapping every mutation, Server Actions for all CRUD, and the shadcn/ui + Tailwind CSS v4 component library.

The key architectural challenge is the **two-leg transport model**: a pickup can travel market → warehouse (consolidation leg 1) then warehouse → prison (consolidation leg 2), or market → prison directly. The second leg's cost must be allocated pro-rata across all pickups in an outbound shipment. This is modelled by storing the leg-1 cost on `transport_bookings` and the leg-2 total on `outbound_shipments`, with the per-pickup allocation stored as a derived column on the `outbound_shipment_pickups` join table so Phase 7 finance queries never need to recompute it.

A second complexity is the **PU-YYYY-NNNN reference number** (PICKUP-02). The cleanest implementation is a PostgreSQL sequence per year combined with a `BEFORE INSERT` trigger that formats the reference — this is purely a DB concern and requires no application logic. The `locations` table (referenced by `users.location_id` but not yet materialized as a real table) must also be introduced this phase so `client` role users can have their pickup address auto-populated (PICKUP-03).

**Primary recommendation:** Follow Phase 3's schema + Server Action + page patterns exactly. Model the transport domain with five targeted tables. Introduce Resend as a new dependency for transactional emails (PICKUP-08). Use a minimal `notifications` table for in-app alerts (TRANS-09, PICKUP-08) to avoid prematurely building the full Phase 9 notification centre.

---

## Standard Stack

### Core (confirmed from codebase inspection)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 (installed) | Schema, migrations, RLS policies | All Phase 1–3 tables use this |
| next | 16.2.0 (installed) | App Router, Server Actions | Project baseline |
| react-hook-form | ^7.54.0 (installed) | Form state (product form pattern) | Already used in Phase 3 forms |
| @hookform/resolvers | ^3.0.0 (installed) | Zod resolver for RHF | Already installed |
| zod | ^3.24.1 (installed) | Schema validation in Server Actions | All existing actions use this |
| @supabase/storage-js | ^2.99.3 (installed) | Pickup photo upload | Product photos use same client |
| sonner | ^1.7.4 (installed) | Toast notifications for form feedback | Already in project |
| @base-ui/react | ^1.3.0 (installed) | Dialog/Modal (Phase 2–3 pattern) | Used instead of Radix UI |

### New Dependencies This Phase
| Library | Version | Purpose | Installation |
|---------|---------|---------|--------------|
| resend | latest | Transactional email for PICKUP-08 | `pnpm add resend --filter web` |
| @react-email/components | latest | Email template components | `pnpm add @react-email/components --filter web` |

**Version verification command:**
```bash
npm view resend version
npm view @react-email/components version
```

**Installation:**
```bash
pnpm add resend @react-email/components --filter web
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend (simple Server Action call) | Inngest/Trigger.dev background job | Phase 9 brings full notification infra; a direct Resend call in the Server Action is sufficient for Phase 4's two transactional emails |
| notifications table (lightweight) | Full notification centre | Phase 9 builds the full centre; Phase 4 only needs to store the alert rows that Phase 9's UI will display |

---

## Architecture Patterns

### New Schema Files
```
packages/db/src/schema/
├── locations.ts          # locations table (required for PICKUP-03)
├── pickups.ts            # pickups, pickup_lines, pickup_photos (PICKUP-01–08)
└── transport.ts          # transport_providers, transport_provider_clients,
                          # transport_bookings, outbound_shipments,
                          # outbound_shipment_pickups (TRANS-01–10)
```

### New App Pages
```
apps/web/app/
├── (ops)/
│   ├── pickups/
│   │   ├── page.tsx          # reco-admin queue with status tabs
│   │   └── [id]/page.tsx     # pickup detail + status transitions + Book Transport
│   └── transport/
│       ├── providers/
│       │   ├── page.tsx       # provider registry list
│       │   ├── new/page.tsx   # add provider
│       │   └── [id]/page.tsx  # provider detail
│       └── outbound/
│           ├── page.tsx       # warehouse inventory (consolidation)
│           └── new/page.tsx   # create outbound shipment
└── (client)/
    └── pickups/
        ├── page.tsx           # client pickup list
        └── new/page.tsx       # pickup booking form
        └── [id]/page.tsx      # client pickup detail + cancel
```

### Pattern 1: Schema Definition (replicate from products.ts)
```typescript
// Source: packages/db/src/schema/products.ts (established codebase pattern)
export const pickups = pgTable(
  'pickups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().references(() => tenants.id),
    reference: text('reference').notNull(), // PU-YYYY-NNNN — set by DB trigger
    status: pickupStatusEnum('status').notNull().default('submitted'),
    location_id: uuid('location_id').notNull().references(() => locations.id),
    // ... other columns
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('pickups_tenant_id_idx').on(t.tenant_id),
    pgPolicy('pickups_deny_all', { as: 'restrictive', for: 'all', using: sql`false` }),
    pgPolicy('pickups_reco_admin_all', { as: 'permissive', to: recoAdminRole, for: 'all', using: sql`true`, withCheck: sql`true` }),
    pgPolicy('pickups_reco_read', { as: 'permissive', to: recoRole, for: 'select', using: sql`true` }),
    pgPolicy('pickups_client_read', { as: 'permissive', to: clientRole, for: 'select', using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)` }),
    pgPolicy('pickups_client_insert', { as: 'permissive', to: clientRole, for: 'insert', withCheck: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)` }),
  ]
)
```

### Pattern 2: PU-YYYY-NNNN Reference Number Generation

**Approach:** PostgreSQL `BEFORE INSERT` trigger using a per-year sequence. This keeps all reference logic in the DB, is race-condition-safe, and requires no application code.

**Implementation (in migration SQL):**
```sql
-- Sequence resets are not natively per-year in Postgres; use a function + sequence-per-year approach:
CREATE OR REPLACE FUNCTION generate_pickup_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT := to_char(NOW(), 'YYYY');
  seq_name TEXT := 'pickup_ref_seq_' || year_str;
  next_val BIGINT;
BEGIN
  -- Create sequence for current year if not exists
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  NEW.reference := 'PU-' || year_str || '-' || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_pickup_reference
  BEFORE INSERT ON pickups
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION generate_pickup_reference();
```

**Drizzle schema:** `reference` column is `text('reference').notNull()` — the trigger sets it, so the application passes an empty string or null (the trigger WHEN clause handles both). Alternatively, pass `''` from the insert and let the trigger overwrite it.

**Confidence:** HIGH — standard PostgreSQL pattern, race-safe because `nextval()` is transactional.

### Pattern 3: Status Lifecycle Enum
```typescript
// Source: established pgEnum pattern from products.ts processingStreamEnum
export const pickupStatusEnum = pgEnum('pickup_status', [
  'submitted',
  'confirmed',
  'transport_booked',
  'picked_up',
  'at_warehouse',         // consolidation only
  'in_outbound_shipment', // consolidation only
  'in_transit',
  'delivered',
  'intake_registered',
  'cancelled',
])
```

Status transition validation belongs in Server Actions, not in the DB. The action checks current status before allowing the transition:
```typescript
// Source: established action pattern
if (pickup.status !== 'confirmed') {
  return { error: 'Can only book transport on a confirmed pickup' }
}
```

### Pattern 4: Two-Leg Transport Cost Model

The data model is:
- `transport_bookings.transport_cost_market_to_destination_eur` — leg 1 cost (both direct and consolidation)
- `outbound_shipments.transport_cost_warehouse_to_prison_eur` — leg 2 total (consolidation only)
- `outbound_shipment_pickups.allocated_cost_eur` — pre-computed leg 2 allocation per pickup

**Pro-rata allocation formula:**
```
allocated_cost_eur = (pickup.pallet_count / shipment.total_pallet_count) × shipment.transport_cost_warehouse_to_prison_eur
```

This is computed and stored at outbound shipment confirmation — it is NOT a live-computed field. Storing it on the join table ensures Phase 7 financial queries are simple lookups without re-computing pallet sums.

**Numeric precision:** All cost columns use `numeric(12, 4)` to match existing `product_pricing` precision.

### Pattern 5: Server Action with requireRole helpers
```typescript
// Source: apps/web/app/(ops)/products/actions.ts — established pattern
async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') throw new Error('Unauthorized')
  return { ...session.user, sub: session.user.id! }
}

async function requireClient() {
  const session = await auth()
  if (!session?.user || !['client', 'client-global'].includes(session.user.role)) {
    throw new Error('Unauthorized')
  }
  return { ...session.user, sub: session.user.id! }
}

async function requireTransportOrAdmin() {
  const session = await auth()
  if (!session?.user || !['reco-admin', 'transport'].includes(session.user.role)) {
    throw new Error('Unauthorized')
  }
  return { ...session.user, sub: session.user.id! }
}
```

### Pattern 6: RLS for Transport Provider Visibility (TRANS-02)
Transport providers can only see pickups for their linked tenants:
```sql
-- transport_role SELECT on pickups: only linked clients
CREATE POLICY "pickups_transport_read" ON pickups
  AS PERMISSIVE FOR SELECT TO transport_role
  USING (
    tenant_id IN (
      SELECT tenant_id FROM transport_provider_clients tpc
      INNER JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
      WHERE tp.user_id::text = current_setting('request.jwt.claim.sub', true)
    )
  );
```

**Note:** `transport_providers` needs a `user_id` column linking to `users.id` so the JWT sub claim can identify which provider the current user belongs to.

### Pattern 7: Locations Table (new — required for PICKUP-03)

`users.location_id` has been a bare `uuid` column since Phase 1 with no foreign key — there is no `locations` table yet. Phase 4 must introduce it.

```typescript
export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),           // e.g. "Copenhagen HQ"
    address: text('address').notNull(),      // pickup address
    country: text('country').notNull(),      // ISO 3166-1 alpha-2
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('locations_tenant_id_idx').on(t.tenant_id),
    pgPolicy('locations_deny_all', { as: 'restrictive', for: 'all', using: sql`false` }),
    pgPolicy('locations_reco_admin_all', { ... }),
    pgPolicy('locations_reco_read', { ... }),
    pgPolicy('locations_client_read', { as: 'permissive', to: clientRole, for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)` }),
  ]
)
```

After introducing the table, the migration must also `ADD CONSTRAINT locations_fk FOREIGN KEY (location_id) REFERENCES locations(id)` on the `users` table.

### Pattern 8: Lightweight Notifications Table (PICKUP-08, TRANS-09)
Phase 9 will build the full notification centre. Phase 4 only needs to CREATE the table and INSERT rows. Phase 9 will add the UI and email infrastructure around it.

```typescript
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  tenant_id: text('tenant_id'),              // null = global / reco-admin
  type: text('type').notNull(),              // e.g. 'pickup_submitted', 'warehouse_ageing_alert'
  title: text('title').notNull(),
  body: text('body'),
  entity_type: text('entity_type'),          // e.g. 'pickup', 'transport_booking'
  entity_id: text('entity_id'),
  read: boolean('read').notNull().default(false),
  created_at: timestamp('created_at').notNull().defaultNow(),
})
```

**For reco-admin alerts:** `user_id` is null and `tenant_id` is null — the Phase 9 notification centre will fan out to all reco-admin users.

### Pattern 9: Transactional Email for PICKUP-08
Install Resend. Send email directly from the `submitPickupRequest` Server Action. No queue, no background job.

```typescript
// Source: NOTIF-04 requirement; Resend is the project's chosen provider
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Inside submitPickupRequest Server Action, after DB insert:
await resend.emails.send({
  from: 'noreply@courierrecycling.com',
  to: submitterEmail,
  subject: `Pickup Request Confirmed — ${reference}`,
  react: PickupConfirmationEmail({ reference, preferredDate }),
})
```

**Environment variable needed:** `RESEND_API_KEY` — add to Vercel project settings and local `.env.local`.

### Anti-Patterns to Avoid
- **Inline status changes in the queue table:** UX decision locks transitions to the detail page. Do not add inline action buttons to the queue table rows.
- **Computing allocated_cost_eur at query time:** Pre-compute and store it on `outbound_shipment_pickups` at confirmation. Phase 7 finance queries must be simple joins.
- **Storing pallet weight as a hardcoded constant in application code:** Add `standard_pallet_weight_grams` to `system_settings` (or hardcode as a named constant in the schema seed at 25,000g) so it can be changed without a code deploy.
- **Using `onConflictDoNothing().returning()` for reference check:** This pattern returns empty on conflict (Phase 3 Pitfall 6 — documented in STATE.md). For pickup inserts, always insert then SELECT to get the `reference`.
- **Adding a FK from `users.location_id` to `locations.id` in the Drizzle schema file for `users`:** The `users` table was created by the Auth.js adapter migration. Add the FK via raw SQL in the Phase 4 migration rather than modifying the Drizzle users schema definition.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Race-condition-safe sequential reference numbers | Application-level counter with optimistic lock | PostgreSQL `nextval()` in a BEFORE INSERT trigger | `nextval()` is transactional and serialized |
| Photo drag-and-drop with file picker fallback | Custom dropzone | Replicate the product photo upload pattern from Phase 3 (Supabase Storage bucket) | Already implemented, tested, working |
| Pro-rata cost split arithmetic | Custom split function | Standard arithmetic in the Server Action | Simple enough; the complexity is UX (running total display) not math |
| Transport provider authentication | Separate auth system | Same Supabase/next-auth flow; `transport` role maps to `transport_role` pgRole via `withRLSContext` | Role already exists in Phase 1 JWT + pgRole setup |
| Ageing threshold alert check | Cron job / scheduled function | Compute days held inline when querying warehouse inventory; emit notification rows on page load if threshold exceeded and no unread alert exists | Phase 9 brings proper notification infra; a simple guard on the inventory query is sufficient for Phase 4 |

**Key insight:** The transport domain looks complex but decomposes into standard CRUD backed by the existing RLS + Server Action + withRLSContext patterns. No new architectural primitives are needed.

---

## Common Pitfalls

### Pitfall 1: Missing locations Table Causes FK Violation on Client Pickup Submit
**What goes wrong:** `users.location_id` has no FK in the DB today (it is a bare UUID column from the Phase 1 Auth.js migration). The pickup form reads the user's location to auto-populate the address. If the `locations` table is not introduced before inserting pickups, `pickups.location_id` has no referential integrity target.
**Why it happens:** Phase 1 left `location_id` as an un-referenced UUID column because locations were not yet in scope.
**How to avoid:** Wave 0 of Phase 4 must create the `locations` table and add the FK constraint to `users.location_id` via migration SQL. Seed at least one location for the Wolt tenant for dev.
**Warning signs:** Any test inserting a pickup will fail with FK violation or null location address.

### Pitfall 2: RLS Policy on pickup_lines Missing — Denial Cascade
**What goes wrong:** `pickup_lines` (the per-product quantity rows) inherit tenant isolation through `pickup_id`, not a direct `tenant_id`. Without an explicit EXISTS subquery policy (same as `product_materials`), the restrictive deny-all policy blocks all access.
**Why it happens:** Child tables without `tenant_id` need the EXISTS subquery pattern (established in Phase 3 for `product_materials`).
**How to avoid:** Follow the `product_materials_client_read` policy pattern exactly:
```sql
USING (EXISTS (SELECT 1 FROM pickups p WHERE p.id = pickup_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true)))
```
**Warning signs:** Client pickup form loads products but shows zero quantity rows on existing pickups.

### Pitfall 3: outbound_shipment_pickups.allocated_cost_eur Drift
**What goes wrong:** If the `outbound_shipments.transport_cost_warehouse_to_prison_eur` is updated after confirmation, the stored `allocated_cost_eur` per pickup becomes stale.
**Why it happens:** Denormalised data requires update propagation.
**How to avoid:** Mark outbound shipments as immutable once confirmed (status-lock). If reco-admin needs to correct a cost, void the shipment and re-create. Document this in the detail page UI.
**Warning signs:** Phase 7 financial totals do not match re-computed allocations.

### Pitfall 4: 72-Hour Lead Time Not Validated Server-Side
**What goes wrong:** Client-side date picker disabling can be bypassed. Server Action for `submitPickupRequest` must also validate that `preferred_date >= now() + 72 hours`.
**Why it happens:** Trusting only UI constraints.
**How to avoid:** Always duplicate critical business rules in the Server Action.
```typescript
const minDate = new Date(Date.now() + 72 * 60 * 60 * 1000)
if (new Date(parsed.preferred_date) < minDate) {
  return { error: 'Preferred date must be at least 72 hours from now' }
}
```

### Pitfall 5: Weight Calculation Using Drizzle Numeric Strings
**What goes wrong:** Drizzle returns `numeric` columns as strings. `product.weight_grams` is a `string | null`. Multiplying without `parseFloat()` produces `NaN` or string concatenation.
**Why it happens:** Drizzle ORM returns Postgres `numeric` type as JavaScript `string` to preserve precision.
**How to avoid:** Always convert before arithmetic:
```typescript
const lineWeight = parseFloat(product.weight_grams ?? '0') * quantity
const palletWeight = palletCount * STANDARD_PALLET_WEIGHT_GRAMS
const totalWeight = lineWeights.reduce((sum, w) => sum + w, 0) + palletWeight
```

### Pitfall 6: Transport Provider Join Table RLS With Sub-SELECT Performance
**What goes wrong:** The `transport_role` RLS policy on `pickups` uses an EXISTS subquery joining `transport_provider_clients` and `transport_providers`. Without an index on `transport_provider_clients.transport_provider_id`, this is a full table scan on every pickup row read.
**Why it happens:** RLS policies run on every row in the result set.
**How to avoid:** Add indexes:
```sql
CREATE INDEX transport_provider_clients_provider_id_idx ON transport_provider_clients (transport_provider_id);
CREATE INDEX transport_provider_clients_tenant_id_idx ON transport_provider_clients (tenant_id);
```

### Pitfall 7: In-App Alert for Ageing — Duplicate Rows on Repeated Page Load
**What goes wrong:** If the warehouse inventory page emits a notification row every time it loads and the threshold is exceeded, the notifications table fills with duplicate alerts.
**Why it happens:** Stateless page load + imperative notification INSERT.
**How to avoid:** Before inserting a new ageing alert, check whether an unread ageing notification for that pickup already exists:
```typescript
const existing = await tx.select().from(notifications)
  .where(and(eq(notifications.entity_id, pickupId), eq(notifications.type, 'warehouse_ageing_alert'), eq(notifications.read, false)))
  .limit(1)
if (existing.length === 0) {
  await tx.insert(notifications).values({ ... })
}
```

---

## Code Examples

### Schema: pickups Table (core columns)
```typescript
// Source: established project pattern (packages/db/src/schema/products.ts)
export const pickupStatusEnum = pgEnum('pickup_status', [
  'submitted', 'confirmed', 'transport_booked', 'picked_up',
  'at_warehouse', 'in_outbound_shipment', 'in_transit', 'delivered',
  'intake_registered', 'cancelled',
])

export const pickups = pgTable('pickups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  location_id: uuid('location_id').notNull().references(() => locations.id),
  reference: text('reference').notNull().default(''), // overwritten by DB trigger
  status: pickupStatusEnum('status').notNull().default('submitted'),
  pallet_count: integer('pallet_count').notNull(),
  pallet_dimensions: text('pallet_dimensions'),         // e.g. "120×80×150cm"
  estimated_weight_grams: numeric('estimated_weight_grams', { precision: 12, scale: 2 }),
  preferred_date: timestamp('preferred_date').notNull(),
  confirmed_date: timestamp('confirmed_date'),
  notes: text('notes'),
  cancellation_reason: text('cancellation_reason'),
  cancelled_at: timestamp('cancelled_at'),
  cancelled_by: uuid('cancelled_by').references(() => users.id),
  submitted_by: uuid('submitted_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [ /* indexes + policies */ ])
```

### Schema: transport_bookings Table
```typescript
export const transportTypeEnum = pgEnum('transport_type', ['direct', 'consolidation'])

export const transportBookings = pgTable('transport_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  pickup_id: uuid('pickup_id').notNull().references(() => pickups.id, { onDelete: 'cascade' }),
  transport_provider_id: uuid('transport_provider_id').notNull().references(() => transportProviders.id),
  transport_type: transportTypeEnum('transport_type').notNull(),
  // Direct: prison_facility_id set; Consolidation: null (destination = warehouse)
  prison_facility_id: uuid('prison_facility_id').references(() => prisonFacilities.id),
  transport_cost_market_to_destination_eur: numeric('transport_cost_market_to_destination_eur', { precision: 12, scale: 4 }),
  confirmed_pickup_date: timestamp('confirmed_pickup_date'),
  delivery_notes: text('delivery_notes'),
  proof_of_delivery_path: text('proof_of_delivery_path'),
  booked_by: uuid('booked_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [ /* indexes + policies */ ])
```

### Schema: outbound_shipments and Join Table
```typescript
export const outboundShipments = pgTable('outbound_shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  transport_provider_id: uuid('transport_provider_id').notNull().references(() => transportProviders.id),
  prison_facility_id: uuid('prison_facility_id').notNull().references(() => prisonFacilities.id),
  transport_cost_warehouse_to_prison_eur: numeric('transport_cost_warehouse_to_prison_eur', { precision: 12, scale: 4 }).notNull(),
  total_pallet_count: integer('total_pallet_count').notNull(),
  status: text('status').notNull().default('created'), // created | in_transit | delivered
  dispatched_at: timestamp('dispatched_at'),
  delivered_at: timestamp('delivered_at'),
  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
})

export const outboundShipmentPickups = pgTable('outbound_shipment_pickups', {
  id: uuid('id').primaryKey().defaultRandom(),
  outbound_shipment_id: uuid('outbound_shipment_id').notNull().references(() => outboundShipments.id, { onDelete: 'cascade' }),
  pickup_id: uuid('pickup_id').notNull().references(() => pickups.id),
  pallet_count: integer('pallet_count').notNull(),
  allocated_cost_eur: numeric('allocated_cost_eur', { precision: 12, scale: 4 }),  // pre-computed pro-rata
})
```

### Server Action: submitPickupRequest (skeleton)
```typescript
// Source: mirrors createProduct pattern from apps/web/app/(ops)/products/actions.ts
'use server'
export async function submitPickupRequest(formData: FormData) {
  const user = await requireClient()
  // 1. Validate preferred_date >= now + 72h
  // 2. Validate product quantities (must have at least one > 0)
  // 3. withRLSContext: insert pickups row (reference = '' — trigger will set it)
  // 4. withRLSContext: insert pickup_lines rows
  // 5. withRLSContext: select back the pickup.reference for the confirmation
  // 6. Send confirmation email via Resend (non-blocking try/catch)
  // 7. Insert notification row for reco-admin
  // 8. revalidatePath('/pickups')
  // 9. return { success: true, reference }
}
```

### Server Action: markOutboundDelivered (cascade — TRANS-10)
```typescript
'use server'
export async function markOutboundDelivered(shipmentId: string) {
  const user = await requireTransportOrAdmin()
  await withRLSContext(user, async (tx) => {
    // 1. Update outbound_shipments.status = 'delivered', delivered_at = now()
    // 2. Fetch all pickup_ids from outbound_shipment_pickups WHERE outbound_shipment_id = shipmentId
    // 3. Batch-update pickups.status = 'delivered' WHERE id IN (pickup_ids)
    // 4. Batch-update transport_bookings (linked) status if needed
  })
  revalidatePath('/transport/outbound')
  return { success: true }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Route Handlers for CRUD | Server Actions for all mutations | Established Phase 1 | No Route Handlers for internal CRUD — all mutations are `'use server'` files |
| Global DB queries | withRLSContext() wrapping all tenant-scoped queries | Phase 1 | Every DB operation in a transaction with SET LOCAL JWT claims |
| Radix UI Dialog | @base-ui/react Dialog | Phase 2 (note in STATE.md) | Use `@base-ui/react` DialogRoot/DialogTrigger/DialogPopup — not shadcn Dialog which uses Radix |

**Deprecated/outdated:**
- shadcn `<Dialog>` component: not installed. Use `@base-ui/react` Dialog instead — the Phase 2 discovery note in STATE.md confirms this.
- `onConflictDoNothing().returning()`: returns empty array on conflict (Phase 3 Pitfall 6). Always use insert-then-select pattern for any insert where the caller needs the row back.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `apps/web/vitest.config.ts` (exists) |
| Quick run command | `pnpm --filter web test` |
| Full suite command | `pnpm --filter web test` (single suite currently) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PICKUP-02 | PU-YYYY-NNNN trigger generates unique sequential refs | unit (mock DB) | `pnpm --filter web test -- --grep "pickup reference"` | ❌ Wave 0 |
| PICKUP-04 | 72h lead time validation in Server Action rejects past dates | unit (mock DB) | `pnpm --filter web test -- --grep "72-hour"` | ❌ Wave 0 |
| PICKUP-06 | Client cancel blocked if < 24h before confirmed date | unit (mock DB) | `pnpm --filter web test -- --grep "cancellation"` | ❌ Wave 0 |
| TRANS-07 | Pro-rata allocation sums to total; rounding distributes correctly | unit (pure function) | `pnpm --filter web test -- --grep "pro-rata"` | ❌ Wave 0 |
| TRANS-10 | markOutboundDelivered cascades delivered status to all linked pickups | unit (mock DB) | `pnpm --filter web test -- --grep "cascade"` | ❌ Wave 0 |
| PICKUP-08 | Resend call invoked with correct reference on pickup submit | unit (mock Resend) | `pnpm --filter web test -- --grep "confirmation email"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test`
- **Per wave merge:** `pnpm --filter web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/app/(client)/pickups/actions.test.ts` — covers PICKUP-02, PICKUP-04, PICKUP-06
- [ ] `apps/web/app/(ops)/pickups/actions.test.ts` — covers PICKUP-07, TRANS-10
- [ ] `apps/web/app/(ops)/transport/actions.test.ts` — covers TRANS-07 pro-rata logic
- [ ] Resend mock: add `vi.mock('resend', ...)` in test files (same pattern as storage mock)

---

## Open Questions

1. **Standard pallet weight for auto-weight calculation**
   - What we know: CONTEXT says `pallet_count × standard_pallet_weight_grams`; SPECIFICS suggest a configurable system setting
   - What's unclear: Is this already in `system_settings`? No — it was not added in Phase 1 (not in the schema).
   - Recommendation: Add `standard_pallet_weight_grams integer NOT NULL DEFAULT 25000` to `system_settings` in the Phase 4 migration. This is a one-line SQL `ALTER TABLE system_settings ADD COLUMN...` — no new table needed.

2. **locations table — do any Wolt locations need seeding?**
   - What we know: Wolt products are seeded (PROD-07 complete). Users have `location_id` UUIDs but no `locations` table exists.
   - What's unclear: The existing test user records — do they have a location_id set, or is it null?
   - Recommendation: Seed one Wolt location record as part of the Phase 4 Wave 0 migration, matching whatever UUID is currently in test user records (or use null → update after seeding).

3. **Transport provider user_id linkage**
   - What we know: TRANS-02 requires providers to only see pickups for linked clients. The JWT `sub` claim must map to a transport provider.
   - What's unclear: Does a transport user have a `user_id` column on `transport_providers`, or is it a separate concept?
   - Recommendation: Add `user_id uuid REFERENCES users(id)` on `transport_providers`. One user = one provider. This is the minimal approach; Phase 9 can expand if multi-user providers are needed.

4. **Resend domain verification for courierrecycling.com**
   - What we know: Resend requires domain verification before sending from `@courierrecycling.com`
   - What's unclear: Whether the domain is already verified in the Resend account
   - Recommendation: If not verified, use `@resend.dev` test address during Phase 4 development; switch to production domain at launch. Add a `RESEND_FROM_ADDRESS` env var to allow easy switching.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection — `packages/db/src/schema/products.ts`, `auth.ts`, `settings.ts`, `tenants.ts` — all schema patterns confirmed
- Codebase inspection — `apps/web/app/(ops)/products/actions.ts` — Server Action patterns confirmed
- Codebase inspection — `packages/db/migrations/0001_rls_and_triggers.sql`, `0002_natural_exiles.sql` — migration SQL patterns confirmed
- Codebase inspection — `packages/db/src/rls.ts` — `withRLSContext` API confirmed
- Codebase inspection — `apps/web/vitest.config.ts`, `actions.test.ts` — test infrastructure confirmed
- `.planning/STATE.md` — key decisions from Phase 1–3 confirmed (Base UI dialog, numeric string pitfall, insert-then-select pattern)

### Secondary (MEDIUM confidence)
- PostgreSQL documentation (training knowledge) — `nextval()` transactional safety, `BEFORE INSERT` trigger approach for sequential reference numbers

### Tertiary (LOW confidence)
- Resend + React Email current versions — not verified against npm registry; run `npm view resend version` before install

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core dependencies confirmed from installed packages
- Architecture: HIGH — all patterns replicated from existing Phase 3 codebase
- Schema design: HIGH — matches established project conventions exactly
- Transport cost model: HIGH — requirements are clear and the two-column approach is unambiguous
- Email (Resend): MEDIUM — library not yet installed; API assumed from training knowledge; verify current version
- Pitfalls: HIGH — derived from Phase 1–3 STATE.md decisions and direct codebase inspection

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack; extend if start is delayed beyond this)
