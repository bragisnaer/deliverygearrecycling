# Phase 3: Product Registry - Research

**Researched:** 2026-03-20
**Domain:** Drizzle ORM schema design, Supabase Storage, shadcn/ui inline editing, effective-dated records, Drizzle seed scripts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Product Navigation & CRUD Flow**
- Product registry is a top-level nav item "Products" in the ops portal (alongside Dashboard, Settings)
- Product detail renders as a full page (`/products/[id]`) — dedicated space for photos, materials, pricing
- reco-admin only can create and edit products; no edit access for reco or other roles
- Wolt products pre-loaded via Drizzle seed/migration script executed at deploy — stays in version control, reproducible

**Material Composition UX**
- Material composition lines edited inline in an editable table within the product detail page
- Material library selection uses shadcn Command component (searchable combobox)
- reco-admin can add new materials to the global library inline via "Add new material" option in combobox
- Material history (effective_from/to) auto-managed in backend; UI shows current composition only

**Product Photos**
- Two distinct photo types per product:
  1. Product identification photos (up to 5): drag-and-drop dropzone with file picker fallback
  2. Material disassembly photos (up to 2 per material line): stored on `product_materials` join record
- Product photos displayed as thumbnail grid (2-3 per row); click to enlarge, X to remove
- Material disassembly photos shown inline within material composition table row (compact 2-thumbnail strip)
- Storage paths:
  - Product photos: `{tenant_id}/products/{product_id}/photos/{filename}`
  - Material disassembly photos: `{tenant_id}/products/{product_id}/materials/{material_id}/{filename}`

**Pricing Records**
- UI shows current price prominently + "View price history" expander
- Pricing records store both EUR and DKK values per record
- When new price record created, system auto-closes previous record (effective_to = new effective_from − 1 day)
- reco-admin only can manage pricing records

### Claude's Discretion
- Exact shadcn component choices for the inline editable material composition table
- RLS policy details for the Supabase Storage buckets (product photos, material photos)
- Specific Drizzle migration/seed file structure for Wolt product pre-load
- Processing stream enum values beyond "recycling" and "reuse"
- Recycling outcome enum values for material composition lines

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROD-01 | Each tenant has a product registry; products have: name, product code (unique per tenant), product group, processing stream (recycling/reuse), description, total weight (grams), active flag | Schema design section; `products` table definition |
| PROD-02 | Each product has up to 5 photos (Supabase Storage) | Supabase Storage section; storage path pattern |
| PROD-03 | Each product has one or more material composition lines: material from global library, weight (grams), recycling cost per kg (EUR/DKK), recycling outcome enum | `product_materials` table; material library join pattern |
| PROD-04 | Each product has client-facing pricing records with effective_from/effective_to dates; historical deliveries retain the rate active at time of delivery | Effective-dated pricing pattern; auto-close previous record logic |
| PROD-05 | `product_materials` records have effective_from/effective_to dates to preserve historical ESG calculation accuracy | Temporal join pattern; effective-date management in backend |
| PROD-06 | A global `material_library` table stores canonical material names used across all tenants | Global (non-tenant-scoped) table design; RLS pattern |
| PROD-07 | Wolt products pre-loaded at deployment with full material compositions and pricing from PRD §4.10 | Drizzle seed script pattern; Wolt product data |
| PROD-08 | Product versioning via separate records (e.g. "Bike Bag (2022)", "Bike Bag (2025)"); `product_group` field aggregates related products | Schema field; no schema change needed — naming convention |
</phase_requirements>

---

## Summary

Phase 3 builds three layers: a database schema (two new files: `materials.ts` and `products.ts`), a Supabase Storage bucket with RLS, and a product management UI in the ops portal. The schema is the most complex piece — it must handle effective-dated records for both material composition and pricing, tenant isolation via RLS, and a cross-tenant global material library. Everything else (UI components, server actions, seed script) follows patterns already established in Phases 1-2.

