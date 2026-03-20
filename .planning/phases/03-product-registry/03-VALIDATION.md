---
phase: 3
slug: product-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.1.0 |
| **Config file** | `packages/db/vitest.config.ts` (DB tests) / `apps/web/vitest.config.ts` (UI tests) |
| **Quick run command** | `pnpm --filter db test` |
| **Full suite command** | `pnpm --filter db test && pnpm --filter web test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter db test`
- **After every plan wave:** Run `pnpm --filter db test && pnpm --filter web test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PROD-06 | schema/RLS integration | `pnpm --filter db test:rls` | ❌ Wave 0 | ⬜ pending |
| 03-02-01 | 02 | 1 | PROD-01 | schema/RLS integration | `pnpm --filter db test:rls` | ❌ Wave 0 | ⬜ pending |
| 03-02-02 | 02 | 1 | PROD-03, PROD-05 | schema integration | `pnpm --filter db test` | ❌ Wave 0 | ⬜ pending |
| 03-02-03 | 02 | 1 | PROD-04 | unit (Server Action logic) | `pnpm --filter web test` | ❌ Wave 0 | ⬜ pending |
| 03-02-04 | 02 | 1 | PROD-08 | schema | `pnpm --filter db test` | ❌ Wave 0 | ⬜ pending |
| 03-03-01 | 03 | 2 | PROD-02 | unit | `pnpm --filter web test` | ❌ Wave 0 | ⬜ pending |
| 03-04-01 | 04 | 2 | PROD-04 | unit (pricing close logic) | `pnpm --filter web test` | ❌ Wave 0 | ⬜ pending |
| 03-05-01 | 05 | 3 | PROD-07 | integration (seed) | `pnpm --filter db test` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/src/tests/schema.test.ts` — extend with PROD-01, PROD-06, PROD-08 assertions (products table columns, material_library, product_group)
- [ ] `packages/db/src/tests/rls.test.ts` — extend with PROD-01, PROD-03, PROD-06 RLS policy assertions (tenant isolation + material_library global read)
- [ ] `packages/db/src/tests/seed.test.ts` — covers PROD-07; verifies Wolt product count + spot-check weights
- [ ] `apps/web/lib/storage.test.ts` — covers PROD-02; unit tests for Supabase Storage path helper functions
- [ ] `apps/web/app/(ops)/products/actions.test.ts` — covers PROD-04; unit test for pricing close logic (effective_to auto-set)
- [ ] `apps/web/app/(ops)/products/actions.test.ts` — covers PROD-05; historical composition date query returns correct materials

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop photo upload renders thumbnail grid | PROD-02 | Visual/browser interaction | Navigate to /products/new, drag image files into upload zone, verify thumbnail grid appears with X buttons |
| Material disassembly photos appear inline in composition table row | PROD-02 | Visual/browser interaction | Add material line to product, upload 2 disassembly photos, verify compact 2-thumbnail strip appears in the table row |
| Live branding preview updates in real time during product form editing | PROD-03 | Real-time UI | Edit product, add material composition line, verify material combobox filters on type |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
