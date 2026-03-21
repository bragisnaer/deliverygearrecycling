# Phase 10: Historical Data Import - Research

**Researched:** 2026-03-21
**Domain:** CSV/XLSX file parsing, column mapping UI, bulk DB import, data provenance flagging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | CSV/XLSX import for: pickup request log (2023–2026), prison delivery intake log (2022–2026), GreenLoop form data (2025), invoice binder references, transport cost spreadsheet | ExcelJS for .xlsx parsing; PapaParse for .csv; Server Action + API route approach for file processing |
| IMPORT-02 | Import UI: file upload, column-to-field mapping interface, validation preview (flag errors before commit), one-click commit | React Hook Form + useState for multi-step wizard; validation runs server-side before any DB writes |
| IMPORT-03 | Imported records marked with `source: 'import'` flag; distinguishable from live data in all list views and exports | `is_imported boolean` column (mirrors `is_unexpected` pattern) added to all five target tables |
| IMPORT-04 | Import is one-time per source; no ongoing sync | Server Action commits and returns; no webhook, cron, or sync layer needed |
</phase_requirements>

---

## Summary

Phase 10 adds a one-time bulk data import capability for five historical datasets (2022–2026). The user interface is an reco-admin-only, multi-step wizard: upload file → map columns → preview validation results → commit. All import targets are existing tables already built in phases 4–7. The phase introduces no new domain tables beyond the `is_imported` flag and an `import_jobs` tracking table.

The core technical challenge is **parsing heterogeneous spreadsheets in a Next.js Server Action context**, then running **record-level validation** before any DB writes, and finally performing **idempotent bulk inserts** via Drizzle that skip duplicates. The secondary challenge is ensuring all downstream views — dashboards, ESG aggregates, financial summaries — correctly include imported records without modification (they already query the tables; they just need to not filter them out).

**Primary recommendation:** Use ExcelJS (installed via `pnpm add exceljs`) for XLSX and PapaParse for CSV, both executed server-side in a Next.js App Router API route (not a Server Action) because file uploads exceed Server Action payload constraints. Persist parsed rows + validation results in a temporary `import_jobs` table keyed by job ID; a separate "commit" Server Action finalises the insert. This two-step model matches the preview-then-commit requirement in IMPORT-02 and avoids re-parsing on commit.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | 4.4.0 | Parse .xlsx files server-side | Active maintained library; handles merged cells, multiple sheets, data types correctly; runs in Node without browser APIs |
| papaparse | 5.5.3 | Parse .csv files | Industry standard; stream-capable; handles BOM, quoting, type coercion; zero dependencies |
| zod | ^3.24.1 (already installed) | Per-row validation schemas | Already used throughout codebase for all input validation |
| drizzle-orm | ^0.45.1 (already installed) | Bulk insert with onConflictDoNothing | Already the project's ORM |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | ^7.54.0 (already installed) | Column-mapping form state | Already used across all forms in the codebase |
| @repo/db | workspace (already installed) | DB access pattern | withRLSContext for reco-admin inserts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exceljs | xlsx (SheetJS) | xlsx 0.18.5 is the last free version — SheetJS moved to commercial license for 0.19+; exceljs is fully MIT |
| Server-side parse | Client-side parse | Client parse means sending raw data back to server; increases complexity and payload size; validation cannot access DB for FK lookups |
| Temp `import_jobs` table | sessionStorage / in-memory | In-memory does not survive navigation; sessionStorage is limited to 5MB; DB-backed jobs survives page reload and allows async commit |

**Installation:**
```bash
pnpm add exceljs papaparse --filter @apps/web
pnpm add -D @types/papaparse --filter @apps/web
```

