# Deferred Items — Phase 01 Infrastructure Foundation

## Pre-existing build failure (out of scope for 01-04)

**File:** `packages/types/src/auth.ts` line 33
**Error:** `Invalid module name in augmentation, module 'next-auth/jwt' cannot be found.`
**Root cause:** `next-auth@beta` (v5) exports JWT types from `next-auth/jwt` but the TypeScript resolution may fail depending on the installed version. Present since before plan 01-04.
**Scope:** This error predates plan 01-04 (confirmed in commit `74d7e41`). Fix belongs in the auth plan (01-03 or a dedicated fix plan).
**Impact:** `pnpm turbo build` fails; does not affect proxy.ts unit tests which pass independently.
