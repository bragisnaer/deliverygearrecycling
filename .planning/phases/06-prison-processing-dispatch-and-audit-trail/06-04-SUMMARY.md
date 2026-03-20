---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: 04
subsystem: db-schema
tags: [drizzle, rls, processing, schema, enums]
dependency_graph:
  requires:
    - packages/db/src/schema/intake.ts
    - packages/db/src/schema/products.ts
    - packages/db/src/schema/tenants.ts
    - packages/db/src/schema/auth.ts
  provides:
    - processingReports table
    - processingReportLines table
    - activityTypeEnum
    - sizeBucketEnum
    - productCategoryEnum
  affects:
    - packages/db/src/schema/index.ts
    - packages/db/src/schema/products.ts
tech_stack:
  added: []
  patterns:
    - deny-all restrictive RLS + permissive per-role policies (matching intake.ts pattern)
    - EXISTS subquery RLS for child table isolation via parent row
    - nullable FK for optional linkage (intake_record_id)
key_files:
  created:
    - packages/db/src/schema/processing.ts
  modified:
    - packages/db/src/schema/products.ts
    - packages/db/src/schema/index.ts
decisions:
  - sizeBucketEnum defined in processing.ts and reusable by future dispatch schema
  - product_category column defaults to 'other' — migration 0005 seeds existing Wolt products
  - prison INSERT on report lines handled via cascade from parent (no separate INSERT policy needed)
metrics:
  duration: 100s
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 3
requirements:
  - PROCESS-02
---

# Phase 06 Plan 04: Processing Schema Summary

**One-liner:** Drizzle schema for processing_reports and processing_report_lines with activityTypeEnum (wash/pack), sizeBucketEnum (XXS-XXXL), and productCategoryEnum on products.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Processing reports Drizzle schema with RLS policies | 1ada160 | packages/db/src/schema/processing.ts, packages/db/src/schema/index.ts |
| 2 | Add product_category enum to products table | 7526e4f | packages/db/src/schema/products.ts |

## What Was Built

### processing.ts

- `activityTypeEnum` — `['wash', 'pack']`
- `sizeBucketEnum` — `['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']` (reusable by dispatch schema)
- `processingReports` table with FK to prisonFacilities, intakeRecords (nullable), tenants, products, users; voided/void_reason audit fields; indexes on tenant_id, prison_facility_id, intake_record_id
- `processingReportLines` table with FK to processingReports (cascade delete), nullable size_bucket, quantity
- Full RLS on both tables: deny-all restrictive + prison SELECT/INSERT/UPDATE + reco SELECT + reco-admin all
- Child table (lines) prison SELECT uses EXISTS subquery on parent processing_reports

### products.ts

- `productCategoryEnum` — `['clothing', 'bag', 'equipment', 'other']`
- `product_category` column on products table, positioned after `processing_stream`, default `'other'`
- Migration 0005 will ALTER TABLE + seed UPDATE (Clothing→clothing, Bike/Car/Inner Bag→bag, Heating Plate→equipment)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — schema-only plan with no UI or Server Actions.

## Self-Check: PASSED

- packages/db/src/schema/processing.ts — FOUND
- packages/db/src/schema/index.ts contains `export * from './processing'` — FOUND
- packages/db/src/schema/products.ts contains `productCategoryEnum` — FOUND
- Commit 1ada160 — verified
- Commit 7526e4f — verified
