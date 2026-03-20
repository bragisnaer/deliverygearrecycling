# Phase 5: Prison Intake and Counting - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the complete prison intake workflow: facility-pre-authenticated tablet interface in Danish, an incoming deliveries view (expected and unexpected), intake forms with discrepancy detection and batch quarantine, and a discrepancy analytics dashboard for reco-admin. Prison staff can register all incoming deliveries without entering credentials. Expected deliveries pre-populate from transport bookings; discrepancies are auto-detected and reco-admin is notified; batch flag matches trigger quarantine and block submission until overridden.

</domain>

<decisions>
## Implementation Decisions

### Intake Form Layout and Navigation
- Prison home screen shows a prominent "Register Incoming Delivery" primary action button → tap to see expected deliveries list → tap a delivery to open the pre-populated intake form (2 taps maximum)
- Product quantity inputs use large + / − spinner buttons with the current quantity displayed in the centre — tablet-friendly, reduces mis-taps on shared facility tablets
- Discrepancy warnings shown inline (yellow highlight per product row) but do NOT block submission; prison staff can submit; reco-admin is notified automatically. Only confirmed quarantine (batch flag match) blocks submission
- After successful intake submission: success confirmation screen showing client, market, products counted, and reference number; "Register Another Delivery" and "Back to Home" buttons

### Expected vs Unexpected Delivery UX
- Expected deliveries displayed as a card grid — each card shows client name, origin market, expected date, and reference number; tapping opens the pre-populated intake form
- "Expected: X" shown beside each quantity input; when staff changes a value, a badge shows the difference (e.g. "−3 from expected") — visible before submit
- Consolidated shipments shown as collapsible outbound shipment card (showing shipment reference) with nested per-pickup intake forms inside
- History tab on the prison home screen shows the facility's past intake records for the last 30 days with search

### Discrepancy and Quarantine Handling
- Discrepancy warnings: inline yellow warning per product row — "Expected 100, you entered 130 (+30%)" — visible before submit, not just after
- Only confirmed batch flag quarantine blocks submission; discrepancy warnings are non-blocking (submission proceeds, reco-admin notified)
- Quarantine override: "Quarantine Queue" section in the ops portal intake area — admin reviews blocked intake records and clicks "Override and Allow" with a required reason note
- Unexpected delivery alerts surfaced via in-app notification bell in ops portal + badge on intake queue table; email notifications for unexpected deliveries deferred to Phase 9

### Discrepancy Dashboard
- Three-tab layout: By Country, By Product, By Facility — each showing discrepancy rate % with trend arrow over time
- Auto-flag persistent problem market: discrepancy rate >15% in ≥3 of the last 6 months — shown as persistent flag badge on the country row
- Visible to reco-admin and reco roles only (no financial toggle required); not visible to transport providers

### Claude's Discretion
- Exact Danish translation strings for form labels and instructions
- Specific shadcn component selection for spinner inputs (may require custom wrapper around shadcn Input)
- Database trigger vs application-level discrepancy_flagged calculation approach
- RLS policy details for prison role (locked to prison_facility_id from JWT)
- Persistent problem market auto-flag implementation (DB view vs computed column vs application-level)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/prison/login/` — prison login page already exists from Phase 2; prison tablet shell can be built under `apps/web/app/prison/`
- `apps/web/app/(ops)/pickups/` — full CRUD pattern with table, actions.ts, detail page; replicate for ops-side intake queue
- `packages/db/src/schema/pickups.ts` — pickup IDs and status enum already defined; intake records link to pickup IDs
- `packages/db/src/schema/transport.ts` — outbound shipment and transport booking IDs available for consolidation grouping
- `packages/db/src/schema/settings.ts` — prison_facilities table already seeded (Møgelkær, Sdr. Omme, Renbæk)
- `apps/web/components/ui/` — shadcn/ui table, tabs, card, form, badge, dialog components available

### Established Patterns
- Drizzle ORM with `snake_case` columns; `pgPolicy` restrictive deny-all + permissive allow per role
- shadcn/ui + Tailwind CSS v4; reco brand tokens as CSS custom properties
- Server Actions for mutations; `auth()` on server for session
- `tenant_id` on every tenant-scoped table; RLS enforces isolation
- `prison_facility_id` in JWT (from Phase 2 Custom Access Token Hook); prison role locked to facility
- Inline quantity editing with diff indicators established in Phase 3 (material composition table) and Phase 4 (pickup form)
- Tabs + table pattern for ops portal queue views (e.g. pickup queue with status tabs)

### Integration Points
- `packages/db/src/schema/pickups.ts` — pickup requests (status: `delivered`) are the source of expected intake records
- `packages/db/src/schema/transport.ts` — outbound shipments group consolidated pickups; Phase 5 renders these groups in the incoming deliveries view
- `packages/db/src/schema/products.ts` — product registry (per tenant) drives the dynamic quantity input rows on the intake form
- Phase 6 (Processing) will link Wash/Pack reports to intake records — intake schema must expose stable IDs
- Phase 7 (Financial) will auto-create financial records when intake is submitted — intake records must have `delivered_at` and `total_quantities`

</code_context>

<specifics>
## Specific Ideas

- Discrepancy threshold default is 15% (configurable in system settings per INTAKE-06); the auto-flag badge on the discrepancy dashboard uses the same threshold for consistency
- Persistent problem market rule: >15% discrepancy rate in ≥3 of the last 6 rolling months; shown as a "Persistent Issue" badge on the country row in the By Country tab

</specifics>

<deferred>
## Deferred Ideas

- Email notifications for unexpected deliveries — deferred to Phase 9 (Notifications and Manuals)
- Configurable persistent problem market threshold in system settings — hardcoded rule (>15% in 3 of 6 months) sufficient for Phase 5; can be made configurable in a future phase

</deferred>