The project uses `postgres-js` directly — Supabase Storage is NOT yet wired up anywhere in the codebase. Installing `@supabase/storage-js` and creating a storage client is a Wave 0 prerequisite. The existing shadcn Command component, react-hook-form, and zod are already installed and used; the inline editable table is the novel UI pattern that needs careful component design.

The Wolt seed data is fully specified in PRD §4.10: five products with weights, material compositions, and pricing. The seed script should be a Drizzle migration-adjacent script that runs idempotently (INSERT ... ON CONFLICT DO NOTHING).

**Primary recommendation:** Build schema first (03-01, 03-02), then Storage setup, then UI (03-03, 03-04), then seed (03-05). The seed script depends on all schema being in place and migrated.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 (already installed) | Schema definition, migrations, queries | Project standard — all existing tables use it |
| postgres | ^3.4.5 (already installed) | PostgreSQL driver | Project standard |
| @supabase/storage-js | ^2.x (needs install) | Supabase Storage uploads and signed URLs | Direct bucket access without Supabase JS client overhead |
| zod | ^3.24.1 (already installed) | Input validation in Server Actions | Project standard — used in all existing actions |
| react-hook-form | ^7.54.0 (already installed) | Form state management | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hookform/resolvers | ^3.9.0 (already installed) | Zod integration with react-hook-form | All forms with zod schemas |
| lucide-react | ^0.469.0 (already installed) | Icons (upload, trash, expand) | Photo grid, table actions |
| sonner | ^1.7.4 (already installed) | Toast notifications for save/error feedback | All mutation results |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/storage-js | uploadthing | uploadthing requires separate service account; Storage-js uses existing Supabase service key already in env |
| @supabase/storage-js | fetch() to Storage REST API | Raw fetch loses typed responses and retry logic |
| Inline editable table | Modal dialogs for each material row | Modal adds navigation steps; inline is locked decision |

**Installation (new dependency only):**
```bash
pnpm add @supabase/storage-js --filter web
```

**Version verification:** `@supabase/storage-js` current version is 2.7.1 (as of 2026-03-20 — verify with `npm view @supabase/storage-js version` before pinning).

---

## Architecture Patterns

### Recommended Project Structure
```
packages/db/src/schema/
├── materials.ts          # material_library table (global, no tenant_id)
├── products.ts           # products, product_materials, product_pricing tables
└── index.ts              # add exports: * from './materials', * from './products'

apps/web/
├── app/(ops)/
│   ├── layout.tsx        # add "Products" nav item
│   └── products/
│       ├── page.tsx      # product list (reco-admin gated)
│       ├── actions.ts    # all product mutations (Server Actions)
│       └── [id]/
│           └── page.tsx  # product detail: photos, materials, pricing
└── lib/
    └── storage.ts        # Supabase Storage client + upload helpers
```

### Pattern 1: Effective-Dated Records (Product Materials + Pricing)

**What:** A record becomes "historical" when a new record for the same entity is created. The backend sets `effective_to` on the old record to `new_effective_from - 1 day`. Only the record with `effective_to IS NULL` is "current".

**When to use:** Both `product_materials` and `product_pricing` use this pattern.

**Server Action logic for adding a new pricing record:**
```typescript
// Source: established pattern — see PRD §4.10 and CONTEXT.md pricing decision
export async function createPricingRecord(data: {
  product_id: string
  price_eur: string
  price_dkk: string
  effective_from: Date
}) {
  await requireRecoAdmin()

  await db.transaction(async (tx) => {
    // 1. Close the previous current record
    const previousEffectiveTo = new Date(data.effective_from)
    previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1)

    await tx
      .update(productPricing)
      .set({ effective_to: previousEffectiveTo, updated_at: new Date() })
      .where(
        and(
          eq(productPricing.product_id, data.product_id),
          isNull(productPricing.effective_to)
        )
      )

    // 2. Insert new current record (effective_to = null = current)
    await tx.insert(productPricing).values({
      product_id: data.product_id,
      price_eur: data.price_eur,
      price_dkk: data.price_dkk,
      effective_from: data.effective_from,
      effective_to: null,
    })
  })

  revalidatePath(`/products/${data.product_id}`)
  return { success: true }
}
```

