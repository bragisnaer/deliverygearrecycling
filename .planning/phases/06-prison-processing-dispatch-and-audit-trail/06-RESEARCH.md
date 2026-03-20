# Phase 6: Prison Processing, Dispatch, and Audit Trail - Research

**Researched:** 2026-03-20
**Domain:** Processing report schema, outbound dispatch, trigger-based audit trail, edit-lock policy, void pattern, traceability chain
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None — all implementation choices are at Claude's discretion. User deferred all decisions to Claude's judgment.

### Claude's Discretion

All implementation choices — follow established codebase patterns, prior phase conventions, and domain best practices throughout.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROCESS-01 | Prison staff submit Wash and Pack reports from `ops.courierrecycling.com/prison`; max two taps to reach any form | New processing route at `/prison/processing/new`; home page adds second CTA or tab alongside existing intake flow |
| PROCESS-02 | Processing report fields: staff name, client, activity type (Wash/Pack), product type, quantity per size bucket (XXS–XXXL for clothing; total for bags), date, notes | New `processing_reports` + `processing_report_lines` tables; size_bucket enum + quantity per row for clothing; single total_quantity for bags |
| PROCESS-03 | Processing pipeline view per facility: items at each stage (awaiting processing, in progress, ready to ship, shipped) | Derived status via joins across intake_records, processing_reports, outbound_dispatches; visible to prison (own facility) and reco-admin (all) |
| PROCESS-04 | Prison interface: large touch targets, Danish labels, minimal navigation | Extends existing prison tablet shell; new Danish strings in `messages/da.json` |
| PROCESS-05 | Full traceability chain: pickup request → transport → prison intake → wash → pack → dispatch | Single query or sequential linked query across pickups, transport_bookings, outbound_shipments, intake_records, processing_reports, outbound_dispatches via FK chain |
| DISPATCH-01 | reco-admin creates outbound dispatch records: prison facility, client, dispatch date, destination, carrier, notes | New `outbound_dispatches` table; reco-admin only creation via ops portal |
| DISPATCH-02 | Packing list attached to dispatch: product type, size, SKU code, quantity (one line per box/SKU) | New `outbound_dispatch_lines` table; FK to outbound_dispatches |
| DISPATCH-03 | Dispatch status lifecycle: `created` → `picked_up` → `delivered` | `dispatch_status` enum on `outbound_dispatches` |
| DISPATCH-04 | Prison staff can view outbound dispatch history for own facility; cannot create | Prison SELECT RLS on `outbound_dispatches` scoped to `prison_facility_id`; no INSERT policy for prison role |
| AUDIT-01 | All editable records support edit-in-place with full audit trail: who, when, which field, old value, new value | `audit_log_trigger()` already exists (Phase 1); attach to new tables in new migration; old_data/new_data JSONB covers field-level diff |
| AUDIT-02 | Prison staff can edit own facility's intake records and processing reports within 48 hours of submission; records lock after 48 hours | 48-hour gate enforced in Server Actions (application layer); `created_at` comparison in action before any update |
| AUDIT-03 | reco-admin can edit any record at any time | No 48-hour gate in `requireRecoAdmin` actions; only prison role is gated |
| AUDIT-04 | No records deleted; reco-admin can mark records as `voided` with a reason; voided excluded from calculations but remain in audit trail | `voided` boolean + `void_reason` text columns on `intake_records`, `processing_reports`, `outbound_dispatches`; all queries add `WHERE voided = false` |
| AUDIT-05 | Visual "edited" indicator on any modified record; link to edit history | Check `audit_log` for UPDATE entries on the record ID; indicator rendered in record detail/list components |
| AUDIT-06 | Audit log entries captured via database trigger (not application code) | `audit_log_trigger()` (Phase 1) already does this via `SECURITY DEFINER`; Phase 6 attaches it to new tables and backfills on existing tables that are now editable |
</phase_requirements>

---

## Summary

Phase 6 has three distinct technical pillars: new schema (processing reports + outbound dispatches), edit policy enforcement (48-hour lock, void flag, edited indicator), and trigger attachment.

