---
phase: 05-prison-intake-and-counting
verified: 2026-03-20T21:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Visit /prison on a tablet-sized viewport authenticated as prison role"
    expected: "Danish-language home screen renders with 'Registrer Levering' CTA, no login prompts, facility name in top bar; two taps reach the intake form"
    why_human: "Visual rendering and touch-target feel cannot be verified programmatically"
  - test: "Submit an expected delivery intake form with one quantity above threshold"
    expected: "Amber inline discrepancy badge appears before submit; success screen shows IN-YYYY-NNNN reference and auto-redirects to /prison after 10 seconds"
    why_human: "Live discrepancy badge interaction and auto-redirect timing require a real browser"
  - test: "Enter a batch number that exists in batch_flags on the prison intake form"
    expected: "Red destructive banner appears above submit; submit button shows quarantine-blocked label and is disabled"
    why_human: "Requires a real batch_flags entry in a database; client-side quarantine alert is UI behaviour"
  - test: "Override a quarantined intake record from the ops portal with a 9-character reason"
    expected: "Confirm button remains disabled; error shown when reason is too short"
    why_human: "Dialog interaction and real-time validation UX cannot be tested without a browser"
  - test: "Visit /(ops)/intake/discrepancy and inspect By Country tab"
    expected: "Rows with >15% discrepancy rate shown in amber; persistent problem markets display 'Persistent Issue' destructive badge; trend arrows indicate direction"
    why_human: "Requires live intake_records data; visual colour coding cannot be verified via grep"
---

# Phase 5: Prison Intake and Counting — Verification Report