### Pattern 2: Global (Non-Tenant-Scoped) Table with RLS

**What:** `material_library` is shared across all tenants. Unlike tenant-scoped tables, there is no `tenant_id` column. RLS allows all authenticated roles to SELECT; only reco-admin can INSERT/UPDATE.

**When to use:** Any table that is a shared reference (like the global material library).

```typescript
// Source: established project RLS pattern (see tenants.ts, auth.ts)
export const materialLibrary = pgTable(
  'material_library',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // e.g. "Polyester", "PVC"
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    pgPolicy('material_library_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    pgPolicy('material_library_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco-admin can add materials inline — all other roles read-only
    pgPolicy('material_library_authenticated_read', {
      as: 'permissive',
      to: [recoRole, clientRole], // extend if prison/transport need it
      for: 'select',
      using: sql`true`,
    }),
  ]
)
```

### Pattern 3: Drizzle Seed Script for Wolt Pre-Load

**What:** A standalone TypeScript script in `packages/db/src/` that uses the db client to INSERT Wolt products, materials, and pricing idempotently. Run as part of deploy pipeline after `drizzle-kit migrate`.

**Idempotency:** Use `INSERT ... ON CONFLICT DO NOTHING` via Drizzle's `.onConflictDoNothing()`. Key constraint for products: `product_code` is unique per tenant. Key constraint for `material_library`: `name` is unique globally.

```typescript
// packages/db/src/seed-wolt.ts
import { db } from './db'
import { materialLibrary, products, productMaterials, productPricing } from './schema'

const WOLT_TENANT_ID = 'wolt'

export async function seedWoltProducts() {
  // 1. Seed global material library entries
  await db.insert(materialLibrary)
    .values([
      { name: 'Polypropylene' },
      { name: 'PVC' },
      { name: 'PE+Aluminium' },
      { name: 'Polyester' },
      // ... all unique materials across all five products
    ])
    .onConflictDoNothing() // unique on name

  // 2. Seed products
  const [bikeBag] = await db.insert(products)
    .values({
      tenant_id: WOLT_TENANT_ID,
      name: 'Bike Bag',
      product_code: 'WLT-BB-001',
      product_group: 'Bike Bag',
      processing_stream: 'recycling',
      weight_grams: '2680',
      active: true,
    })
    .onConflictDoNothing()
    .returning()

  // 3. Seed product_materials (effective_from = epoch, effective_to = null)
  // 4. Seed product_pricing
}
```

### Pattern 4: Supabase Storage Client (New — Not Yet in Codebase)

**What:** The project uses `postgres-js` directly and has no Supabase JS client. Storage access requires `@supabase/storage-js` with the service role key for server-side uploads.

**When to use:** All photo uploads (product identification + material disassembly).

```typescript
// apps/web/lib/storage.ts
import { StorageClient } from '@supabase/storage-js'

const STORAGE_URL = `${process.env.SUPABASE_URL}/storage/v1`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side only — service key never exposed to client
export const storageClient = new StorageClient(STORAGE_URL, {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
})

export const productsBucket = storageClient.from('product-photos')

export function getProductPhotoPath(tenantId: string, productId: string, filename: string) {
  return `${tenantId}/products/${productId}/photos/${filename}`
}

export function getMaterialPhotoPath(
  tenantId: string,
  productId: string,
  materialId: string,
  filename: string
) {
  return `${tenantId}/products/${productId}/materials/${materialId}/${filename}`
}
```

**CRITICAL:** `SUPABASE_SERVICE_ROLE_KEY` must never be used client-side. All uploads go through Server Actions. The client sends the file to a Server Action, which uploads to Storage and stores the returned URL in the database.

### Pattern 5: Supabase Storage Bucket RLS for Product Photos

**What:** Supabase Storage has its own RLS separate from table RLS. Bucket policies control which authenticated users can upload to which paths.