The audit trigger infrastructure (`audit_log_trigger()` function and `audit_log` table) was built in Phase 1 and is already active on `users`, `tenants`, `prison_facilities`, and `system_settings`. Phase 6 extends it to the newly editable tables: `intake_records`, `intake_lines`, `processing_reports`, and `outbound_dispatches`. This is purely additive — no changes to the trigger function itself, only `CREATE TRIGGER` statements in a new manual migration.

The 48-hour edit lock is application-layer logic (consistent with the discrepancy threshold pattern from Phase 5). Server Actions for prison-role edits check `Date.now() - record.created_at.getTime() < 48 * 60 * 60 * 1000` before executing an UPDATE. reco-admin actions bypass this check entirely. This is simpler than a DB-level constraint and easier to test.

The void pattern adds `voided boolean NOT NULL DEFAULT false` and `void_reason text NULLABLE` to all editable record tables. All data query functions receive a `WHERE voided = false` clause (Drizzle: `.where(eq(table.voided, false))`). The audit trail retains voided records — they remain readable via the audit log but are excluded from counts, totals, and traceability chain calculations.

The traceability chain (PROCESS-05) is a linked-record view assembled in a single Server Action by joining pickup → transport_booking/outbound_shipment → intake_record → processing_reports → outbound_dispatch using existing FK relationships. No new join tables are needed.

**Primary recommendation:** Schema-first wave structure: new tables + audit trigger attachment in one migration, then Server Actions (processing + dispatch + edit/void), then prison UI, then ops pipeline view. Identical wave cadence to Phase 5.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 (installed) | Schema, RLS, queries | Project standard across all phases |
| zod | ^3.24.1 (installed) | Server Action input validation | Project standard |
| react-hook-form | ^7.54.0 (installed) | Processing report form (client component) | Project standard; established in Phase 5 intake forms |
| next-intl | ^4.8.3 (installed) | Danish labels for new prison processing UI | Installed in Phase 5; extend `messages/da.json` |
| shadcn/ui | (installed) | UI components — Table, Badge, Select, Tabs, Alert already available | All required components already installed |
| lucide-react | ^0.469.0 (installed) | Icons for pipeline stages, edited indicators | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^1.7.4 (installed) | Toast on successful processing report submit | Consistent with Phase 5 intake success pattern |

### No New Installs Required

All required libraries are already installed. Phase 6 is purely additive to the existing stack.

**Version verification:** Confirmed from `apps/web/package.json` — all versions above match what is installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── prison/
│   │   ├── page.tsx                        # Updated: add "Report Processing" CTA
│   │   ├── processing/
│   │   │   └── new/
│   │   │       └── page.tsx                # Processing report form (Wash or Pack)
│   │   ├── dispatch/
│   │   │   └── page.tsx                    # Prison: view outbound dispatch history
│   │   └── actions.ts                      # Extend: add submitProcessingReport, getProcessingHistory
│   └── (ops)/
│       ├── intake/
│       │   └── [id]/
│       │       └── page.tsx                # Extend: show traceability chain + edited indicator
│       ├── processing/
│       │   └── page.tsx                    # Processing pipeline view (all facilities, all clients)
│       └── dispatch/
│           ├── page.tsx                    # Dispatch list
│           ├── new/
│           │   └── page.tsx                # Create outbound dispatch form
│           └── [id]/
│               └── page.tsx                # Dispatch detail + packing list
│           └── actions.ts                  # createDispatch, updateDispatchStatus, voidRecord
│       └── actions.ts                      # Extend: editIntakeRecord, voidIntakeRecord, editProcessingReport

packages/db/src/schema/
├── processing.ts                           # New: processing_reports, processing_report_lines
├── dispatch.ts                             # New: outbound_dispatches, outbound_dispatch_lines
└── index.ts                                # Extend: export * from './processing', './dispatch'

packages/db/migrations/
└── 0005_phase6_processing_dispatch_audit.sql  # New: tables, FORCE RLS, GRANTs, audit triggers, voided columns on intake_records
```

### Pattern 1: Audit Trigger Attachment

The `audit_log_trigger()` function already exists (Phase 1 migration). Phase 6 attaches it to new tables and to `intake_records` (which becomes editable in this phase):

```sql
-- Source: 0001_rls_and_triggers.sql pattern — Phase 1 established this function
-- Phase 6 migration: attach to newly editable / newly created tables