**Phase Goal:** Prison staff can register all incoming deliveries on facility tablets with Danish-language forms; discrepancies and defective batches are automatically detected and flagged
**Verified:** 2026-03-20T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Prison staff at a pre-authenticated facility tablet can reach the intake form in two taps without entering any login credentials | VERIFIED | `app/prison/layout.tsx` gates on `session.user.role === 'prison'` and redirects to `/prison/login` (not a credential prompt); `app/prison/page.tsx` has primary CTA to `/prison/incoming`; `/prison/incoming` links directly to `/prison/intake/[id]` — two taps confirmed in code |
| 2 | An expected delivery pre-populates client, market, and product list from the linked transport booking; form flags any line exceeding discrepancy threshold | VERIFIED | `getExpectedDelivery()` in `app/prison/actions.ts` fetches pickup + lines; `IntakeForm` renders `QuantitySpinner` per product with `informedQty`; `calculateDiscrepancyPct` in `quantity-spinner.tsx` fires live; `submitIntake` reads `system_settings.discrepancy_alert_threshold_pct` and sets `discrepancy_flagged` |
| 3 | An unexpected delivery can be registered manually by selecting a client from a dropdown; reco-admin receives an alert | VERIFIED | `app/prison/intake/new/page.tsx` renders `UnexpectedIntakeForm`; `submitUnexpectedIntake` in actions.ts sets `is_unexpected: true` and inserts `notifications` row with `type: 'unexpected_intake'` |
| 4 | A batch number matching a flagged entry in batch_flags triggers a quarantine alert; intake cannot be committed without reco-admin override | VERIFIED | `checkBatchFlags()` exported from `app/prison/actions.ts` queries `batchFlags` table; `submitIntake` contains server-side defence-in-depth returning `{ error: 'quarantine_blocked' }` before any insert; `overrideQuarantine()` in `app/(ops)/intake/actions.ts` requires `reason.trim().length >= 10` |
| 5 | The discrepancy dashboard shows discrepancy rates by country, product, and prison facility, and auto-flags persistent problem markets | VERIFIED | `getDiscrepancyByCountry/Product/Facility` in `app/(ops)/intake/actions.ts` use single aggregate GROUP BY SQL with 6-month INTERVAL; `getMonthlyDiscrepancyByCountry` calls `isPersistentProblemMarket()`; `discrepancy-tabs.tsx` renders `Badge variant="destructive"` for persistent markets with `TrendingUp`/`TrendingDown` arrows |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/intake.ts` | intake_records, intake_lines, batch_flags table definitions with RLS | VERIFIED | Exports `intakeRecords` (line 23), `intakeLines` (line 107), `batchFlags` (line 173); prison_facility_id FK, quarantine fields, discrepancy_pct column all present |
| `packages/db/src/schema/index.ts` | Re-exports intake schema | VERIFIED | Line 12: `export * from './intake'` |
| `packages/db/migrations/0004_intake_trigger_rls.sql` | IN-YYYY-NNNN trigger, FORCE RLS, GRANTs | VERIFIED | `generate_intake_reference()` function present; `ALTER TABLE intake_records FORCE ROW LEVEL SECURITY` confirmed; IN-YYYY-NNNN pattern confirmed |
| `apps/web/lib/discrepancy.ts` | calculateDiscrepancyPct pure function | VERIFIED | Exported at line 8; used in `quantity-spinner.tsx` and `submitIntake` |
| `apps/web/lib/persistent-flag.ts` | isPersistentProblemMarket pure function | VERIFIED | Exported at line 11; used in `app/(ops)/intake/actions.ts` line 349 |
| `apps/web/app/prison/layout.tsx` | Prison tablet shell with NextIntlClientProvider and role gate | VERIFIED | `NextIntlClientProvider` at line 20; role check redirects to `/prison/login` at lines 10 and 14 |
| `apps/web/app/prison/page.tsx` | Prison home screen with primary CTA | VERIFIED | Uses `useTranslations('intake.home')`; CTA at line 18 via `t('primary_cta')` |
| `apps/web/messages/da.json` | Danish translation strings | VERIFIED | Contains `"intake"` key with home, form, discrepancy, quarantine, success, and errors sub-keys |
| `apps/web/i18n/request.ts` | next-intl server config | VERIFIED | `getRequestConfig` exported; returns `locale: 'da'` |
| `apps/web/next.config.ts` | Wrapped with createNextIntlPlugin | VERIFIED | `createNextIntlPlugin('./i18n/request.ts')` at line 2 |
| `apps/web/app/(ops)/ops-nav-bar.tsx` | Intake nav link | VERIFIED | `{ label: 'Intake', href: '/intake' }` at line 10 |
| `apps/web/app/prison/incoming/page.tsx` | Expected deliveries card grid | VERIFIED | Calls `getExpectedDeliveries()`; `grid grid-cols-1 gap-4 md:grid-cols-2`; `<details>` element for consolidated cards; links to `/prison/intake/[id]` and `/prison/intake/new` |
| `apps/web/app/prison/actions.ts` | Server Actions: getExpectedDeliveries, getExpectedDelivery, submitIntake, checkBatchFlags, submitUnexpectedIntake, getClientsForIntake | VERIFIED | All six exports confirmed; `requirePrisonSession()` guards all prison actions; `withRLSContext` used throughout |
| `apps/web/app/prison/components/quantity-spinner.tsx` | Quantity spinner with +/- buttons and discrepancy badge | VERIFIED | `calculateDiscrepancyPct` imported and called; `aria-label` attributes present; amber styling for discrepancy |
| `apps/web/app/prison/components/intake-form.tsx` | IntakeForm with quantity spinners and quarantine UI | VERIFIED | Calls `submitIntake`; renders `QuantitySpinner`; `quarantineFlags` state drives destructive alert banner |
| `apps/web/app/prison/intake/[id]/page.tsx` | Expected delivery intake form page | VERIFIED | Calls `getExpectedDelivery()`; renders `<IntakeForm>` |
| `apps/web/app/prison/intake/[id]/success/page.tsx` | Post-submit success confirmation | VERIFIED | Uses `t('register_another')` and `t('go_home')`; delegates auto-redirect to `AutoRedirect` component |
| `apps/web/app/prison/intake/[id]/success/auto-redirect.tsx` | Timer with proper cleanup | VERIFIED | `useRef` holds timeout; `clearTimeout` called in `useEffect` cleanup; `hasRedirected` guard prevents double-navigation |
| `apps/web/app/prison/intake/new/page.tsx` | Unexpected delivery form page | VERIFIED | Renders `<UnexpectedIntakeForm clients={clients} threshold={threshold} />` |
| `apps/web/app/prison/components/unexpected-intake-form.tsx` | Unexpected intake form with client dropdown | VERIFIED | Uses shadcn `Select` for client; renders `QuantitySpinner` for quantities |
| `apps/web/app/(ops)/intake/actions.ts` | overrideQuarantine, getQuarantinedIntakes, getIntakeQueue, getDiscrepancyBy* | VERIFIED | All eight functions confirmed; `reason.trim().length < 10` validation; GROUP BY aggregate SQL; `isPersistentProblemMarket` called |
| `apps/web/app/(ops)/intake/page.tsx` | Ops intake queue with tabs | VERIFIED | Imports and calls `getIntakeQueue`; renders tab structure |
| `apps/web/app/(ops)/intake/components/intake-queue-table.tsx` | Intake records table with status badges | VERIFIED | `Badge variant="outline"` for Unexpected; `Badge variant="destructive"` for Quarantine; `QuarantineOverrideDialog` imported |
| `apps/web/app/(ops)/intake/components/quarantine-override-dialog.tsx` | Override dialog with reason textarea | VERIFIED | Calls `overrideQuarantine`; `MIN_REASON_LENGTH = 10`; confirm button `disabled={!isValid \|\| isPending}` |
| `apps/web/app/(ops)/intake/discrepancy/page.tsx` | Discrepancy analytics dashboard | VERIFIED | Fetches all three datasets in parallel; calls `getMonthlyDiscrepancyByCountry`; renders `DiscrepancyTabs` |
| `apps/web/app/(ops)/intake/discrepancy/components/discrepancy-tabs.tsx` | Three-tab discrepancy view | VERIFIED | `TrendingUp`/`TrendingDown` from lucide; `Badge variant="destructive"` for persistent markets; amber styling for >15% rates |
| `apps/web/app/prison/actions.test.ts` | Wave 0 stubs for prison actions | VERIFIED | 6 `it.todo()` stubs covering INTAKE-01/03/04/05/06/07 |
| `apps/web/app/(ops)/intake/actions.test.ts` | Wave 0 stubs for ops intake actions | VERIFIED | 2 `it.todo()` stubs covering INTAKE-07 overrideQuarantine |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/src/schema/intake.ts` | `packages/db/src/schema/index.ts` | re-export | WIRED | `export * from './intake'` confirmed at line 12 |
| `packages/db/src/schema/intake.ts` | `packages/db/src/schema/pickups.ts` | FK reference | WIRED | `.references(() => pickups.id)` confirmed at line 30 |
| `apps/web/next.config.ts` | `apps/web/i18n/request.ts` | createNextIntlPlugin | WIRED | `createNextIntlPlugin('./i18n/request.ts')` at line 2 |
| `apps/web/app/prison/layout.tsx` | `apps/web/messages/da.json` | getMessages | WIRED | `getMessages()` called at line 17; passed to `NextIntlClientProvider` |
| `apps/web/app/prison/incoming/page.tsx` | `apps/web/app/prison/actions.ts` | getExpectedDeliveries | WIRED | Imported and called at line 91 |
| `apps/web/app/prison/actions.ts` | `packages/db/src/schema/pickups.ts` | withRLSContext query | WIRED | `withRLSContext` used at line 134 with pickups join; `eq(pickups.status, 'delivered')` at line 168 |
| `apps/web/app/prison/intake/[id]/page.tsx` | `apps/web/app/prison/actions.ts` | getExpectedDelivery + submitIntake (via IntakeForm) | WIRED | `getExpectedDelivery` called at line 16; `IntakeForm` rendered with pickup data |
| `apps/web/app/prison/components/intake-form.tsx` | `apps/web/lib/discrepancy.ts` | calculateDiscrepancyPct (via QuantitySpinner) | WIRED | `quantity-spinner.tsx` imports and calls `calculateDiscrepancyPct` |
| `apps/web/app/prison/actions.ts` | `packages/db/src/schema/notifications.ts` | unexpected_intake notification insert | WIRED | `notifications` table imported; `db.insert(notifications).values({ type: 'unexpected_intake' })` at line 721 |
| `apps/web/app/prison/actions.ts` | `packages/db/src/schema/intake.ts` | batchFlags table lookup | WIRED | `batchFlags` imported at line 16; queried in `checkBatchFlags()` and `submitIntake()` |
| `apps/web/app/(ops)/intake/actions.ts` | `packages/db/src/schema/intake.ts` | intakeRecords quarantine_overridden update | WIRED | `quarantine_overridden: true` set in `overrideQuarantine()` at line 187 |
| `apps/web/app/(ops)/intake/page.tsx` | `apps/web/app/(ops)/intake/actions.ts` | getIntakeQueue + getQuarantinedIntakes | WIRED | `getIntakeQueue` imported and called |
| `apps/web/app/(ops)/intake/discrepancy/page.tsx` | `apps/web/app/(ops)/intake/actions.ts` | getDiscrepancyStats | WIRED | All four `getDiscrepancy*` functions imported and called |
| `apps/web/app/(ops)/intake/discrepancy/components/discrepancy-tabs.tsx` | `apps/web/lib/persistent-flag.ts` | isPersistentProblemMarket (via actions result) | WIRED | `isPersistentProblemMarket` called in `getMonthlyDiscrepancyByCountry`; `persistentFlag` result passed as prop to `DiscrepancyTabs` and rendered as Badge |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTAKE-01 | 05-01, 05-02 | Prison staff access via facility-pre-authenticated session; facility context locked from login | SATISFIED | `layout.tsx` gates on `session.user.role === 'prison'`; `requirePrisonSession()` in all actions; facility_id from JWT claims used for RLS |
| INTAKE-02 | 05-03, 05-07 | Incoming deliveries view: direct (single) and consolidated (grouped per-pickup) | SATISFIED | `/prison/incoming` renders direct cards and `<details>` collapsible cards grouped by outbound shipment; ops queue shows all intake records with tab filtering |
| INTAKE-03 | 05-01, 05-04, 05-05 | Intake form fields: staff name, client, origin market, delivery date, quantities, batch/lot, photos, notes | SATISFIED | `IntakeForm` and `UnexpectedIntakeForm` implement all required fields; zod validation schemas confirm required fields |
| INTAKE-04 | 05-03, 05-04 | Expected deliveries pre-populate client, origin market, and product list from pickup request | SATISFIED | `getExpectedDelivery()` fetches pickup + lines; `IntakeForm` receives pre-populated `pickup` prop with `lines[].informed_quantity` |
| INTAKE-05 | 05-01, 05-05 | Unexpected deliveries: prison staff selects client from dropdown; reco-admin receives alert | SATISFIED | `UnexpectedIntakeForm` uses shadcn Select for client; `submitUnexpectedIntake` sets `is_unexpected: true` and inserts `unexpected_intake` notification |
| INTAKE-06 | 05-01, 05-04 | Auto-compare actual vs informed quantity; flag if any line exceeds threshold; reco-admin notified | SATISFIED | `calculateDiscrepancyPct` used per line in `submitIntake`; `discrepancy_flagged` set if any line exceeds `system_settings.discrepancy_alert_threshold_pct`; `discrepancy_detected` notification inserted |
| INTAKE-07 | 05-01, 05-06 | Batch/lot checked against batch_flags; quarantine_flagged set; blocked without reco-admin override | SATISFIED | `checkBatchFlags()` for client-side check; server-side defence-in-depth in `submitIntake` returns `quarantine_blocked` before insert; `overrideQuarantine()` validates 10-char reason and sets all quarantine override fields |
| INTAKE-08 | 05-01, 05-08 | Discrepancy dashboard: rates by country, product, facility; persistent problem markets auto-flagged | SATISFIED | Four aggregate SQL actions with GROUP BY and 6-month INTERVAL window; `isPersistentProblemMarket` called per country; dashboard at `/(ops)/intake/discrepancy` with three tabs |