**Bucket policy approach:** One bucket (`product-photos`) with path-based policies. Since all uploads are server-side (service key), the bucket can be private with no client-side RLS needed. Public URLs are not required — use signed URLs for display.

**Recommended:** Private bucket + signed URL generation server-side for displaying photos in the UI.

```sql
-- Bucket: product-photos (private)
-- No public access policy needed — server generates signed URLs
-- Service role key bypasses RLS entirely for uploads
```

### Anti-Patterns to Avoid
- **Client-side Storage uploads:** Never send `SUPABASE_SERVICE_ROLE_KEY` to the browser. All uploads must go through a Server Action.
- **Storing photo URLs with expiry:** Signed URLs expire — store only the storage path in the DB, generate signed URLs at render time.
- **Managing effective-dates in the UI:** The UI never sets `effective_to` — only the backend sets it when closing a previous record.
- **Drizzle `numeric` as JavaScript number:** Drizzle maps `numeric` columns to `string` in TypeScript. Always use `toFixed()` or string literals when inserting, and `parseFloat()` when displaying. See: `exchange_rate_eur_dkk.toFixed(4)` in existing `actions.ts`.
- **Missing `withRLSContext` wrapper:** All tenant-scoped product queries must use `withRLSContext()` from `packages/db/src/rls.ts` to set JWT claims before the RLS check fires.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload to object storage | Custom multipart upload handler | `@supabase/storage-js` `.upload()` | Handles multipart, retries, content-type negotiation |
| Searchable combobox / autocomplete | Custom dropdown with filter logic | shadcn Command component | Already installed; handles keyboard nav, async search, empty states |
| Form validation | Custom validator functions | zod + react-hook-form (already installed) | Already the project pattern; consistent error display |
| Signed URL generation | Custom JWT signing for storage | `storageClient.from('bucket').createSignedUrl()` | Supabase handles expiry, path encoding, security |
| Effective-date close logic | UI-driven date field editing | Backend-only transaction (see Pattern 1) | Prevents partial state; atomic close + insert |
| Material name deduplication | Custom normalisation logic | `unique()` constraint on `material_library.name` + `.onConflictDoNothing()` | DB enforces uniqueness; no application-layer dedup needed |

**Key insight:** The inline-editable material composition table is the most novel piece. shadcn does not have a built-in editable table — build it with `<table>` + per-row form state using react-hook-form `useFieldArray`. Each row is a controlled input; saving the whole product saves all rows at once.

---

## Common Pitfalls

### Pitfall 1: Drizzle `numeric` Columns Return Strings
**What goes wrong:** Inserting a JavaScript `number` into a `numeric` column causes a TypeScript error or silent precision loss.
**Why it happens:** Drizzle ORM maps PostgreSQL `numeric`/`decimal` to `string` in TypeScript to avoid float precision errors.
**How to avoid:** For inserts, use `.toFixed(n)` or string literals. For display, use `parseFloat(value)`.
**Warning signs:** TypeScript complaining `number is not assignable to string` on a numeric column; or fractional prices displaying as `4.289999999`.

### Pitfall 2: `withRLSContext` Missing on Product Queries
**What goes wrong:** Product queries return zero rows or throw RLS denial errors in production even though the user is authenticated.
**Why it happens:** The restrictive deny-all policy blocks all queries unless JWT claims are set via `SET LOCAL set_config`. The `db` client alone doesn't set these.
**How to avoid:** All product Server Actions that query tenant-scoped tables must wrap the query in `withRLSContext(session.user, ...)`. The `material_library` global table does not require this (no tenant_id in policy), but `products`, `product_materials`, and `product_pricing` do.
**Warning signs:** Empty product list for a logged-in reco-admin in development.

