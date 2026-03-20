---
phase: 02-auth-roles-and-tenant-branding
verified: 2026-03-20T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 2: Auth Roles and Tenant Branding Verification Report

**Phase Goal:** All six user roles can authenticate and reach their correct portal; client portals render with tenant-specific branding
**Verified:** 2026-03-20
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | reco-admin can view a list of all users | ✓ VERIFIED | `getUsers()` in actions.ts line 177; `UsersTab` + `UsersTable` components exist |
| 2  | reco-admin can invite a user with role assignment (magic link sent) | ✓ VERIFIED | `inviteUser()` in actions.ts line 198; `InviteUserDialog` calls `inviteUser` at line 50 |
| 3  | reco-admin can deactivate a user | ✓ VERIFIED | `deactivateUser()` in actions.ts line 224; `users-table.tsx` calls it at line 37 |
| 4  | Users can sign in with email + password | ✓ VERIFIED | `Credentials` provider in `auth.ts` line 2, `bcrypt.compare` at line 37 |
| 5  | MicrosoftEntraID is fully removed | ✓ VERIFIED | No `MicrosoftEntraID` match in `auth.ts` or `sign-in/page.tsx` |
| 6  | Prison staff can bookmark /prison/login?facility=X | ✓ VERIFIED | Page exists at stable path; not inside auth-guarded route group |
| 7  | Prison magic link sends session to /prison | ✓ VERIFIED | `callbackUrl: '/prison'` in `send-login/route.ts` line 48 |
| 8  | Wrong-portal access redirects to correct portal | ✓ VERIFIED | `proxy.ts` contains client-on-ops and reco-on-client redirect blocks |
| 9  | Post-login redirect sends each role to correct destination | ✓ VERIFIED | `ROLE_DESTINATIONS` mapping all 6 roles in `proxy.ts` line 52 |
| 10 | Each tenant can have a branding record | ✓ VERIFIED | `tenantBranding` table in `packages/db/src/schema/branding.ts` line 13; re-exported from schema index |
| 11 | Client portal injects tenant CSS custom properties | ✓ VERIFIED | `(client)/layout.tsx` calls `getBrandingForTenant` + `buildBrandingStyle` lines 8-9 |
| 12 | reco-admin can configure branding from settings; WCAG AA contrast rejected at save | ✓ VERIFIED | `saveBranding` in actions.ts; `checkBrandingContrast` called at line 317; `branding-form.tsx` calls `saveBranding` at line 261 |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/auth.ts` | Credentials + Resend, no MicrosoftEntraID | ✓ VERIFIED | Credentials import line 2, bcrypt line 8, no Microsoft |
| `packages/db/src/schema/auth.ts` | users table with password_hash | ✓ VERIFIED | `password_hash: text('password_hash')` at line 42 |
| `apps/web/app/sign-in/page.tsx` | Email/password + magic link modes | ✓ VERIFIED | File modified; credentials mode and magic link present |
| `apps/web/app/(ops)/settings/users-tab.tsx` | Users tab server component | ✓ VERIFIED | File exists, imports getUsers |
| `apps/web/app/(ops)/settings/users-table.tsx` | User table with deactivate action (min 40 lines) | ✓ VERIFIED | 125 lines, imports deactivateUser |
| `apps/web/app/(ops)/settings/invite-user-dialog.tsx` | Invite modal (min 40 lines) | ✓ VERIFIED | 152 lines, imports inviteUser |
| `apps/web/app/(ops)/settings/actions.ts` | inviteUser, deactivateUser, getUsers, reactivateUser, saveBranding, getBranding | ✓ VERIFIED | All 6 exports confirmed |
| `apps/web/proxy.ts` | Role-based routing, auth-wrapped | ✓ VERIFIED | `export const proxy = auth(...)`, ROLE_DESTINATIONS with all 6 roles |
| `apps/web/app/api/prison/send-login/route.ts` | callbackUrl: '/prison' | ✓ VERIFIED | line 48 |
| `apps/web/app/prison/login/page.tsx` | Stable login page with facility param | ✓ VERIFIED | Exists at stable path, handles facility param |
| `packages/db/src/schema/branding.ts` | tenantBranding table | ✓ VERIFIED | `tenantBranding` pgTable at line 13 |
| `packages/db/src/schema/index.ts` | Re-exports branding | ✓ VERIFIED | `export * from './branding'` at line 2 |
| `apps/web/lib/branding.ts` | getBrandingForTenant, buildBrandingStyle, ALLOWED_FONTS, HEX_REGEX | ✓ VERIFIED | All 4 exports present |
| `apps/web/app/(client)/layout.tsx` | CSS variable injection | ✓ VERIFIED | Calls getBrandingForTenant + buildBrandingStyle |
| `apps/web/lib/contrast.ts` | checkBrandingContrast | ✓ VERIFIED | Exported at line 16 |
| `apps/web/app/(ops)/settings/branding-tab.tsx` | Branding tab server component | ✓ VERIFIED | File exists |
| `apps/web/app/(ops)/settings/branding-form.tsx` | Form with live preview, WCAG feedback (min 80 lines) | ✓ VERIFIED | 452 lines, calls saveBranding |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `invite-user-dialog.tsx` | `actions.ts` | `inviteUser` call | ✓ WIRED | line 15 import, line 50 call |
| `users-table.tsx` | `actions.ts` | `deactivateUser` call | ✓ WIRED | line 14 import, line 37 call |
| `auth.ts` | `schema/auth.ts` | `password_hash` in authorize | ✓ WIRED | line 35 `user.password_hash` |
| `proxy.ts` | `auth.ts` | `auth()` wrapper | ✓ WIRED | `export const proxy = auth(...)` |
| `send-login/route.ts` | `auth.ts` | `signIn('resend', callbackUrl)` | ✓ WIRED | `callbackUrl: '/prison'` at line 48 |
| `(client)/layout.tsx` | `lib/branding.ts` | `getBrandingForTenant` + `buildBrandingStyle` | ✓ WIRED | Both called lines 8-9 |
| `lib/branding.ts` | `schema/branding.ts` | Drizzle query on tenantBranding | ✓ WIRED | `tenantBranding` in query |
| `schema/index.ts` | `schema/branding.ts` | re-export | ✓ WIRED | `export * from './branding'` |
| `branding-form.tsx` | `actions.ts` | `saveBranding` call | ✓ WIRED | import line 5, call line 261 |
| `actions.ts` | `lib/contrast.ts` | `checkBrandingContrast` before DB insert | ✓ WIRED | import line 10, call line 317 |
| `actions.ts` | `schema/branding.ts` | Drizzle insert/update on tenantBranding | ✓ WIRED | `tenantBranding` at lines 290, 342 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-09 | 02-01, 02-02 | reco-admin can invite and deactivate users; role-based portal routing | ✓ SATISFIED | inviteUser/deactivateUser Server Actions wired; ROLE_DESTINATIONS in proxy.ts |
| BRAND-01 | 02-03 | Tenant branding data model | ✓ SATISFIED | tenantBranding table in schema/branding.ts |
| BRAND-02 | 02-03 | Client portal renders tenant branding via CSS variables | ✓ SATISFIED | (client)/layout.tsx injects buildBrandingStyle |
| BRAND-03 | 02-03 | HEX validation before injection | ✓ SATISFIED | HEX_REGEX in lib/branding.ts, tested before applying |
| BRAND-04 | 02-03 | No-branding fallback to reco defaults | ✓ SATISFIED | buildBrandingStyle returns empty object when no branding; CSS :root defaults apply |
| BRAND-05 | 02-04 | WCAG AA contrast rejection at save time | ✓ SATISFIED | checkBrandingContrast called in saveBranding before DB insert |

---

### Anti-Patterns Found

None detected. No TODO/FIXME/placeholder comments found in phase-modified files. No stub return patterns identified.

---

### Human Verification Required

#### 1. Sign-in flow end-to-end

**Test:** Navigate to the sign-in page, enter a valid email + password for an existing user with `password_hash` set.
**Expected:** User is authenticated and redirected to the role-appropriate portal.
**Why human:** Requires a live database with seeded user and bcrypt hash; cannot verify credentials flow programmatically.

#### 2. Wrong-portal redirect in browser

**Test:** Sign in as a `client` role user, then manually navigate to the ops portal URL (ops.localhost or ops.{domain}).
**Expected:** Middleware redirects to tenant subdomain at /overview without flicker.
**Why human:** Middleware redirect logic requires live Next.js runtime with cookie-based session.

#### 3. Prison magic link bookmark stability

**Test:** Visit `/prison/login?facility=test-slug` while unauthenticated. Submit the form.
**Expected:** Page loads without auth wall; confirmation message shown; magic link email sent to facility contact.
**Why human:** Requires live Resend integration and a seeded prison facility record.

#### 4. Client portal branding render

**Test:** Visit a tenant subdomain that has a `tenant_branding` record with custom `primary_color` and `logo_url`.
**Expected:** CSS custom property `--primary` is overridden on the wrapper div; logo appears in header.
**Why human:** Requires live tenant data and subdomain routing.

#### 5. WCAG AA contrast rejection

**Test:** In the Branding tab, set a primary colour and text colour combination that fails WCAG AA (e.g. light yellow on white). Click Save.
**Expected:** Save is blocked with a specific error message naming the failing combination.
**Why human:** Requires UI interaction and reading the error message text.

---

### Gaps Summary

No gaps. All 12 observable truths verified. All 17 artifacts exist, are substantive, and are wired to their consumers. All 6 requirement IDs (AUTH-09, BRAND-01 through BRAND-05) are satisfied with concrete implementation evidence.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