CREATE TRIGGER audit_intake_records
  AFTER INSERT OR UPDATE OR DELETE ON intake_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_processing_reports
  AFTER INSERT OR UPDATE OR DELETE ON processing_reports
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_outbound_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON outbound_dispatches
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
```

The trigger captures `old_data` and `new_data` as JSONB. Field-level diff is computable in the application layer by comparing old_data/new_data keys. The `changed_by` field is populated from `current_setting('request.jwt.claim.sub', true)` — the same JWT sub used by withRLSContext.

### Pattern 2: 48-Hour Edit Lock in Server Actions

The edit lock is enforced application-side, consistent with the discrepancy threshold pattern (Phase 5). Prison-role edit actions check age before performing any UPDATE:

```typescript
// Source: project pattern — application-level policy in Server Actions
// Prison role edit action for intake_records or processing_reports
export async function editIntakeRecord(id: string, updates: Partial<IntakeInput>) {
  const user = await requirePrisonSession()

  const [record] = await withRLSContext(user, (tx) =>
    tx.select({ created_at: intakeRecords.created_at })
      .from(intakeRecords)
      .where(eq(intakeRecords.id, id))
      .limit(1)
  )

  if (!record) return { error: 'Record not found' }

  const ageMs = Date.now() - record.created_at.getTime()
  const LOCK_MS = 48 * 60 * 60 * 1000
  if (ageMs > LOCK_MS) {
    return { error: 'edit_locked' }
  }

  await withRLSContext(user, (tx) =>
    tx.update(intakeRecords)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(intakeRecords.id, id))
  )

  return { success: true }
}
```

reco-admin edit actions use `requireRecoAdmin()` and omit the age check entirely.

### Pattern 3: Void Pattern

`voided` and `void_reason` are added to `intake_records`, `processing_reports`, and `outbound_dispatches` via migration. All data-reading queries in Server Actions add a WHERE clause:

```typescript
// Source: project pattern — application-layer filter
// All list/pipeline queries exclude voided records from calculations:
.where(eq(intakeRecords.voided, false))

// Void action (reco-admin only):
export async function voidRecord(
  table: 'intake_record' | 'processing_report' | 'outbound_dispatch',
  id: string,
  reason: string
) {
  const user = await requireRecoAdmin()
  // UPDATE voided=true, void_reason=reason on correct table
  // Audit trigger fires automatically — no manual log insert needed
}
```

Voided records remain selectable from `audit_log` by querying `table_name` + `record_id`. The audit log has no `voided` concept — it is append-only.

### Pattern 4: Size Buckets for Clothing vs. Bags

Processing reports need to distinguish clothing (quantity per size bucket) from bags (single total quantity). This is modelled via:

- `processing_report_lines` table with columns: `size_bucket` (nullable enum: XXS, XS, S, M, L, XL, XXL, XXXL) and `quantity` (integer)
- For clothing products: one row per size bucket
- For bags/non-clothing: one row with `size_bucket = null` and `quantity = total`

Product type is determined by checking `products.processing_stream` or a new approach: the form derives the input mode from whether the selected product has clothing-type characteristics. The simplest discriminator: if the product name/group indicates clothing (checked in UI layer), show size-bucket inputs; otherwise show single total quantity. Product `processing_stream` field (`recycling` or `reuse`) does NOT reliably distinguish clothing from bags — a clothing product can be in either stream.

**Recommended approach:** Add a `product_category` enum to the `products` table (`clothing` | `bag` | `other`), defaulting to `other`. Wolt products already have known categories. The processing form reads this from the product registry and renders the appropriate input mode. This is cleaner than heuristics on product name.

Alternatively (simpler for Phase 6): use a `is_clothing` boolean on `processing_report_lines` derived from product selection in the form — if the selected product is a clothing type (checked against a hardcoded list or a flag), render size bucket inputs. This avoids a schema change to `products`. Given the Wolt-specific context (known product set), this is viable for v1.

**Recommendation:** Add `product_category` enum column to `products` table in the Phase 6 migration. Seeded for known Wolt products. The processing form uses `product_category` to decide input mode. Clean, extensible, correct.

### Pattern 5: Traceability Chain Query

The traceability chain is assembled in a single Server Action via sequential FK lookups. Given the linear chain structure, a single complex JOIN is less readable than sequential queries (intake → pickup → transport → processing → dispatch). The data volume per record is tiny (one chain per pickup/intake). Pattern:

```typescript
// Source: project pattern — sequential withRLSContext queries per Phase 4 pickup detail
export async function getTraceabilityChain(intakeRecordId: string) {
  const user = await requireRecoAdmin()  // or requirePrisonSession for own facility

  // 1. Fetch intake record
  // 2. If pickup_id, fetch pickup + transport_booking + outbound_shipment
  // 3. Fetch processing_reports for this intake_record_id (wash + pack)
  // 4. Fetch outbound_dispatch linked to this intake_record (if any)
  // Return assembled chain object
}
```

### Pattern 6: Edited Indicator

The "edited" indicator is computed by checking whether the `audit_log` contains any UPDATE entries for the given record:

```typescript
// Source: audit.ts schema — audit_log has table_name_record_id_idx for this query
const edits = await withRLSContext(user, (tx) =>
  tx.select({ changed_at: auditLog.changed_at, changed_by: auditLog.changed_by })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.table_name, 'intake_records'),
        eq(auditLog.record_id, id),
        eq(auditLog.action, 'UPDATE')
      )
    )
    .orderBy(asc(auditLog.changed_at))
)