### Pitfall 3: Storage Path Collision Between Tenants
**What goes wrong:** Two tenants' products share photo storage paths if `tenant_id` is omitted from the path.
**Why it happens:** UUID product IDs are unique globally, but the bucket has no enforced path prefix — the path is just a convention.
**How to avoid:** Always use the full path: `{tenant_id}/products/{product_id}/photos/{filename}`. The storage helper functions (Pattern 4) enforce this.
**Warning signs:** A photo uploaded for one tenant appearing in another tenant's product detail.

### Pitfall 4: Effective-Date Gap if `effective_from` Equals Previous `effective_from`
**What goes wrong:** If a new pricing record has the same `effective_from` date as the current record, the close logic sets `effective_to` = same date - 1 day, which creates a negative range (the old record's `effective_to` < `effective_from`).
**Why it happens:** No constraint prevents duplicate `effective_from` dates.
**How to avoid:** Add a check in the Server Action: if the new `effective_from` <= the current record's `effective_from`, reject with a validation error. Also add a unique constraint on `(product_id, effective_from)` to prevent duplicates at the DB level.
**Warning signs:** Historical ESG calculations returning wrong materials for dates in the gap.

### Pitfall 5: File Size / Type Not Validated Server-Side
**What goes wrong:** Large files or non-image files uploaded through the Server Action cause slow uploads or storage abuse.
**Why it happens:** Client-side validation alone is insufficient — users can bypass it.
**How to avoid:** In the Server Action that handles uploads, validate `file.size <= 5MB` and `file.type` starts with `image/` before calling `storageClient.from(...).upload()`.
**Warning signs:** Very large files appearing in the storage bucket; non-image files uploaded.

### Pitfall 6: `onConflictDoNothing()` Returns Empty Array
**What goes wrong:** The Wolt seed script tries to use a returned product ID for inserting `product_materials`, but `.onConflictDoNothing().returning()` returns an empty array if the row already existed.
**Why it happens:** On conflict → no insert → nothing to return.
**How to avoid:** After the product insert, do a separate SELECT to get the product ID by `product_code`. Or use `.onConflictDoUpdate({ target: ..., set: { updated_at: new Date() } }).returning()` to always get a row back.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'id')` in the seed script on second run.

---

## Code Examples

### Schema: `products` Table
```typescript
// packages/db/src/schema/products.ts
import {
  boolean, index, pgEnum, pgPolicy, pgTable,
  numeric, text, timestamp, uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole } from './auth'
import { tenants } from './tenants'

