# Phase 3: Product Registry - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the complete product registry: reco-admin can create and manage a full product catalogue per tenant, including material composition with disassembly photos, product identification photos, and time-bounded pricing records. The global material library supports consistent naming across tenants. Wolt's 5 products are pre-loaded with full material compositions and pricing at deployment via a Drizzle seed script.

</domain>

<decisions>
## Implementation Decisions

### Product Navigation & CRUD Flow
- Product registry is a top-level nav item "Products" in the ops portal (alongside Dashboard, Settings) — it's a primary management area, not a settings sub-section
- Product detail renders as a full page (`/products/[id]`) — the product has enough sub-sections (photos, materials, pricing) to warrant dedicated space
- reco-admin only can create and edit products; no edit access for reco or other roles
- Wolt products are pre-loaded via a Drizzle seed/migration script executed at deploy — stays in version control, reproducible

### Material Composition UX
- Material composition lines are edited inline in an editable table within the product detail page — add row, fill fields inline, save with the product
- Material library selection uses a searchable combobox (shadcn Command component) — type to filter the global `material_library` table
- reco-admin can add new materials to the global library inline via an "Add new material" option in the combobox — creates the library entry immediately
- Material history (effective_from/to) is auto-managed in the backend; the UI only shows the current composition — backend transparently stores history when composition changes

### Product Photos
- **Two distinct photo types per product:**
  1. **Product identification photos** (up to 5): standard product shots for recognition; uploaded via drag-and-drop dropzone with file picker fallback
  2. **Material disassembly photos** (up to 2 per material line): show how to separate that specific material from this specific product; stored on the `product_materials` join record, not the global material library
- Product photos displayed as a thumbnail grid (2–3 per row) below the upload zone; click to enlarge, X to remove
- Material disassembly photos shown inline within the material composition table row (compact 2-thumbnail strip per material line)
- Storage paths:
  - Product photos: `{tenant_id}/products/{product_id}/photos/{filename}`
  - Material disassembly photos: `{tenant_id}/products/{product_id}/materials/{material_id}/{filename}`

### Pricing Records
- UI shows the current price prominently with a "View price history" expander — history is accessible but not the primary view
- Pricing records store both EUR and DKK values per record (consistent with PRD §4.10 which specifies both currencies for Wolt products)
- When a new price record is created, the system automatically closes the previous record by setting its `effective_to` = new record's `effective_from` − 1 day
- reco-admin only can manage pricing records — pricing is sensitive master data

### Claude's Discretion
- Exact shadcn component choices for the inline editable material composition table
- RLS policy details for the Supabase Storage buckets (product photos, material photos)
- Specific Drizzle migration/seed file structure for Wolt product pre-load
- Processing stream enum values beyond "recycling" and "reuse"
- Recycling outcome enum values for material composition lines

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema/` — all existing tables follow pgTable + pgPolicy pattern; add `products.ts`, `materials.ts` files here
- `packages/db/src/schema/index.ts` — exports all schemas; extend with new files
- `apps/web/app/(ops)/` — ops portal app directory; add `products/` route group here
- `apps/web/components/ui/` — full shadcn/ui library available: table, dialog, form, input, button, command (combobox), tabs
- `apps/web/app/(ops)/settings/actions.ts` — Server Actions pattern; replicate for product mutations
- `packages/types/src/auth.ts` — UserRole type; use for RLS policy role constants

### Established Patterns
- Drizzle ORM with `snake_case` columns; `pgPolicy` with restrictive deny-all base + permissive allow per role
- shadcn/ui + Tailwind CSS v4; reco brand tokens as CSS custom properties
- Server Actions for mutations (not Route Handlers for internal CRUD)
- `auth()` on server for session; never raw JWT claims
- `tenant_id` on every tenant-scoped table; RLS enforces isolation

### Integration Points
- `packages/db/src/schema/index.ts` — add exports for `products.ts` and `materials.ts`
- `apps/web/app/(ops)/layout.tsx` — add "Products" to the ops navigation
- Supabase Storage — new bucket for product/material photos, with RLS bucket policies
- Pickup booking form (Phase 4) will reference the product registry — product list must be queryable by tenant
- Prison intake forms (Phase 5) will reference product list from the client's registry

</code_context>

<specifics>
## Specific Ideas

- Material disassembly photos are **product/material-specific** (not global material library photos) — each combination of product × material can have up to 2 photos showing how to separate that material from that particular product
- This supports a future "disassembly view" for prison staff or processing guidance without cluttering the global material library

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>