**Version verification:** npm registry confirms exceljs@4.4.0 and papaparse@5.5.3 as of research date.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── (ops)/
│   │   └── import/                    # reco-admin only route group
│   │       ├── page.tsx               # Import hub — five source cards
│   │       ├── [source]/
│   │       │   ├── page.tsx           # Upload step
│   │       │   ├── actions.ts         # commitImport Server Action
│   │       │   └── import-wizard.tsx  # Client Component (multi-step)
│   ├── api/
│   │   └── import/
│   │       └── upload/
│   │           └── route.ts           # POST: parse file → validate → store job
├── lib/
│   ├── import-parser.ts               # ExcelJS + PapaParse parsing logic (pure, testable)
│   ├── import-parser.test.ts
│   ├── import-validators.ts           # Per-source Zod schemas + row validation
│   └── import-validators.test.ts
packages/db/
├── migrations/
│   └── 0009_historical_import.sql    # is_imported columns + import_jobs table
├── src/schema/
│   └── import.ts                     # import_jobs Drizzle schema
```

### Pattern 1: Two-Step Import (Upload → Preview → Commit)

**What:** File upload triggers server-side parse and validation; rows + errors stored in `import_jobs` table; reco-admin reviews errors in preview UI; clicking Commit fires a Server Action that reads the stored job rows and inserts only valid records.

**When to use:** Any import UI where validation errors must be shown before any records are written (required by IMPORT-02).

**Example — upload API route:**
```typescript
// apps/web/app/api/import/upload/route.ts
export async function POST(request: Request) {
  // auth check: reco-admin only
  const session = await auth()
  if (session?.user?.role !== 'reco-admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const source = formData.get('source') as string

  const buffer = Buffer.from(await file.arrayBuffer())
  const { rows, errors } = await parseAndValidate(buffer, file.name, source)

  // Persist job to DB
  const [job] = await db.insert(importJobs).values({
    source,
    created_by: session.user.id,
    total_rows: rows.length,
    error_count: errors.length,
    rows_json: JSON.stringify(rows),
    errors_json: JSON.stringify(errors),
    status: errors.length > 0 ? 'has_errors' : 'ready',
  }).returning()

  return Response.json({ jobId: job.id, totalRows: rows.length, errorCount: errors.length, errors })
}
```

**Example — commit Server Action:**
```typescript
// apps/web/app/(ops)/import/[source]/actions.ts
'use server'
export async function commitImport(jobId: string) {
  const user = await requireRecoAdmin()
  const job = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1)
  if (!job[0] || job[0].status !== 'ready') throw new Error('Job not found or has errors')

  const rows = JSON.parse(job[0].rows_json)
  // Bulk insert with idempotency — onConflictDoNothing skips true duplicates
  await withRLSContext({ ...user }, async (tx) => {
    await tx.insert(intakeRecords).values(rows).onConflictDoNothing()
  })
  await db.update(importJobs).set({ status: 'committed', committed_at: new Date() })
    .where(eq(importJobs.id, jobId))
  revalidatePath('/import')
}
```

### Pattern 2: Column Mapping UI

**What:** After upload, display a table of CSV/XLSX headers on the left and platform field dropdowns on the right. Required fields are marked; user must map them before preview runs.

**When to use:** Any source where column names in the spreadsheet are not guaranteed to match platform field names (all five sources in this phase).

**Key implementation note:** Column mapping state lives in the ImportWizard client component using `useState`. The "Preview" step sends the mapping + raw rows back to the upload API (or uses the stored job) to run validation with the user-specified mapping applied.

**Simpler alternative where applicable:** If a source has a known, stable column format (e.g. the invoice binder), offer a "Use default mapping" button that bypasses the column picker. Always keep manual mapping available as a fallback.

### Pattern 3: is_imported Flag

**What:** Boolean column added to each target table. Defaults to `false` for live records. Import Server Action sets it to `true` on all inserted rows.

**When to use:** Mirrors the existing `is_unexpected` boolean pattern in `intake_records`. Same pattern, same visibility: shown as a badge in list views, included in export headers.

**Migration approach (following 0008 pattern):**
```sql
-- 0009_historical_import.sql
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE intake_records ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE processing_reports ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
-- transport_bookings if transport cost spreadsheet maps here
ALTER TABLE transport_bookings ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,  -- 'pickup_log' | 'intake_log' | 'greenloop' | 'invoice_binder' | 'transport_costs'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'ready' | 'has_errors' | 'committed'
  total_rows INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  rows_json TEXT NOT NULL DEFAULT '[]',
  errors_json TEXT NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ENABLE ROW LEVEL SECURITY ON import_jobs;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;