export const processingStreamEnum = pgEnum('processing_stream', ['recycling', 'reuse'])
export const recyclingOutcomeEnum = pgEnum('recycling_outcome', [
  'recycled', 'reprocessed', 'incinerated', 'landfill',
])

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    product_code: text('product_code').notNull(),   // unique per tenant — enforced by unique index
    product_group: text('product_group'),           // e.g. "Bike Bag" for aggregating versions
    processing_stream: processingStreamEnum('processing_stream').notNull(),
    description: text('description'),
    weight_grams: numeric('weight_grams', { precision: 10, scale: 2 }).notNull(),
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('products_tenant_id_idx').on(t.tenant_id),             // ROUTE-05 requirement
    // product_code unique per tenant
    // uniqueIndex not supported with RLS tables — enforce in application or via unique constraint
    pgPolicy('products_deny_all', { as: 'restrictive', for: 'all', using: sql`false` }),
    pgPolicy('products_reco_admin_all', {
      as: 'permissive', to: recoAdminRole, for: 'all',
      using: sql`true`, withCheck: sql`true`,
    }),
    pgPolicy('products_reco_read', {
      as: 'permissive', to: recoRole, for: 'select', using: sql`true`,
    }),
    pgPolicy('products_client_read', {
      as: 'permissive', to: clientRole, for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
  ]
)
```

### Schema: `product_materials` Table (Effective-Dated Join)
```typescript
export const productMaterials = pgTable(
  'product_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    material_library_id: uuid('material_library_id').notNull().references(() => materialLibrary.id),
    weight_grams: numeric('weight_grams', { precision: 10, scale: 2 }).notNull(),
    recycling_cost_per_kg_eur: numeric('recycling_cost_per_kg_eur', { precision: 10, scale: 4 }),
    recycling_cost_per_kg_dkk: numeric('recycling_cost_per_kg_dkk', { precision: 10, scale: 4 }),
    recycling_outcome: recyclingOutcomeEnum('recycling_outcome'),
    // Disassembly photos: up to 2, stored as array of storage paths
    disassembly_photo_paths: text('disassembly_photo_paths').array(),
    // Effective dating for ESG historical accuracy (PROD-05)
    effective_from: timestamp('effective_from').notNull().defaultNow(),
    effective_to: timestamp('effective_to'),   // null = current
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('product_materials_product_id_idx').on(t.product_id),
    // RLS: product_materials inherits product's tenant scope via JOIN — policy via product_id
    pgPolicy('product_materials_deny_all', { as: 'restrictive', for: 'all', using: sql`false` }),
    pgPolicy('product_materials_reco_admin_all', {
      as: 'permissive', to: recoAdminRole, for: 'all',
      using: sql`true`, withCheck: sql`true`,
    }),
    pgPolicy('product_materials_reco_read', {
      as: 'permissive', to: recoRole, for: 'select', using: sql`true`,
    }),
    pgPolicy('product_materials_client_read', {
      as: 'permissive', to: clientRole, for: 'select',
      // Client can read if the related product belongs to their tenant
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true)
      )`,
    }),
  ]
)
```

### Schema: `product_pricing` Table (Effective-Dated)
```typescript
export const productPricing = pgTable(
  'product_pricing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    price_eur: numeric('price_eur', { precision: 10, scale: 4 }),
    price_dkk: numeric('price_dkk', { precision: 10, scale: 4 }),
    effective_from: timestamp('effective_from').notNull(),
    effective_to: timestamp('effective_to'),   // null = current
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('product_pricing_product_id_idx').on(t.product_id),
    // reco-admin only — pricing is sensitive master data (CONTEXT.md decision)
    pgPolicy('product_pricing_deny_all', { as: 'restrictive', for: 'all', using: sql`false` }),
    pgPolicy('product_pricing_reco_admin_all', {
      as: 'permissive', to: recoAdminRole, for: 'all',
      using: sql`true`, withCheck: sql`true`,
    }),
    pgPolicy('product_pricing_reco_read', {
      as: 'permissive', to: recoRole, for: 'select', using: sql`true`,
    }),
    // client role: NO access to pricing (sensitive per PRD §4.7)
  ]
)
```

### Query: Current Material Composition for a Product
```typescript
// Get current composition (effective_to IS NULL) for a product
import { isNull, eq } from 'drizzle-orm'

const currentComposition = await db
  .select({
    id: productMaterials.id,
    material_name: materialLibrary.name,
    weight_grams: productMaterials.weight_grams,
    recycling_outcome: productMaterials.recycling_outcome,
  })
  .from(productMaterials)
  .innerJoin(materialLibrary, eq(productMaterials.material_library_id, materialLibrary.id))
  .where(
    and(
      eq(productMaterials.product_id, productId),
      isNull(productMaterials.effective_to)
    )
  )
```

### Query: Historical Composition at a Specific Date (for ESG)
```typescript
// For Phase 8 ESG: get composition active at a delivery date
import { lte, or, isNull } from 'drizzle-orm'

const compositionAtDate = await db
  .select()
  .from(productMaterials)
  .where(
    and(
      eq(productMaterials.product_id, productId),
      lte(productMaterials.effective_from, deliveryDate),
      or(
        isNull(productMaterials.effective_to),
        gte(productMaterials.effective_to, deliveryDate)
      )
    )
  )
```

### Wolt Product Data (PRD §4.10) — Seed Reference

| Product | Code | Group | Stream | Weight (g) |
|---------|------|-------|--------|------------|
| Bike Bag | WLT-BB-001 | Bike Bag | recycling | 2,680 |
| Car Bag | WLT-CB-001 | Car Bag | recycling | 918 |
| Inner Bag | WLT-IB-001 | Inner Bag | recycling | 324 |
| Heating Plate | WLT-HP-001 | Heating Plate | recycling | 703 |
| Clothing (PreLoved) | WLT-CL-001 | Clothing | reuse | — |

**Bike Bag materials:** Polypropylene 943g, PVC 386g, PE+Aluminium 296g, Polyester 294g, Foam 292g, Remains 260g, Cotton-polyester 98g, Zipper Metal 54g, POM 37g, Metal Screws 15g, Copper 4g, Nylon 1g

**Car Bag materials:** Polyester 555g, Foam 187g, Aluminum/Foam 90g, Remains 80g, POM 6g

**Inner Bag materials:** Polyester 237g, Aluminum/Foam 62g, Remains 25g

**Heating Plate materials:** Mica Plate 181g, Polypropylene 156g, Aluminum 150g, El (electrical) 146g, Polyester 44g, Foam 26g

**Clothing:** No material composition specified in PRD — weight unknown; note in seed script

**Pricing (effective from deployment date, effective_to = null):**
- Bike Bag: EUR 4.29
- Car Bag: EUR 4.14
- Inner Bag: EUR 4.09
- Heating Plate: EUR 2.99
- Clothing (PreLoved): DKK 35

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase JS client for all DB + Storage | postgres-js for DB; @supabase/storage-js for Storage only | Phase 1 decision | Storage-js must be installed separately; no existing Supabase client to reuse |
| `uniqueIndex` on tenant-scoped tables | `index` + application-layer unique validation for tenant-scoped unique constraints | Drizzle pgPolicy limitation | Must enforce `product_code` uniqueness per tenant in Server Action, not just schema |
| Route Handlers for mutations | Server Actions | Phase 1 decision | No `/api/` routes needed; mutations are `'use server'` functions called directly |

**Deprecated/outdated:**
- Supabase client-side uploads: Never appropriate here — service role key must stay server-side.
- `drizzle-orm/pg-core` `uniqueIndex` with `pgPolicy`: Drizzle does not prevent unique index + RLS conflicts in all cases — use a `unique()` constraint or application-level check.

---

## Open Questions

1. **Clothing product weight**
   - What we know: PRD §4.10 lists "Clothing (PreLoved)" with price DKK 35 but no weight or material composition
   - What's unclear: Is weight_grams required for clothing in the schema (it is per PROD-01)? What materials does clothing contain?
   - Recommendation: Make weight_grams nullable for clothing products in the seed (null = unknown); add a TODO comment in the seed script; do not block Phase 3 on this

2. **Product photo display: signed URLs vs public bucket**
   - What we know: Storage paths are decided; bucket RLS approach is Claude's discretion
   - What's unclear: Signed URLs expire — this adds latency (re-signing on each page render) vs public bucket (no auth, any URL holder can access)
   - Recommendation: Private bucket + signed URLs generated server-side per request (or with long expiry like 1 hour and cached). Product photos are not sensitive but should be tenant-isolated.

3. **product_code uniqueness enforcement**
   - What we know: PROD-01 requires product_code unique per tenant; Drizzle's `unique()` creates a DB-level unique constraint across ALL tenants
   - What's unclear: Whether to use a partial unique index (requires raw SQL migration) or application-layer validation
   - Recommendation: Use application-layer validation in the Server Action (SELECT before INSERT, reject if product_code already exists for tenant) + add a comment. A partial unique index (`CREATE UNIQUE INDEX ... WHERE tenant_id = ...`) is not expressible in Drizzle schema but can be added to the manual migration SQL file.

4. **`disassembly_photo_paths` as array vs separate table**
   - What we know: Up to 2 photos per material line; stored on `product_materials` record
   - What's unclear: Drizzle's `.array()` type maps to PostgreSQL `text[]` — ordering and deletion are simpler than a separate join table
   - Recommendation: Use `text('disassembly_photo_paths').array()` (PostgreSQL native array). With a max of 2 photos, a join table adds unnecessary complexity.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.1.0 |
| Config file | `packages/db/vitest.config.ts` (DB tests) / `apps/web/vitest.config.ts` (UI tests) |
| Quick run command | `pnpm --filter db test` |
| Full suite command | `pnpm --filter db test && pnpm --filter web test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROD-01 | `products` table columns and tenant RLS policies exist | schema/RLS integration | `pnpm --filter db test:rls` | ❌ Wave 0 — add to `schema.test.ts` and `rls.test.ts` |
| PROD-02 | Storage paths are correctly formed (helper functions) | unit | `pnpm --filter web test` | ❌ Wave 0 — `apps/web/lib/storage.test.ts` |
| PROD-03 | `product_materials` table and `material_library` join work; effective_to IS NULL returns current only | schema/RLS integration | `pnpm --filter db test:rls` | ❌ Wave 0 |
| PROD-04 | Creating a new pricing record auto-closes the previous (effective_to set correctly) | unit (Server Action logic) | `pnpm --filter web test` | ❌ Wave 0 — `apps/web/app/(ops)/products/actions.test.ts` |
| PROD-05 | Historical composition query returns correct materials at a given date | unit | `pnpm --filter db test` | ❌ Wave 0 |
| PROD-06 | `material_library` is not tenant-scoped; all authenticated roles can SELECT | RLS integration | `pnpm --filter db test:rls` | ❌ Wave 0 |
| PROD-07 | Wolt seed data: 5 products exist with correct weights, materials, pricing after seed run | integration | `pnpm --filter db test` | ❌ Wave 0 — `packages/db/src/tests/seed.test.ts` |
| PROD-08 | product_group field exists and is queryable | schema | `pnpm --filter db test` | ❌ add to `schema.test.ts` |

### Sampling Rate
- **Per task commit:** `pnpm --filter db test` (schema + RLS)
- **Per wave merge:** `pnpm --filter db test && pnpm --filter web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/db/src/tests/schema.test.ts` — extend with PROD-01, PROD-06, PROD-08 assertions
- [ ] `packages/db/src/tests/rls.test.ts` — extend with PROD-01, PROD-03, PROD-06 RLS policy assertions
- [ ] `packages/db/src/tests/seed.test.ts` — covers PROD-07; verifies Wolt product count + spot-check weights
- [ ] `apps/web/lib/storage.test.ts` — covers PROD-02; unit tests for path helper functions
- [ ] `apps/web/app/(ops)/products/actions.test.ts` — covers PROD-04; unit test for pricing close logic

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/db/src/schema/*.ts` — all RLS patterns, Drizzle column types, pgPolicy structure verified by direct code reading
- Existing codebase: `apps/web/app/(ops)/settings/actions.ts` — Server Action pattern, `requireRecoAdmin()`, numeric column handling, `onConflictDoUpdate`, `revalidatePath`
- Existing codebase: `packages/db/src/rls.ts` — `withRLSContext()` pattern
- PRD §4.10 — Wolt product data (weights, materials, pricing) verified from source document

### Secondary (MEDIUM confidence)
- `@supabase/storage-js` README and docs — StorageClient instantiation pattern; project does not yet use this library but it is the standard Supabase Storage client for non-Supabase-JS stacks
- Drizzle ORM docs — `pgTable`, `pgPolicy`, `numeric` type string mapping, `.array()` column type

### Tertiary (LOW confidence)
- Partial unique index workaround for per-tenant product_code uniqueness — standard PostgreSQL pattern but not yet tested in this specific Drizzle + pgPolicy combination

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing codebase
- Architecture: HIGH — follows existing Phase 1-2 patterns exactly; no new patterns except Storage
- Wolt seed data: HIGH — read directly from PRD §4.10
- Pitfalls: HIGH — `numeric`→string and `withRLSContext` pitfalls confirmed from existing STATE.md decisions
- Storage integration: MEDIUM — `@supabase/storage-js` not yet in codebase; pattern is standard but untested here

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack; no fast-moving dependencies)