**All 8 INTAKE requirements satisfied.**

No orphaned requirements found — all INTAKE-01 through INTAKE-08 appear in plan frontmatter and have implementation evidence.

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `apps/web/app/prison/page.tsx` | "Forventede Leveringer" tab shows `t('no_deliveries')` empty state | Info | Intentional placeholder from Plan 02 SUMMARY — data fetching for that home-screen tab was not scoped to Phase 5; the full incoming deliveries are at `/prison/incoming`. Not a stub that blocks goal. |
| `apps/web/app/prison/intake/[id]/success/page.tsx` | `client_name: null` hardcoded comment "tenant name requires join — not critical for success screen" | Info | A deliberate simplification documented in code. Success screen shows reference, market, and products. Client name is a nice-to-have on that screen. Does not block any INTAKE requirement. |
| Wave 0 stubs: 8 `it.todo()` entries across `actions.test.ts` | `it.todo()` throughout test files | Info | These are intentional scaffolding — counted as passing by Vitest (skipped, not failed). The underlying Server Actions are fully implemented; the stubs exist to track future test implementation debt. |

No blocker anti-patterns found.

---

## Human Verification Required

### 1. Prison tablet shell — two-tap navigation

**Test:** On a tablet viewport (1024px or wider), visit `/prison` authenticated as a `prison` role user with a facility_id. Count taps to reach an intake form.
**Expected:** Top bar shows facility name. One tap on "Registrer Levering" CTA reaches `/prison/incoming`. One tap on a delivery card reaches `/prison/intake/[id]`. Total: two taps.
**Why human:** Navigation flow and touch target sizes (min 44px, min 48px for CTAs) require a real browser to confirm.