-- reco-admin only
GRANT SELECT, INSERT, UPDATE ON import_jobs TO reco_admin_role;
```

### Anti-Patterns to Avoid

- **Parsing in a Server Action:** Next.js Server Actions have a default 1MB body limit. File uploads must go through an API route (`app/api/import/upload/route.ts`) configured with `export const config = { api: { bodyParser: false } }` (App Router: no config needed, just stream `request.formData()`).
- **Committing partial inserts without a preview step:** violates IMPORT-02. Always validate all rows first and present error summary before any DB write.
- **Storing raw file in DB:** Store parsed row objects as JSON, not the original binary. The binary is not needed post-parse.
- **Using `db` (RLS context) for import_jobs reads in the commit action:** import_jobs is an ops-internal table; use raw `db` for reads, use `withRLSContext` for the actual domain table inserts.
- **Re-parsing on commit:** Parse once on upload, persist rows as JSON. Commit reads the stored rows — avoids double-parsing and ensures what the user previewed is what gets committed.
- **Inserting without idempotency:** Always use `.onConflictDoNothing()` on stable unique keys (e.g. reference numbers, date+facility combos) to make re-runs safe.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX parsing | Custom binary reader | ExcelJS | Cell types, date serial numbers, merged cells, multiple sheets — dozens of edge cases |
| CSV parsing | `str.split(',')` | PapaParse | Quoted commas, multi-line fields, BOM characters, charset issues |
| Row validation | Ad-hoc if/else | Zod schemas per source | Already used project-wide; produces structured error objects; composable |
| Date parsing | Custom regexes | `new Date()` + Zod `.pipe(z.coerce.date())` | Handles ISO, DD/MM/YYYY, Excel serial numbers via ExcelJS pre-conversion |

**Key insight:** Spreadsheet date values are the single most dangerous area — Excel stores dates as integers (serial numbers since 1900-01-01). ExcelJS converts these to JavaScript Date objects automatically during cell reading, so the parsed rows should always pass dates as JS Dates before Zod validation runs. Hand-rolling this conversion is reliably wrong.

---

## Runtime State Inventory

> This is a new-feature phase (not a rename/refactor). No runtime state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing import records — this is the first import | None |
| Live service config | No service config references import feature | None |
| OS-registered state | None | None |
| Secrets/env vars | No new env vars required — existing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sufficient | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: Next.js App Router File Upload Body Limit

**What goes wrong:** Uploading a large XLSX to a Server Action throws "body size limit exceeded" or silently truncates.

**Why it happens:** Next.js Server Actions default to ~1MB body. Historical datasets can be 2–10MB.

**How to avoid:** Route file uploads through `app/api/import/upload/route.ts` (a standard Next.js API route). The App Router API route has no enforced body size limit beyond the Vercel function payload limit (4.5MB compressed, 50MB uncompressed for Pro). For files exceeding 4MB, consider reading the file client-side and posting the text content directly (parsed rows) rather than the raw binary.

**Warning signs:** `PayloadTooLargeError`, `413` HTTP status, or silent truncation of the last rows.

### Pitfall 2: Excel Date Serial Numbers

**What goes wrong:** Date columns show as integers (e.g. `45123`) instead of dates.

**Why it happens:** Excel stores dates as integers counting from 1900-01-01. If ExcelJS cell type is not `'d'` (date), the raw value is numeric.

**How to avoid:** When reading XLSX with ExcelJS, use `cell.type === CellValueType.Date ? cell.value as Date : parseExcelSerial(cell.value)` fallback. Better: open workbook with `{ dates: true }` (ExcelJS default) and check the cell type. Pre-process all date columns to ISO strings before handing to Zod.

**Warning signs:** Valid-looking numeric values in date columns after parse.

### Pitfall 3: FK Constraint Failures on Import

**What goes wrong:** Inserting intake_records with a `prison_facility_id` that doesn't exist in `prison_facilities` fails with a FK violation, aborting the entire batch.

**Why it happens:** Historical spreadsheets use facility names (strings), not UUIDs. Validation must resolve names to UUIDs before commit.

**How to avoid:** During the validation step (server-side, before preview), look up all FK-referenced entities (facilities, products, tenants, locations) from DB and include unresolvable references as validation errors shown to the user. The commit step only runs for rows that passed validation — these rows already have UUIDs substituted.

**Warning signs:** `ForeignKeyViolation` errors in Supabase logs during commit.

### Pitfall 4: RLS Blocks Import Inserts

**What goes wrong:** `withRLSContext` for reco-admin inserts is used correctly for live records but the import action fails because `submitted_by` is NULL (no real submitting user for historical records) and a NOT NULL constraint fires, or a trigger tries to create a `financial_record` for every intake insert.

**Why it happens:** Two existing DB triggers fire on `intake_records` INSERT: the `IN-YYYY-NNNN` reference trigger and the `create_financial_record` trigger (from Phase 7). These triggers will also fire on imported records.

**How to avoid:**
- For the reference trigger: this is desirable — imported intake records will get sequential `IN-YYYY-NNNN` references, which is correct.
- For `create_financial_record`: the trigger auto-creates a `financial_records` row per imported intake record. This is correct for intake imports that represent real deliveries with financial implications. For imports where financial data comes from a separate spreadsheet (invoice binder), the trigger-created record will be updated by the invoice binder import in a second pass.
- `submitted_by` is nullable in the schema — set it to the importing reco-admin's user ID for traceability.

**Warning signs:** Unexpected financial records created for every imported intake row; or missing reference numbers on imported pickups.

### Pitfall 5: Column Mapping UX State Lost on Page Reload

**What goes wrong:** User maps 20 columns, navigates away accidentally, loses all mapping state.

**Why it happens:** Column mapping lives only in React `useState`.

**How to avoid:** Store the job ID (returned from the upload API) in the URL (`/import/intake_log?jobId=xxx`) via `router.push`. On page load, if `jobId` param exists, load the job from DB (GET `/api/import/jobs/[id]`) and restore mapping state. The job record stores the parsed rows; column mapping itself is client-only state that cannot be recovered — show a "re-upload required" message if the user navigates back to a job with no mapping set.

**Warning signs:** Users complaining about losing work during column mapping.

### Pitfall 6: Drizzle onConflictDoNothing Without a Unique Constraint

**What goes wrong:** Re-running an import creates duplicate records instead of skipping.

**Why it happens:** `onConflictDoNothing()` only works when a unique constraint or primary key violation would occur. Intake records have no natural unique key (no external ID in the historical spreadsheets).

**How to avoid:** Add a composite unique index on `(tenant_id, delivery_date, prison_facility_id, origin_market)` guarded with `WHERE is_imported = true` to scope deduplication to imports only. Alternatively, store the source row hash in the `import_jobs` rows_json and check for existing hashes before insert. The simpler approach: mark the import as committed in `import_jobs` and refuse re-commits of the same job.

**Warning signs:** Duplicate records appearing after re-running an import.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### ExcelJS Row Reading (server-side, Node context)

```typescript
// Source: ExcelJS official README + Node.js usage
import ExcelJS from 'exceljs'

