# Phase 4: Pickup Booking and Transport Management - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the complete pickup booking workflow (client-facing form to submission) and the full reco-admin/transport transport management layer — replacing Google Sheets as the operational record of truth for pickup and transport workflows. A client user can book a pickup through the platform; reco-admin can confirm, book transport (direct or consolidation), and manage the end-to-end status lifecycle. Consolidation providers get a warehouse inventory view and can create outbound shipments with pro-rata cost allocation.

</domain>

<decisions>
## Implementation Decisions

### Pickup Booking Form
- Product quantities displayed as a scrollable table with one row per product from the client's registry and a number input per row — consistent with Phase 3's inline editable material composition table
- Photo upload supports both drag-and-drop and click-to-pick (file picker fallback) — consistent with product photo upload in Phase 3
- 72-hour lead time enforced as a hard block: date picker disables all dates within 72h of submission; no override possible
- Pallet count is entered manually; total estimated weight is auto-calculated (unit weight × quantity per product + pallet weight × pallet count) — no manual weight entry required on the form

### Status & Queue Management
- reco-admin pickup queue is a single table with status filter tabs (submitted / confirmed / transport_booked / etc.) — consistent with ops portal table + tabs pattern
- Status transitions and transport booking actions live within the pickup detail page (not inline table buttons) — keeps the queue table clean
- Cancellation requires a confirmation modal with a reason textarea (applies to both client self-cancel and reco-admin cancel with reason)
- Client users access their pickup list from a dedicated "Pickups" page in the client portal — consistent with the ops portal "Products" primary nav pattern; dashboard comes in Phase 8

### Transport Management UX
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema/` — all tables follow pgTable + pgPolicy pattern; add `pickups.ts`, `transport.ts` files here
- `apps/web/app/(ops)/products/` — full CRUD page pattern: `page.tsx` (list), `new/page.tsx` (create), `[id]/page.tsx` (detail) + `actions.ts`; replicate for pickups and transport
- `apps/web/app/(ops)/ops-nav-bar.tsx` — add "Pickups" and "Transport" to ops nav
- `apps/web/app/(client)/overview/` — client portal; add "Pickups" to client nav
- `apps/web/components/ui/` — shadcn/ui library: table, tabs, form, dialog, checkbox, date-picker, number input, dropzone
- `packages/types/src/auth.ts` — UserRole type for RLS policies

### Established Patterns
- Drizzle ORM with `snake_case` columns; `pgPolicy` restrictive deny-all + permissive allow per role
- shadcn/ui + Tailwind CSS v4; reco brand tokens as CSS custom properties
- Server Actions for mutations (not Route Handlers for internal CRUD)
- `auth()` on server for session; never raw JWT claims
- `tenant_id` on every tenant-scoped table; RLS enforces isolation
- Product `total_weight` (grams) already on product records — usable for auto-weight calculation
- Product photos use drag-and-drop + file picker pattern — replicate for pickup photos

### Integration Points
- `packages/db/src/schema/products.ts` — product list (with `total_weight`) pre-populated per tenant from Phase 3; pickup form reads this for quantity inputs
- `packages/db/src/schema/settings.ts` — `prison_facilities` and system settings (warehouse ageing threshold) already seeded in Phase 1; transport booking reads facility list
- Phase 5 (Prison Intake) will link intake records to pickup IDs — pickup schema must expose stable IDs
- Phase 8 (Dashboards) will aggregate pickup status counts and transport data

</code_context>

<specifics>
## Specific Ideas

- Weight calculation model: `SUM(product.total_weight × line.quantity) + (pallet_count × standard_pallet_weight_grams)` — standard pallet weight should be a configurable system setting (add to Phase 1 settings table or hardcode initially at Claude's discretion)
- Pro-rata outbound shipment cost split: default is pallet-count proportional, but each pickup's allocated cost is individually editable before confirmation; running total displayed so admin can verify allocations sum to total

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>