const isEdited = edits.length > 0
// Pass isEdited to UI component for indicator rendering
// Full edit history = edits array with old_data/new_data per entry
```

The `audit_log_table_name_record_id_idx` index exists for exactly this query pattern (defined in Phase 1 schema).

### Anti-Patterns to Avoid

- **Application-level audit inserts:** Never insert to `audit_log` directly from Server Actions — the SECURITY DEFINER trigger handles it. Application inserts would create duplicate entries and can be bypassed if a developer forgets.
- **Soft-delete via a `deleted_at` column:** The requirement is explicit: use `voided` not deletion. `deleted_at` implies records disappear over time; `voided` keeps them permanently visible in the audit trail with a reason.
- **DB-level 48-hour constraint:** A CHECK constraint cannot reference `NOW()` reliably in a multi-timezone deployment. Enforce in the Server Action where you can read the threshold and return a structured error to the UI.
- **Single table for both processing and dispatch lines:** Keep `processing_report_lines` and `outbound_dispatch_lines` separate — their schemas are different (size buckets vs. SKU codes) and they serve different query patterns.
- **Querying audit_log without the index:** Always filter by both `table_name` AND `record_id`. The composite index `audit_log_table_name_record_id_idx` makes this fast; filtering by `record_id` alone scans the full table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit log capture | Custom application-level audit logger | `audit_log_trigger()` already in DB (Phase 1) | DB trigger is unbypassable; app-level logger is optional and can be omitted by developers |
| Field-level diff display | Custom diffing library | Compare `old_data`/`new_data` JSONB in Server Action | The trigger already stores both snapshots; simple Object.keys comparison is sufficient |
| Void/soft-delete | Third-party soft-delete library | `voided boolean + void_reason text` columns + WHERE clause | The schema is simple enough that a library adds no value; query filter is 1 line of Drizzle |
| Size bucket validation | Custom enum parser | Drizzle `pgEnum` for `size_bucket_enum` | Enum enforced at DB level; Drizzle generates TypeScript types automatically |
| Edit lock timer | Client-side countdown UI | Server-side age check in Server Action | Lock enforcement must be server-side; client countdown is UI sugar only and does not prevent API calls |

**Key insight:** The audit trail infrastructure is already built. Phase 6 is almost entirely about attaching it to new tables and building the UI to surface it.

---

## Schema Design

### `processing_reports` table

```typescript
// packages/db/src/schema/processing.ts
export const activityTypeEnum = pgEnum('activity_type', ['wash', 'pack'])

