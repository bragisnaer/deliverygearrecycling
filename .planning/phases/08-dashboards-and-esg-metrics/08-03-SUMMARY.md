---
phase: 08-dashboards-and-esg-metrics
plan: 03
subsystem: esg-export
tags: [esg, pdf, csv, route-handler, react-pdf, export]

# Dependency graph
requires:
  - 08-01 (serializeEsgCsv, MaterialWeightRow, calculateReuseRate from esg-calculator.ts)
  - 08-02 (getEsgData, getProcessingStreamCounts from esg/actions.ts)
provides:
  - GET /esg/export?format=csv — CSV export with Content-Disposition attachment header
  - GET /esg/export?format=pdf — PDF export via @react-pdf/renderer
  - EsgPdfDocument React-PDF component with A4 layout
affects:
  - apps/web/next.config.ts (serverExternalPackages added)

# Tech tracking
tech-stack:
  added:
    - "@react-pdf/renderer@4.3.2 — server-side PDF generation"
  patterns:
    - "serverExternalPackages config pattern to prevent Next.js bundling @react-pdf/renderer (avoids React reconciler conflict)"
    - "require() cast pattern for renderToBuffer to bypass TypeScript ReactElement<DocumentProps> type constraint"
    - "new Uint8Array(buffer) conversion for Buffer → BodyInit compatibility in Response constructor"
    - "createElement() instead of JSX in route.ts to avoid .tsx extension requirement"

key-files:
  created:
    - apps/web/app/(ops)/esg/components/esg-pdf-document.tsx
    - apps/web/app/(ops)/esg/export/route.ts
  modified:
    - apps/web/next.config.ts
    - apps/web/package.json

key-decisions:
  - "require() cast for renderToBuffer bypasses TypeScript ReactElement<DocumentProps> incompatibility — import { renderToBuffer } from @react-pdf/renderer fails TS type check with createElement output"
  - "new Uint8Array(buffer) wraps Node.js Buffer for Response BodyInit compatibility — Buffer alone fails TypeScript TS2345 since it lacks URLSearchParams interface"
  - "serverExternalPackages: ['@react-pdf/renderer'] prevents monorepo React reconciler conflict per RESEARCH Pitfall 1"
  - "createElement() used in route.ts to avoid needing .tsx extension — JSX transform not available in .ts files"

# Metrics
duration: 8min
completed: 2026-03-21
---

# Phase 8 Plan 03: ESG Export (PDF + CSV) Summary

**Auth-protected /esg/export route serving PDF via @react-pdf/renderer and CSV via serializeEsgCsv; next.config.ts updated with serverExternalPackages to prevent React reconciler conflict.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-21T09:50:00Z
- **Completed:** 2026-03-21T09:58:12Z
- **Tasks:** 1 (single combined task)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `@react-pdf/renderer@4.3.2` installed; `serverExternalPackages` config added to `next.config.ts`
- `EsgPdfDocument` component renders A4 PDF with: title, generated date, summary stat cards (total items, total weight, reuse rate, CO2 avoided), material breakdown table (material / weight / items), and methodology block
- `GET /esg/export` route handler:
  - Auth gate: checks `role === 'reco-admin' || role === 'reco'`, returns 401 otherwise
  - `format=csv` branch: calls `serializeEsgCsv(esgData.materials)`, returns with `text/csv` + `Content-Disposition: attachment` header
  - Default PDF branch: calls `renderToBuffer(createElement(EsgPdfDocument, {...}))`, returns `Uint8Array` with `application/pdf` header
  - `?tenant=` query param passed through to both `getEsgData` and `getProcessingStreamCounts`

## Task Commits

1. **Task 1: Install, configure, and implement PDF/CSV export** — `89ddc49`

## Files Created/Modified

- `apps/web/app/(ops)/esg/components/esg-pdf-document.tsx` — React-PDF Document component; A4 page, StyleSheet.create(), exports `EsgPdfDocument` named export
- `apps/web/app/(ops)/esg/export/route.ts` — GET route handler; auth check, format dispatch, CSV and PDF branches
- `apps/web/next.config.ts` — Added `serverExternalPackages: ['@react-pdf/renderer']`
- `apps/web/package.json` — `@react-pdf/renderer@4.3.2` in dependencies

## Decisions Made

- `require()` cast for `renderToBuffer` to bypass TypeScript's `ReactElement<DocumentProps>` constraint — the static import form fails TS2345 when the element is created via `createElement()`
- `new Uint8Array(buffer)` wraps the returned `Buffer` for `Response` BodyInit compatibility — `Buffer` alone is rejected TS2345 since it doesn't implement `URLSearchParams`
- `serverExternalPackages` prevents Next.js from bundling the library, which would cause a React reconciler version conflict in a monorepo (two React instances)
- `createElement()` used instead of JSX so the file can stay as `.ts` rather than `.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing esg/actions.ts dependency**
- **Found during:** Task 1 — route.ts imports `getEsgData` and `getProcessingStreamCounts` from `../actions` which did not exist
- **Issue:** Plan 08-02 (ESG query layer) had not yet been executed; the esg directory did not exist at all
- **Fix:** Confirmed via parallel agent check that actions.ts was already created by concurrent plan 08-02 agent — no action needed; directory structure was present by execution time
- **Impact:** None — dependency resolved by parallel execution

**2. [Rule 1 - Bug] Fixed TypeScript TS2345 for renderToBuffer element type**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `renderToBuffer(createElement(EsgPdfDocument, {...}))` fails TS2345 — `FunctionComponentElement<EsgPdfDocumentProps>` not assignable to `ReactElement<DocumentProps>`
- **Fix:** Used `require()` cast with explicit return type `{ renderToBuffer: (element: unknown) => Promise<Buffer> }` to bypass constraint
- **Files modified:** `apps/web/app/(ops)/esg/export/route.ts`

**3. [Rule 1 - Bug] Fixed TypeScript TS2345 for Buffer as Response BodyInit**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `new Response(buffer, ...)` where buffer is `Buffer<ArrayBufferLike>` — TypeScript rejects it as BodyInit since it lacks URLSearchParams interface
- **Fix:** Wrapped with `new Uint8Array(buffer)` which is a valid BodyInit
- **Files modified:** `apps/web/app/(ops)/esg/export/route.ts`

## Known Stubs

- `EsgPdfDocument` renders CO2 Avoided as "Formula pending — to be defined" when `co2.formula_pending === true`. This is intentional — the CO2 calculation formula is blocked on business decision (ESG-04). The PDF correctly reflects the pending state for transparency in exported reports.

## Self-Check

- [x] `apps/web/app/(ops)/esg/components/esg-pdf-document.tsx` — FOUND
- [x] `apps/web/app/(ops)/esg/export/route.ts` — FOUND
- [x] `apps/web/next.config.ts` contains `serverExternalPackages` — VERIFIED
- [x] `apps/web/package.json` contains `@react-pdf/renderer` — VERIFIED
- [x] Commit `89ddc49` — FOUND

## Self-Check: PASSED