export async function parseXlsx(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  const rows: Record<string, unknown>[] = []
  const headers: string[] = []

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => headers.push(String(cell.value ?? '')))
      return
    }
    const record: Record<string, unknown> = {}
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber - 1]
      // ExcelJS converts date cells to JS Date objects when workbook loaded with dates enabled
      record[key] = cell.type === 6 ? cell.result : cell.value
    })
    rows.push(record)
  })
  return rows
}
```

### PapaParse CSV Parsing (server-side)

```typescript
// Source: PapaParse docs — Node.js string parsing
import Papa from 'papaparse'

export function parseCsv(content: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(content, {
    header: true,        // uses first row as keys
    skipEmptyLines: true,
    dynamicTyping: false, // keep as strings; Zod handles coercion
    transformHeader: (h) => h.trim(),
  })
  return result.data
}
```

### Zod Row Validation (per source schema)

```typescript
// Source: zod docs — project already uses this pattern in all actions
import { z } from 'zod'

export const intakeRowSchema = z.object({
  delivery_date: z.coerce.date(),
  staff_name: z.string().min(1),
  origin_market: z.string().optional(),
  // product quantities handled as dynamic keys after column mapping
})

export function validateRows(rows: unknown[]): { valid: z.infer<typeof intakeRowSchema>[]; errors: { row: number; message: string }[] } {
  const valid: z.infer<typeof intakeRowSchema>[] = []
  const errors: { row: number; message: string }[] = []
  rows.forEach((row, idx) => {
    const result = intakeRowSchema.safeParse(row)
    if (result.success) valid.push(result.data)
    else errors.push({ row: idx + 2, message: result.error.issues.map(i => i.message).join('; ') })
  })
  return { valid, errors }
}
```

### is_imported Badge in List Views (following is_unexpected pattern)

```typescript
// Pattern from Phase 5 is_unexpected display — mirrors existing badge pattern
{record.is_imported && (
  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[12px] font-medium bg-blue-100 text-blue-800 border-blue-200">
    Imported
  </span>
)}
```

### Drizzle Bulk Insert with Idempotency

```typescript
// Source: Drizzle ORM docs — onConflictDoNothing; project pattern from Phase 3 seed
await withRLSContext({ ...user }, async (tx) => {
  if (rows.length > 0) {
    await tx.insert(intakeRecords)
      .values(rows.map(r => ({ ...r, is_imported: true, submitted_by: user.sub })))
      .onConflictDoNothing()
  }
})
```

---

## Five Import Sources — Field Mapping Reference

These are the five datasets specified in IMPORT-01. Each maps to existing tables.

| Source | Target Table(s) | Key FK Dependencies | Notes |
|--------|----------------|---------------------|-------|
| Pickup request log (2023–2026) | `pickups`, `pickup_lines` | `tenant_id`, `location_id`, `product_id` | Reference trigger fires → IN-YYYY-NNNN assigned automatically |
| Prison delivery intake log (2022–2026) | `intake_records`, `intake_lines` | `prison_facility_id`, `tenant_id`, `product_id` | financial_record trigger fires; `is_unexpected` = false for historical mapped deliveries |
| GreenLoop form data (2025) | `processing_reports`, `processing_report_lines` | `prison_facility_id`, `tenant_id`, `product_id` | GreenLoop = wash/pack processing data; maps to activity_type enum |
| Invoice binder references | `financial_records` | `intake_record_id` (must already exist) | Must run after intake log import; UPDATE existing financial_records (created by trigger) |
| Transport cost spreadsheet | `transport_bookings` | `pickup_id` | Updates `transport_cost_market_to_destination_eur` on existing bookings or inserts with `is_imported = true` |

**Order dependency:** Invoice binder import must run after intake log import (intake_record_id FK). Transport costs can run independently.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV-only import tools | XLSX-first with CSV fallback | Post-2020 | Most ops teams use Excel/Sheets natively |
| Server-side streaming | Buffer into memory, parse sync | Still fine for <50MB ops files | Historical operational files are small (<5MB); streaming adds complexity without benefit here |
| Separate import microservice | In-process import via API route | Next.js App Router era | Single deployment; no queue needed for one-time import |

---

## Open Questions

1. **GreenLoop data format**
   - What we know: IMPORT-01 mentions "GreenLoop form data (2025)" as a source
   - What's unclear: GreenLoop is a form/survey tool — the export format (CSV vs XLSX, column names, structure) is unknown
   - Recommendation: Build generic column-mapping UI so reco-admin can adapt to whatever GreenLoop exports; document that GreenLoop maps to `processing_reports` (wash/pack activities)

2. **Wolt product IDs for historical lines**
   - What we know: intake_lines and pickup_lines require `product_id` UUIDs (FK to products)
   - What's unclear: Historical spreadsheets use product names (e.g. "Bike Bag") not UUIDs; Wolt products were seeded in Phase 3 with specific UUIDs
   - Recommendation: Validation step queries `products` table and resolves names→UUIDs; unresolvable product names appear as validation errors with a list of valid product names for reference

3. **Multi-tenant scope of historical data**
   - What we know: IMPORT-01 refers to data generically; Wolt is the only active tenant
   - What's unclear: Is all historical data for Wolt tenant, or multiple tenants?
   - Recommendation: Import UI asks reco-admin to select target tenant before upload (single dropdown); all rows in the file are scoped to that tenant; simplifies FK resolution

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @apps/web test` |
| Full suite command | `pnpm --filter @apps/web test` (all .test.ts files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | CSV parsed to typed row array | unit | `pnpm --filter @apps/web test import-parser` | Wave 0 |
| IMPORT-01 | XLSX parsed to typed row array | unit | `pnpm --filter @apps/web test import-parser` | Wave 0 |
| IMPORT-02 | Validation errors surfaced per-row | unit | `pnpm --filter @apps/web test import-validators` | Wave 0 |
| IMPORT-02 | Valid rows pass through | unit | `pnpm --filter @apps/web test import-validators` | Wave 0 |
| IMPORT-03 | is_imported flag set true on commit | unit | `pnpm --filter @apps/web test import-validators` | Wave 0 |
| IMPORT-04 | Committed job cannot be re-committed | unit | `pnpm --filter @apps/web test` (actions test) | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @apps/web test import-parser import-validators`
- **Per wave merge:** `pnpm --filter @apps/web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/lib/import-parser.test.ts` — covers IMPORT-01 (CSV and XLSX parsing)
- [ ] `apps/web/lib/import-validators.test.ts` — covers IMPORT-02 and IMPORT-03 (per-row validation, is_imported flag)
- [ ] `pnpm add exceljs papaparse --filter apps/web` and `pnpm add -D @types/papaparse --filter apps/web` — library install required before any parser code

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection (`packages/db/src/schema/`) — all target table schemas verified directly
- Codebase inspection (`packages/db/migrations/`) — migration numbering, naming conventions, manual SQL patterns confirmed
- Codebase inspection (`apps/web/app/(ops)/`) — action patterns, requireRecoAdmin helper, withRLSContext usage verified
- Codebase inspection (`apps/web/lib/storage.ts`) — lazy-init pattern, service role key usage
- npm registry — exceljs@4.4.0, papaparse@5.5.3 confirmed as current versions

### Secondary (MEDIUM confidence)

- ExcelJS README (MIT license, Node.js Buffer support, date handling) — verified via npm page and known documentation
- PapaParse documentation (header mode, skipEmptyLines, server-side usage) — well-established library, patterns verified against npm metadata

### Tertiary (LOW confidence)

- GreenLoop export format — unknown; assumption that it exports CSV or XLSX is reasonable but not verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — library versions verified via npm registry; no new libraries without precedent in ecosystem
- Architecture: HIGH — patterns directly derived from existing codebase (is_unexpected, onConflictDoNothing, withRLSContext, Server Action + API route split)
- Pitfalls: HIGH — FK trigger interactions verified by reading migration SQL; ExcelJS date behaviour is well-documented

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (stable libraries; ExcelJS and PapaParse are not fast-moving)