export const processingReports = pgTable('processing_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  prison_facility_id: uuid('prison_facility_id').notNull()
    .references(() => prisonFacilities.id),
  intake_record_id: uuid('intake_record_id')
    .references(() => intakeRecords.id),    // nullable: processing can link to intake
  tenant_id: text('tenant_id').notNull()
    .references(() => tenants.id),
  staff_name: text('staff_name').notNull(),
  activity_type: activityTypeEnum('activity_type').notNull(), // 'wash' | 'pack'
  product_id: uuid('product_id').notNull()
    .references(() => products.id),
  report_date: timestamp('report_date').notNull(),
  notes: text('notes'),
  voided: boolean('voided').notNull().default(false),
  void_reason: text('void_reason'),
  submitted_by: uuid('submitted_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, ...)

export const sizeBucketEnum = pgEnum('size_bucket', [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'
])

export const processingReportLines = pgTable('processing_report_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  processing_report_id: uuid('processing_report_id').notNull()
    .references(() => processingReports.id, { onDelete: 'cascade' }),
  size_bucket: sizeBucketEnum('size_bucket'),  // nullable: null = bag/non-clothing total
  quantity: integer('quantity').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, ...)
```

### `outbound_dispatches` table

```typescript
// packages/db/src/schema/dispatch.ts
export const dispatchStatusEnum = pgEnum('dispatch_status', [
  'created', 'picked_up', 'delivered'
])

export const outboundDispatches = pgTable('outbound_dispatches', {
  id: uuid('id').primaryKey().defaultRandom(),
  prison_facility_id: uuid('prison_facility_id').notNull()
    .references(() => prisonFacilities.id),
  tenant_id: text('tenant_id').notNull()
    .references(() => tenants.id),
  dispatch_date: timestamp('dispatch_date').notNull(),
  destination: text('destination').notNull(),
  carrier: text('carrier'),                   // nullable
  notes: text('notes'),
  status: dispatchStatusEnum('status').notNull().default('created'),
  voided: boolean('voided').notNull().default(false),
  void_reason: text('void_reason'),
  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, ...)

export const outboundDispatchLines = pgTable('outbound_dispatch_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  outbound_dispatch_id: uuid('outbound_dispatch_id').notNull()
    .references(() => outboundDispatches.id, { onDelete: 'cascade' }),
  product_id: uuid('product_id').notNull()
    .references(() => products.id),
  size_bucket: sizeBucketEnum('size_bucket'),  // reuse from processing schema
  sku_code: text('sku_code'),                  // nullable
  quantity: integer('quantity').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, ...)
```

### Voided columns on existing tables

The `voided` and `void_reason` columns must be added to `intake_records` via ALTER TABLE in the Phase 6 migration. They are not in the Phase 5 schema.

### RLS patterns

Processing reports and outbound dispatches follow the identical RLS pattern from `intake.ts`:
- Restrictive deny-all base policy (`USING(false)`)
- prison role SELECT/INSERT: `prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`
- prison role has NO UPDATE or INSERT on `outbound_dispatches` (DISPATCH-04: view only)
- reco role SELECT: `true` (read-all)
- reco-admin: full CRUD, `USING(true)`, `WITH CHECK(true)`

---

## Common Pitfalls

### Pitfall 1: Forgetting the voided columns on `intake_records`

**What goes wrong:** Phase 5 created `intake_records` without `voided`/`void_reason`. Phase 6 requires them. If the ALTER TABLE migration is omitted, the void Server Action will fail at runtime with a column-not-found error — not a compile error, because Drizzle schema types won't match the DB.

**Why it happens:** It is easy to update the Drizzle schema file without writing the corresponding ALTER TABLE in the manual migration.

**How to avoid:** The Phase 6 migration SQL must include `ALTER TABLE intake_records ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false` and the void_reason equivalent. Also update `packages/db/src/schema/intake.ts` to add these two columns.

**Warning signs:** Drizzle `generate` shows a diff for `intake_records` — that diff is correct and must be applied.

### Pitfall 2: Duplicate audit entries from trigger + application code

**What goes wrong:** A developer adds a manual `db.insert(auditLog).values(...)` call in a Server Action "just to be safe" — the trigger also fires on that same UPDATE, creating two audit entries for one edit.

**Why it happens:** The trigger is invisible in TypeScript code; developers may not realise it fires automatically.

**How to avoid:** Never insert to `audit_log` from application code. The trigger is SECURITY DEFINER and fires unconditionally on INSERT/UPDATE/DELETE. Document this once in the schema file comment.

### Pitfall 3: 48-hour lock check uses wrong timestamp

**What goes wrong:** The edit lock checks `updated_at` instead of `created_at`. After the first edit, `updated_at` resets, effectively extending the lock window on every edit.

**Why it happens:** `updated_at` is visually similar to "when the record was submitted".

**How to avoid:** The lock MUST use `created_at` (original submission time), never `updated_at`.

### Pitfall 4: Traceability chain breaks when pickup_id is null

**What goes wrong:** `intake_records.pickup_id` is nullable (unexpected deliveries). The traceability chain query fails or returns null for the pickup leg.

**Why it happens:** The null case is not handled in the traceability assembly function.

**How to avoid:** The `getTraceabilityChain` action must handle `pickup_id = null` gracefully — return the intake segment with a note that no pickup request exists for this delivery.

### Pitfall 5: size_bucket enum import collision

**What goes wrong:** `sizeBucketEnum` is defined in `processing.ts` and re-used in `dispatch.ts`. If both files define it independently with the same name, Drizzle generates conflicting migrations.

**Why it happens:** Copy-paste between schema files.

**How to avoid:** Define `sizeBucketEnum` once in `processing.ts` and import it into `dispatch.ts`. Only one `CREATE TYPE size_bucket AS ENUM (...)` should appear in migrations.

### Pitfall 6: RLS blocks audit_log reads

**What goes wrong:** The `audit_log` table has no RLS policies (by design — accessible only via application queries with reco-admin role per the schema comment in `audit.ts`). If a prison-role user tries to query it, they get zero rows without an error.

**Why it happens:** The "edited" indicator query runs under `withRLSContext(user)` for both roles. Prison role RLS on `audit_log` is absent — the deny-all restrictive policy would block the query.

**How to avoid:** The edited indicator query for prison staff should either: (a) use raw `db` (no RLS context) since it is non-sensitive display information, or (b) add a permissive SELECT policy on `audit_log` for prison_role restricted to `prison_facility_id` matching. Option (a) is simpler and consistent with Phase 5 patterns (Phase 5 uses `db` raw for cross-tenant queries that RLS blocks).

Simpler: compute `is_edited` server-side in the page Server Component using raw db, pass as a prop to the indicator component. The edit history modal (AUDITVIEW from v2 requirements) is out of scope; Phase 6 only needs the boolean indicator + a read-only list of edits.

### Pitfall 7: Prison staff UPDATE RLS missing on `intake_records`

**What goes wrong:** Phase 5 only granted `SELECT, INSERT` to `prison_role` on `intake_records`. Phase 6 introduces prison-role edits within 48 hours. Without a `UPDATE` policy and GRANT, the Server Action UPDATE will be silently blocked by RLS.

**Why it happens:** The Phase 5 migration did not include UPDATE for prison_role (intentional at the time — no edits were needed).

**How to avoid:** The Phase 6 migration must add:
```sql
GRANT UPDATE ON intake_records TO prison_role;
GRANT UPDATE ON processing_reports TO prison_role;
```
And add permissive UPDATE RLS policies on both tables for prison_role scoped to `prison_facility_id`.

---

## Code Examples

Verified patterns from the existing codebase:

### Attaching existing audit trigger to a new table (migration SQL)
```sql
-- Source: 0001_rls_and_triggers.sql pattern (Phase 1)
-- The function audit_log_trigger() already exists — just create the trigger binding

CREATE TRIGGER audit_processing_reports
  AFTER INSERT OR UPDATE OR DELETE ON processing_reports
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_outbound_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON outbound_dispatches
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_intake_records
  AFTER INSERT OR UPDATE OR DELETE ON intake_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
```

### requireRecoAdmin pattern (ops actions)
```typescript
// Source: apps/web/app/(ops)/intake/actions.ts — Phase 5 established this
async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  return { ...session.user, sub: session.user.id! }
}
```

### Querying audit log for edited indicator
```typescript
// Source: packages/db/src/schema/audit.ts — audit_log_table_name_record_id_idx supports this
import { auditLog } from '@repo/db'
import { and, eq } from 'drizzle-orm'

// Use raw db — audit_log has no RLS; consistent with Phase 5 pattern for cross-policy reads
const edits = await db
  .select({
    id: auditLog.id,
    changed_at: auditLog.changed_at,
    changed_by: auditLog.changed_by,
    old_data: auditLog.old_data,
    new_data: auditLog.new_data,
  })
  .from(auditLog)
  .where(
    and(
      eq(auditLog.table_name, 'intake_records'),
      eq(auditLog.record_id, intakeRecordId),
      eq(auditLog.action, 'UPDATE')
    )
  )

const isEdited = edits.length > 0
```

### Processing report form — size bucket vs. total quantity mode
```typescript
// Source: project pattern (react-hook-form + dynamic fields from Phase 4/5 forms)
// Clothing mode: one input per size bucket
const SIZE_BUCKETS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const

// In form component:
const isClothing = selectedProduct?.product_category === 'clothing'

return isClothing
  ? SIZE_BUCKETS.map(bucket => (
      <QuantityInput key={bucket} label={bucket} name={`lines.${bucket}`} />
    ))
  : <QuantityInput label="Total antal" name="lines.total" />
```

### FormData indexed lines pattern (established in Phase 4 + 5)
```typescript
// Source: apps/web/app/prison/actions.ts — submitIntake uses this pattern
// Processing report lines encoded as: lines[XXS][quantity], lines[XS][quantity], etc.
for (const [key, value] of formData.entries()) {
  const match = key.match(/^lines\[(\w+)\]\[quantity\]$/)
  if (match) {
    const bucket = match[1]!
    linesMap.set(bucket, parseInt(value as string, 10))
  }
}
```

### Drizzle deny-all base + permissive layered RLS (established pattern)
```typescript
// Source: packages/db/src/schema/intake.ts — identical pattern for all new tables
pgPolicy('processing_reports_deny_all', {
  as: 'restrictive',
  for: 'all',
  using: sql`false`,
}),
pgPolicy('processing_reports_prison_select', {
  as: 'permissive',
  to: prisonRole,
  for: 'select',
  using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
}),
pgPolicy('processing_reports_prison_insert', {
  as: 'permissive',
  to: prisonRole,
  for: 'insert',
  withCheck: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
}),
pgPolicy('processing_reports_reco_admin_all', {
  as: 'permissive',
  to: recoAdminRole,
  for: 'all',
  using: sql`true`,
  withCheck: sql`true`,
}),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| App-level audit logging (beforeUpdate hooks, interceptors) | DB trigger with SECURITY DEFINER | Phase 1 of this project | Unbypassable — trigger fires for every modification regardless of code path |
| Soft delete with `deleted_at` | `voided` boolean + `void_reason` reason column | Requirement decision (AUDIT-04) | Records remain in all queries (with filter), reason is always stored |
| Separate i18n routing config | next-intl `getRequestConfig` scoped to prison layout | Phase 5 | Prison-only Danish without full App Router locale routing |

---

## Open Questions

1. **Processing report linked to intake record**
   - What we know: `intake_record_id` on `processing_reports` is marked nullable in the schema design above
   - What's unclear: Is a processing report always linked to a specific intake record, or can it be submitted independently of any specific intake (e.g. for backlog processing from historical records)?
   - Recommendation: Make `intake_record_id` nullable for flexibility. The pipeline view can show unlinked processing reports. The traceability chain only follows the link when it exists.

2. **`product_category` column vs. form-level heuristic for clothing detection**
   - What we know: Wolt's product set is known (Bike Bag, Car Bag, Inner Bag, Heating Plate, Clothing)
   - What's unclear: Whether adding `product_category` enum to `products` is justified for Phase 6, or a simpler boolean `is_clothing` suffices
   - Recommendation: Add `product_category enum('clothing', 'bag', 'equipment', 'other')` to `products` in the Phase 6 migration. Seed existing Wolt products. This is one migration column and unlocks correct processing form behaviour for all future product types.

3. **Pipeline stage derivation logic**
   - What we know: PROCESS-03 requires stages: awaiting processing, in progress, ready to ship, shipped
   - What's unclear: Exact rules for each stage — e.g. does "awaiting processing" mean intake received but no wash report yet? Does "ready to ship" mean packed but no dispatch created?
   - Recommendation: Define stages as:
     - `awaiting_processing`: intake_record exists, no processing_reports for this intake
     - `in_progress`: at least one wash report exists, no pack report yet
     - `ready_to_ship`: pack report exists, no outbound_dispatch linked
     - `shipped`: outbound_dispatch exists for this intake/processing chain

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
| PROCESS-01 | submitProcessingReport rejects non-prison role | unit | `pnpm --filter @repo/web test -- --grep "submitProcessingReport"` | ❌ Wave 0 |
| PROCESS-02 | submitProcessingReport validates activity_type, product_id, lines | unit | `pnpm --filter @repo/web test -- --grep "submitProcessingReport"` | ❌ Wave 0 |
| PROCESS-02 | Size bucket lines: one row per bucket for clothing, one total for bags | unit | `pnpm --filter @repo/web test -- --grep "size.bucket\|processingLines"` | ❌ Wave 0 |
| AUDIT-01 | editIntakeRecord stores old/new data via audit trigger | unit (stub) | `pnpm --filter @repo/web test -- --grep "editIntakeRecord"` | ❌ Wave 0 |
| AUDIT-02 | editIntakeRecord returns edit_locked when record > 48 hours old | unit | `pnpm --filter @repo/web test -- --grep "edit_locked\|48"` | ❌ Wave 0 |
| AUDIT-03 | reco-admin edit bypasses 48-hour check | unit | `pnpm --filter @repo/web test -- --grep "reco-admin.*edit\|admin.*bypass"` | ❌ Wave 0 |
| AUDIT-04 | voidRecord sets voided=true with reason; returns error for empty reason | unit | `pnpm --filter @repo/web test -- --grep "voidRecord\|voided"` | ❌ Wave 0 |
| AUDIT-05 | isEdited returns true when audit_log has UPDATE for record | unit | `pnpm --filter @repo/web test -- --grep "isEdited\|edited.*indicator"` | ❌ Wave 0 |
| DISPATCH-01 | createDispatch rejects non-reco-admin role | unit | `pnpm --filter @repo/web test -- --grep "createDispatch"` | ❌ Wave 0 |
| DISPATCH-03 | updateDispatchStatus enforces created→picked_up→delivered ordering | unit | `pnpm --filter @repo/web test -- --grep "updateDispatchStatus\|dispatch.*status"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @repo/web test`
- **Per wave merge:** `pnpm --filter @repo/web test && pnpm --filter @repo/db test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/app/prison/processing/actions.test.ts` — stubs for PROCESS-01, PROCESS-02
- [ ] `apps/web/app/(ops)/dispatch/actions.test.ts` — stubs for DISPATCH-01, DISPATCH-03
- [ ] `apps/web/app/(ops)/intake/actions.test.ts` — extend with stubs for AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05 (file already exists from Phase 5)
- [ ] `apps/web/lib/edit-lock.test.ts` — stubs for 48-hour lock pure function (if extracted)
- [ ] `apps/web/lib/pipeline-stage.test.ts` — stubs for stage derivation pure function

---

## Sources

### Primary (HIGH confidence)

- `packages/db/src/schema/audit.ts` — `audit_log` table schema, `AUDIT_TRIGGER_SQL` constant, trigger binding pattern
- `packages/db/migrations/0001_rls_and_triggers.sql` — actual deployed trigger function and bindings for Phase 1 tables
- `packages/db/migrations/0004_intake_trigger_rls.sql` — Phase 5 migration pattern (FORCE RLS, GRANTs, per-year sequence trigger)
- `packages/db/src/schema/intake.ts` — RLS policy structure: deny-all restrictive + layered permissive per role
- `apps/web/app/prison/actions.ts` — `requirePrisonSession()`, `withRLSContext()` usage, FormData indexed lines parsing
- `apps/web/app/(ops)/intake/actions.ts` — `requireRecoAdmin()`, raw db usage for cross-policy queries, aggregate SQL via `tx.execute(sql\`...\`)`
- `apps/web/package.json` — installed library versions confirmed
- `.planning/STATE.md` — key decisions: audit assigned to Phase 6, withRLSContext pattern, FORCE RLS pattern

### Secondary (MEDIUM confidence)

- Phase 5 research + plan wave structure — wave cadence: schema first (Wave 1), Server Actions (Wave 2), UI (Wave 3+)
- `messages/da.json` — existing Danish translation structure to extend for processing/dispatch labels

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages confirmed installed from package.json
- Architecture: HIGH — patterns directly observed in Phase 5 codebase (actions.ts, schema files, migrations)
- Pitfalls: HIGH — derived from actual code review (RLS GRANT omissions, timestamp column selection, audit_log RLS absence)
- Schema design: HIGH — follows identical structural patterns to intake.ts and transport.ts
- Open questions: MEDIUM — pipeline stage semantics and product_category design not documented in requirements

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack; no fast-moving dependencies)