### 2. Live discrepancy warning on quantity input

**Test:** On the intake form at `/prison/intake/[id]`, change a product quantity to a value >15% above the expected quantity.
**Expected:** An amber inline badge ("X fra forventet") appears immediately; the product row gains a yellow-tinted border. A discrepancy summary banner appears above the submit button.
**Why human:** Real-time state update on quantity change requires interaction in a browser.

### 3. Batch quarantine blocking

**Test:** Insert a row into `batch_flags` with `active=true`. Open the intake form and enter that batch number in any line's batch/lot field (on blur).
**Expected:** Red destructive "Karantaene" banner appears; submit button is disabled with quarantine label.
**Why human:** Requires a live batch_flags record; client-side Server Action call and UI state update needs browser confirmation.

### 4. Quarantine override dialog UX

**Test:** From the ops portal `/intake?tab=quarantine`, click Override on a quarantined record. Type 8 characters in the reason field.
**Expected:** Character count shows "8/10 minimum"; Approve and Release button remains disabled.
**Why human:** Dialog interaction and real-time button enablement state cannot be verified statically.

### 5. Discrepancy dashboard visual output

**Test:** Visit `/(ops)/intake/discrepancy` with some intake records that have `discrepancy_flagged=true`. Inspect the By Country tab.
**Expected:** Countries with >15% rate show amber text; countries flagged as persistent show a red "Persistent Issue" badge; trend arrows point up or down based on rate direction.
**Why human:** Requires live `intake_records` data and browser rendering to confirm colour/badge display.

---

## Gaps Summary

No gaps. All 5 observable truths are verified, all 28 required artifacts exist and are substantive and wired, all 14 key links are confirmed, and all 8 INTAKE requirements are satisfied with implementation evidence. The 3 anti-pattern findings are all informational — intentional design decisions documented in code, none blocking goal achievement.

The 5 items flagged for human verification are visual/interactive behaviours that cannot be confirmed by static analysis but have complete code-level support.

---

_Verified: 2026-03-20T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
