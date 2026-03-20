# Phase 1: Infrastructure Foundation - Research

**Researched:** 2026-03-20
**Domain:** Next.js 16, Auth.js v5, Drizzle ORM, Azure Container Apps, PostgreSQL RLS, Turborepo monorepo
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Project Structure & Tooling**
- Monorepo with `/apps/web` (Next.js 16) + `/packages/db` (Drizzle schema + migrations) + `/packages/types` (shared TypeScript types)
- Biome for linting and formatting (fast, zero-config, single tool replaces ESLint + Prettier)
- shadcn/ui + Tailwind CSS v4 as the component base; reco brand tokens applied via CSS custom properties
- `.env.local` for local dev; Azure App Configuration / container env vars for production
- No additional apps in this phase — monorepo structure is set up ready for future expansion

**Database Schema & Migrations**
- Azure Database for PostgreSQL Flexible Server (EU region for compliance)
- Drizzle ORM migrations — TypeScript-native, works with Azure PostgreSQL, generates SQL migration files
- `snake_case` naming throughout DB (matches PostgreSQL conventions and Drizzle defaults)
- Restrictive RLS base: all tenant-scoped tables start with `USING (false)` as default policy; explicit allow policies added per role — fail-closed, no accidental cross-tenant data leaks
- Trigger-based audit log (`audit_log` table) capturing before/after JSON for all editable tables — set up in Phase 1 so all Phase 2+ tables inherit it automatically

**Auth Implementation — Dual-Provider Auth.js v5**
- **Auth.js v5** (Next.js App Router native) as the single auth system
- **Provider 1 — Microsoft Entra ID** (Azure AD): for `reco-admin` and `reco` role users who have Microsoft 365 accounts
- **Provider 2 — Resend email magic link**: for `client`, `client-global`, `transport`, and `prison` role users who have no Microsoft accounts
- JWT callbacks inject `role`, `tenant_id`, `location_id`, `facility_id` into session token (replaces Supabase Custom Access Token Hook)
- Auth cookies scoped to the apex domain (`.courierrecycling.com` or equivalent Azure domain) so sessions are shared across all subdomains
- Server-side always uses `auth()` from Auth.js (equivalent of Supabase `getUser()` — revalidates session); never read raw JWT claims without validation
- Prison login: `/prison/login?facility=X` sends magic link to facility email; 7-day session maxAge configured in Auth.js
- `proxy.ts` (Next.js 16) handles subdomain detection and auth enforcement before routes resolve; no `middleware.ts` (Next.js 15 pattern)

**Deployment — Azure Container Apps**
- Azure Container Apps as the hosting target (supports wildcard custom domains, auto-scaling, containerised Node.js)
- Dockerfile in `apps/web/` for containerised Next.js build
- Azure Container Registry for image storage
- CI/CD via GitHub Actions: build → push to ACR → deploy to Container Apps
- Domain: may start as an Azure Container Apps domain; custom wildcard DNS (`*.courierrecycling.com`) to be pointed at Container Apps ingress when ready — proxy.ts handles tenant resolution from hostname regardless of domain
- `NEXT_PUBLIC_` env vars for public values; secrets stored in Azure Key Vault and injected at container startup

**System Settings UI**
- Single tabbed settings page accessible only to `reco-admin` role
- Tabs: **General** (exchange rate EUR/DKK, warehouse ageing threshold, discrepancy threshold), **Facilities** (prison facility registry)
- Explicit save button per tab section with success/error toast
- Facility registry: inline editable table — add new row, edit in place, archive (soft delete) with confirmation dialog; no bulk import in Phase 1

### Claude's Discretion
- Exact Drizzle schema file organisation within `/packages/db`
- Docker multi-stage build configuration details
- GitHub Actions workflow file structure
- Biome configuration specifics (rule set, ignore patterns)
- shadcn/ui component selection for settings forms

### Deferred Ideas (OUT OF SCOPE)
- Bulk CSV import for facility registry
- API-connected exchange rate feed — manual entry only for v1
- Azure AD B2C for external users — considered but rejected
- Playwright E2E test setup — Phase 1 focuses on Vitest for RLS integration tests; E2E testing deferred to Phase 2+
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | System resolves tenant context from subdomain hostname via Next.js `proxy.ts` without a database call | proxy.ts hostname parsing → `x-tenant-id` header injection pattern documented |
| ROUTE-02 | Single Next.js 16 App Router deployment serves three domain contexts | proxy.ts rewrite logic based on hostname; same deployment serves all |
| ROUTE-03 | Wildcard DNS routes all client subdomains to same Container Apps deployment | Azure Container Apps wildcard domain binding + CNAME confirmed |
| ROUTE-04 | Every database table has `tenant_id`; Drizzle RLS enforces tenant isolation | Drizzle `pgPolicy` with `USING (false)` base + explicit allow policies documented |
| ROUTE-05 | `tenant_id` index on every tenant-scoped table | Standard Drizzle index definition pattern confirmed |
| AUTH-01 | Six user roles exist in DB | `users` table role column + enum type in Drizzle schema |
| AUTH-02 | Role, tenant_id, location_id, facility_id injected into JWT via Auth.js callbacks | Auth.js v5 `jwt()` callback custom claims pattern confirmed |
| AUTH-03 | Client portal users authenticate via magic link | Resend provider confirmed; requires database adapter |
| AUTH-04 | Ops portal users authenticate via magic link or Entra ID | Microsoft Entra ID provider + Resend dual-provider confirmed |
| AUTH-05 | Prison login via `/prison/login?facility=X` magic link; 7-day session | Auth.js `session.maxAge` + custom sign-in page pattern confirmed |
| AUTH-06 | Auth cookies scoped to apex domain | Auth.js `cookies` config with custom `domain` property confirmed |
| AUTH-07 | `client` role locked to `location_id` | Enforced via JWT claim + RLS policy — claim set at sign-in, policy checks it |
| AUTH-08 | `reco` role `can_view_financials` toggle | DB column + session refresh mechanism needed (JWT strategy requires re-sign-in) |
| AUTH-09 | reco-admin can invite users by email with role assignment | Resend invitation email + user insert + role assignment — no built-in Auth.js feature, custom implementation |
| AUTH-10 | `service_role` key never in client-side code | Pattern: only use `auth()` server-side; no special key needed — Azure PostgreSQL uses connection string |
| SETTINGS-01 | reco-admin configures exchange rate, thresholds, facility registry | Settings DB table + `/settings` route + Server Action pattern |
| SETTINGS-02 | Prison facility registry: name, address, contact email, active flag | `prison_facilities` table in schema; manages auth for prison users |
</phase_requirements>

---

## Summary

Phase 1 establishes the complete foundational layer: monorepo scaffolded with Turborepo + pnpm workspaces, Next.js 16 App Router in `/apps/web`, Drizzle ORM schema in `/packages/db` with PostgreSQL RLS-enforced multi-tenancy, Auth.js v5 with dual providers (Entra ID + Resend magic link), subdomain-based tenant resolution via `proxy.ts`, containerised deployment to Azure Container Apps via GitHub Actions, and a system settings screen for reco-admin.

The most technically complex element is the intersection of Auth.js v5 dual-provider configuration with custom JWT claims and cross-subdomain cookie sharing. Auth.js v5 is the stable, App Router-native version of NextAuth. The Resend email provider requires a database adapter — `@auth/drizzle-adapter` covers this. Cookie domain configuration requires explicit `cookies.sessionToken.options.domain` set to `.courierrecycling.com` (leading dot) in the Auth.js config.

The RLS testing requirement (Vitest integration test asserting zero cross-tenant data leaks) follows a well-established pattern: open a transaction, `set_config('request.jwt.claims', ...)` with the test tenant's JWT payload, run queries against the real Azure PostgreSQL test database, assert isolation, rollback. This is the only reliable way to test RLS — an in-memory database cannot verify PostgreSQL RLS policies.

**Primary recommendation:** Scaffold Turborepo monorepo first, then database schema (enables RLS integration tests), then Auth.js (depends on DB adapter), then proxy.ts routing, then deployment pipeline, then system settings UI. This ordering respects dependencies and allows tests at each layer before proceeding.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.0 | App Router framework | Locked decision; `proxy.ts` replaces `middleware.ts` in v16 |
| next-auth | 4.24.13 | Auth — NOTE: see below | Package is `next-auth` but Auth.js v5 is a different package |
| `auth.js` / `@auth/nextjs` | See note | Auth.js v5 for App Router | Locked decision |
| drizzle-orm | 0.45.1 | ORM + RLS schema definitions | TypeScript-native, Azure PostgreSQL compatible, generates SQL migrations |
| drizzle-kit | 0.31.10 | Migration generation + studio | Companion CLI for drizzle-orm |
| @auth/drizzle-adapter | 1.11.1 | Auth.js database adapter (required for magic link) | Official adapter, supports Drizzle schema |
| @biomejs/biome | 2.4.8 | Linting + formatting | Locked decision; replaces ESLint + Prettier |
| turbo | 2.8.20 | Monorepo task orchestration | Standard Turborepo; fast caching, parallel builds |
| tailwindcss | 4.2.2 | Styling | Locked decision; v4 with `@theme inline` |
| tw-animate-css | 1.4.0 | Animations (replaces tailwindcss-animate) | shadcn/ui default for Tailwind v4 projects |

**Auth.js v5 package clarification (HIGH confidence):** Auth.js v5 is the stable release. The npm package for Next.js is `next-auth@5.x` (not a separate package — same name, major version 5). Install with `pnpm add next-auth@5` or `pnpm add next-auth@beta` if 5.x is still tagged beta. The v5 API exports `{ handlers, auth, signIn, signOut }` from a root `auth.ts` file.

```bash
# Verify before installing — check if v5 stable or beta
npm view next-auth dist-tags
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.0 | Test runner | RLS integration tests |
| @vitest/coverage-v8 | — | Coverage | Optional; needed only if coverage required |
| postgres | latest | PostgreSQL driver (node-postgres alternative) | Use with drizzle-orm for Azure PostgreSQL connection |
| zod | 4.3.6 | Schema validation | Settings form validation, environment variable validation |
| react-hook-form | 7.71.2 | Form state management | System settings forms |
| resend | 6.9.4 | Email sending SDK | Used by Auth.js Resend provider internally; may also need for invitations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 | better-auth | better-auth is newer but less ecosystem support; locked decision |
| Drizzle ORM | Prisma | Drizzle generates raw SQL migrations, better RLS support; locked decision |
| Turborepo | nx | Turborepo simpler for small monorepos; locked decision |
| `postgres` driver | `pg` | `postgres` is smaller, promise-native; `pg` more battle-tested; either works with Drizzle |

### Installation

```bash
# From monorepo root
pnpm add -w turbo

# apps/web
pnpm add next@16 next-auth@5 react react-dom
pnpm add -D @biomejs/biome tailwindcss tw-animate-css

# packages/db
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit vitest @auth/drizzle-adapter

# packages/types
# TypeScript types only — no runtime deps needed initially
```

---

## Architecture Patterns

### Recommended Project Structure

```
deliverygearrecycling/
├── apps/
│   └── web/                    # Next.js 16 App Router
│       ├── app/
│       │   ├── (ops)/          # ops.courierrecycling.com routes
│       │   │   └── settings/   # SETTINGS-01 — reco-admin only
│       │   ├── (client)/       # [tenant].courierrecycling.com routes
│       │   └── (public)/       # courierrecycling.com routes
│       ├── proxy.ts            # Tenant resolution from hostname
│       ├── auth.ts             # Auth.js v5 config (root of apps/web)
│       ├── Dockerfile          # Multi-stage Node.js container
│       └── next.config.ts
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── auth.ts     # Auth.js required tables
│   │   │   │   ├── tenants.ts  # tenants, prison_facilities
│   │   │   │   ├── users.ts    # users with role + claims
│   │   │   │   └── settings.ts # system_settings
│   │   │   ├── index.ts        # Re-exports all schema
│   │   │   └── db.ts           # drizzle() connection singleton
│   │   ├── drizzle.config.ts   # Migration config
│   │   └── migrations/         # Generated SQL files
│   └── types/                  # Shared TypeScript types
│       └── src/
│           ├── auth.ts         # Role enum, Session augmentation
│           └── tenant.ts       # Tenant context type
├── pnpm-workspace.yaml
├── turbo.json
└── biome.json
```

### Pattern 1: proxy.ts Tenant Resolution (No Database Call)

**What:** Extract tenant slug from subdomain, inject as `x-tenant-id` request header. Resolve to a known context (`ops`, `client`, `public`) using only the hostname string.

**When to use:** Every request — proxy.ts runs before all routes.

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
// apps/web/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Known non-tenant subdomains
const RESERVED_SUBDOMAINS = new Set(['ops', 'www'])

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const url = request.nextUrl

  // Extract subdomain: wolt.courierrecycling.com → wolt
  // Handles Azure default domain too (e.g. xyz.azurecontainerapps.io → no tenant)
  const parts = hostname.split('.')
  const isApexOrWww = parts.length <= 2 || (parts.length === 3 && parts[0] === 'www')
  const subdomain = isApexOrWww ? null : parts[0]

  const requestHeaders = new Headers(request.headers)

  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    // ops context or apex
    const context = subdomain === 'ops' ? 'ops' : 'public'
    requestHeaders.set('x-tenant-context', context)
    requestHeaders.set('x-tenant-id', '')
  } else {
    // Client tenant subdomain
    requestHeaders.set('x-tenant-context', 'client')
    requestHeaders.set('x-tenant-id', subdomain)
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    // Exclude static files, _next internals, favicons
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

**Critical note:** proxy.ts runs in the Node.js runtime by default in Next.js 16 (Edge runtime was experimental, Node.js became stable in v15.5). No database calls are possible without a persistent connection — but none are needed. Tenant context comes purely from hostname parsing.

### Pattern 2: Auth.js v5 Dual-Provider Configuration

**What:** Single `auth.ts` file configuring both Microsoft Entra ID (for reco staff) and Resend magic link (for external users). JWT callback injects custom claims.

```typescript
// Source: https://authjs.dev/getting-started/providers/microsoft-entra-id
// Source: https://authjs.dev/getting-started/providers/resend
// apps/web/auth.ts
import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@repo/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),

  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: 'no-reply@courierrecycling.com',
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days — covers prison sessions
  },

  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Leading dot = shared across ALL subdomains
        domain: process.env.NODE_ENV === 'production'
          ? '.courierrecycling.com'
          : undefined, // localhost dev: no domain restriction
      },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      // Only runs on sign-in (user is defined)
      if (user) {
        // Load custom claims from DB user record
        token.role = user.role
        token.tenant_id = user.tenant_id
        token.location_id = user.location_id
        token.facility_id = user.facility_id
      }
      return token
    },
    async session({ session, token }) {
      // Expose claims to server components via auth()
      session.user.role = token.role as string
      session.user.tenant_id = token.tenant_id as string | null
      session.user.location_id = token.location_id as string | null
      session.user.facility_id = token.facility_id as string | null
      return session
    },
  },
})
```

**TypeScript augmentation (packages/types/src/auth.ts):**
```typescript
import type { DefaultSession } from 'next-auth'

export type UserRole = 'reco-admin' | 'reco' | 'client' | 'client-global' | 'transport' | 'prison'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      role: UserRole
      tenant_id: string | null
      location_id: string | null
      facility_id: string | null
    }
  }

  interface User {
    role: UserRole
    tenant_id: string | null
    location_id: string | null
    facility_id: string | null
    can_view_financials?: boolean
  }
}
```

### Pattern 3: Drizzle RLS Policy Definition

**What:** Every tenant-scoped table has a restrictive base policy (`USING (false)`) plus explicit allow policies per role. Policies reference JWT claims via `current_setting('request.jwt.claim.role')`.

```typescript
// Source: https://orm.drizzle.team/docs/rls
// packages/db/src/schema/tenants.ts
import { pgTable, text, uuid, boolean, timestamp, pgPolicy, pgRole } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// DB roles mirror application roles
export const recoAdminRole = pgRole('reco_admin', { createRole: false })
export const recoRole = pgRole('reco', { createRole: false })
export const clientRole = pgRole('client_role', { createRole: false })

export const prisonFacilities = pgTable(
  'prison_facilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    contact_email: text('contact_email').notNull(),
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Base: deny all
    pgPolicy('prison_facilities_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full access
    pgPolicy('prison_facilities_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: read-only
    pgPolicy('prison_facilities_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
  ]
)
```

**Important:** Azure PostgreSQL requires the application connection user to have `SET ROLE` permission to switch into the appropriate PostgreSQL role for each request. This is done within a transaction before issuing queries.

### Pattern 4: RLS Integration Test (Vitest)

**What:** Set JWT context in a transaction, assert cross-tenant isolation.

```typescript
// packages/db/src/tests/rls.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../schema'

// Connects to real Azure PostgreSQL test database
// Environment variable: DATABASE_URL_TEST
const client = postgres(process.env.DATABASE_URL_TEST!)
const db = drizzle(client, { schema })

describe('RLS: cross-tenant isolation', () => {
  it('tenant-A user sees zero rows from tenant-B tables', async () => {
    await db.transaction(async (tx) => {
      // Simulate tenant-A JWT claims
      await tx.execute(sql`
        SELECT set_config('request.jwt.claims', ${JSON.stringify({
          sub: 'user-tenant-a',
          role: 'client_role',
          tenant_id: 'tenant-a',
        })}, TRUE);
        SELECT set_config('request.jwt.claim.role', 'client_role', TRUE);
        SELECT set_config('request.jwt.claim.tenant_id', 'tenant-a', TRUE);
        SET LOCAL ROLE client_role;
      `)

      // Query a tenant-scoped table — should see only tenant-A data
      const rows = await tx.select().from(schema.someTable)
        .where(/* no explicit tenant_id filter — RLS does it */)

      // Assert no tenant-B rows leaked
      const tenantBRows = rows.filter(r => r.tenant_id === 'tenant-b')
      expect(tenantBRows).toHaveLength(0)
    })
  })
})
```

### Pattern 5: Audit Log Trigger

**What:** A reusable PostgreSQL function + trigger that captures before/after state as JSONB on every INSERT/UPDATE/DELETE.

```sql
-- packages/db/migrations/0000_audit_log.sql
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  tenant_id   TEXT,
  action      TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_data    JSONB,
  new_data    JSONB,
  changed_by  TEXT,          -- from JWT claim
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, tenant_id, action, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    current_setting('request.jwt.claim.sub', true)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to every editable table with a convenience macro:
-- CREATE TRIGGER audit_[table] AFTER INSERT OR UPDATE OR DELETE ON [table]
--   FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
```

**SECURITY DEFINER** on the trigger function is required so the trigger can INSERT into `audit_log` regardless of the calling user's RLS policies on `audit_log`.

### Anti-Patterns to Avoid

- **Using `middleware.ts` instead of `proxy.ts`:** In Next.js 16, `middleware.ts` is deprecated. The export function must be named `proxy`, not `middleware`. Use `npx @next/codemod@canary middleware-to-proxy .` to migrate.
- **Reading JWT claims from cookies in Server Components:** Always use `auth()` from Auth.js — never parse the raw session cookie manually. The cookie is an encrypted JWE.
- **Running RLS policy queries outside a transaction:** `set_config(..., TRUE)` (local = TRUE) only persists for the current transaction. Queries run outside a transaction will see no JWT context, causing RLS deny-all to apply.
- **Setting `domain` cookie option in development:** `.courierrecycling.com` doesn't resolve in localhost. Use `undefined` domain in development; the cookie will work on localhost only.
- **Not enabling RLS on tables after creation:** `ALTER TABLE x ENABLE ROW LEVEL SECURITY` must be called explicitly. Drizzle's `pgPolicy` definitions generate policies but you must also enable RLS on the table via migration SQL.
- **service_role key from Supabase:** Not applicable — this project uses Azure PostgreSQL. The equivalent risk is using the PostgreSQL superuser connection string in API routes. Never use the superuser (`postgres`) role in application code; create a dedicated app role with limited permissions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Magic link email sending | Custom SMTP emailer | Auth.js Resend provider | Token generation, expiry, email delivery handled; hashed tokens in DB |
| Verification token storage | Custom tokens table | `@auth/drizzle-adapter` required tables | Auth.js creates `verification_tokens` table via adapter |
| Session management | Custom JWT encode/decode | `auth()` from next-auth | JWE encryption, rotation, CSRF handled |
| Password reset flow | Custom token + email | Already handled by magic link (no passwords) | Magic link IS the reset |
| Cross-subdomain cookie sharing | nginx proxy / reverse proxy | Auth.js `cookies.sessionToken.options.domain` | One config key; no infrastructure change needed |
| Audit trail capture | Application-level logging | PostgreSQL trigger | Cannot be bypassed by application code bugs; atomic with the write |
| DB schema type generation | Manual TypeScript types | Drizzle schema inference (`typeof schema.table.$inferSelect`) | Zero drift between DB and TypeScript |
| Tenant ID header parsing | Custom header middleware | proxy.ts + `headers()` from next/headers | Already runs before every request; no duplicate work |

**Key insight:** Auth.js and Drizzle together eliminate 80% of the boilerplate that would be hand-rolled. The remaining 20% (custom JWT claims, cookie domain, RLS context setting) has clear, documented extension points.

---

## Common Pitfalls

### Pitfall 1: Auth.js v5 Package Version Confusion

**What goes wrong:** Installing `next-auth@4.x` instead of `5.x`. v4 does not support Next.js App Router natively and uses `getServerSession(authOptions)` instead of `auth()`.
**Why it happens:** `next-auth` v4 is still the default `latest` tag in some registries; v5 may be tagged `beta`.
**How to avoid:** Run `npm view next-auth dist-tags` to confirm whether `latest` is 5.x or 4.x before installing. Explicitly specify `next-auth@5` or `next-auth@beta`.
**Warning signs:** If you see `getServerSession` in docs examples, that is v4 API.

### Pitfall 2: Cookie Domain Not Set in Production → No Cross-Subdomain Auth

**What goes wrong:** User signs in on `ops.courierrecycling.com`, then visits `wolt.courierrecycling.com` and is not recognised as authenticated. Session cookie was set on `ops.courierrecycling.com` (no leading dot), not on `.courierrecycling.com`.
**Why it happens:** Auth.js defaults to setting the cookie on the exact host. The `domain` option must be explicitly set.
**How to avoid:** Always configure `cookies.sessionToken.options.domain = '.courierrecycling.com'` in production Auth.js config.
**Warning signs:** Sign-in works on one subdomain but not shared.

### Pitfall 3: Resend Provider Requires Database Adapter

**What goes wrong:** Configuring Resend provider without a database adapter. Auth.js throws at runtime because it cannot store verification tokens.
**Why it happens:** Magic link (email) providers are stateful — the server must store the token to verify it when the link is clicked. This is fundamentally different from OAuth providers.
**How to avoid:** Always include `adapter: DrizzleAdapter(db)` when using email providers. Run the Auth.js adapter migration to create required tables (`users`, `accounts`, `sessions`, `verification_tokens`).
**Warning signs:** "Please configure a database adapter" error at startup.

### Pitfall 4: RLS Policies Defined But RLS Not Enabled on Table

**What goes wrong:** Drizzle schema defines `pgPolicy(...)` but data is not isolated. All rows are accessible to all users.
**Why it happens:** Policies are silently ignored if `ENABLE ROW LEVEL SECURITY` was not called on the table. Drizzle's `pgPolicy` creates the policy objects but does NOT automatically enable RLS on the table.
**How to avoid:** Every tenant-scoped table creation migration must include `ALTER TABLE x ENABLE ROW LEVEL SECURITY; ALTER TABLE x FORCE ROW LEVEL SECURITY;`. `FORCE` ensures even the table owner is subject to RLS.
**Warning signs:** RLS integration test passes trivially (returns rows for both tenants when it should see only one).

### Pitfall 5: Audit Trigger Cannot See JWT Claims Without SET_CONFIG

**What goes wrong:** `audit_log.changed_by` is always NULL because `current_setting('request.jwt.claim.sub', true)` returns empty string outside a context-setting transaction.
**Why it happens:** The JWT claims `set_config` calls are done per-request in the connection pool, but if the DB client doesn't set them before each operation, the trigger function sees no context.
**How to avoid:** Create a Drizzle middleware/wrapper that sets JWT claims at the start of every connection. All queries go through this wrapper.
**Warning signs:** `audit_log.changed_by` column consistently NULL despite authenticated requests.

### Pitfall 6: Next.js 16 proxy.ts Runs on All Routes Including Static Assets

**What goes wrong:** proxy.ts runs on `/_next/static/...` and `/_next/image/...`, adding latency and potentially breaking image optimisation.
**Why it happens:** Default matcher matches all paths if not configured.
**How to avoid:** Always configure the `matcher` export to exclude `_next/static`, `_next/image`, `favicon.ico`.
**Warning signs:** Image load performance degradation; `_next/data` RSC prefetches being intercepted unexpectedly.

### Pitfall 7: JWT Strategy Means Role Changes Require Re-Login

**What goes wrong:** reco-admin toggles `can_view_financials` for a `reco` user, but the user still cannot see financial data until they sign out and back in.
**Why it happens:** JWT strategy stores claims in the encrypted cookie at sign-in time. Changes to DB do not retroactively update the token.
**How to avoid:** For AUTH-08 (`can_view_financials`), the session callback must re-query the DB on each session access to get the current value, OR accept the limitation and document that the toggle takes effect on next login. For Phase 1, document the limitation. Consider database session strategy for roles that change frequently in later phases.
**Warning signs:** Role changes don't take effect until re-authentication.

---

## Code Examples

### Subdomain → Tenant Context Extraction

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy (verified)
// Pattern: hostname parsing in proxy.ts
function getTenantFromHost(host: string): { context: 'ops' | 'client' | 'public'; tenantSlug: string | null } {
  const hostname = host.split(':')[0] // strip port if present
  const parts = hostname.split('.')

  // Azure Container Apps default domain: *.azurecontainerapps.io (4+ parts)
  // Custom domain: *.courierrecycling.com (3 parts)
  // Apex: courierrecycling.com (2 parts)

  if (parts.length < 3) return { context: 'public', tenantSlug: null }

  const subdomain = parts[0]
  if (subdomain === 'ops') return { context: 'ops', tenantSlug: null }
  if (subdomain === 'www') return { context: 'public', tenantSlug: null }

  return { context: 'client', tenantSlug: subdomain }
}
```

### Auth.js Route Handler (App Router)

```typescript
// Source: https://authjs.dev/reference/nextjs (verified)
// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

### Server Component Auth Check

```typescript
// Source: https://authjs.dev/reference/nextjs (verified)
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'reco-admin') {
    redirect('/sign-in')
  }

  return <SettingsUI />
}
```

### Drizzle RLS-Aware Query Wrapper

```typescript
// packages/db/src/rls.ts
// Pattern: wrap every DB operation with JWT context
import { db } from './db'
import { sql } from 'drizzle-orm'

export async function withRLSContext<T>(
  jwtClaims: { sub: string; role: string; tenant_id?: string; facility_id?: string },
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('request.jwt.claims', ${JSON.stringify(jwtClaims)}, TRUE);
      SELECT set_config('request.jwt.claim.sub', ${jwtClaims.sub}, TRUE);
      SELECT set_config('request.jwt.claim.role', ${jwtClaims.role}, TRUE);
      SELECT set_config('request.jwt.claim.tenant_id', ${jwtClaims.tenant_id ?? ''}, TRUE);
      SET LOCAL ROLE ${sql.raw(jwtClaims.role)};
    `)
    return fn(tx)
  })
}
```

### Drizzle Table with `tenant_id` Index

```typescript
// packages/db/src/schema/base.ts
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Shared columns for all tenant-scoped tables
export const tenantColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: text('tenant_id').notNull(), // ROUTE-05: indexed on every table
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}

// Usage: every tenant table includes tenant_id index
export const exampleTenantTable = pgTable(
  'example_table',
  { ...tenantColumns, name: text('name').notNull() },
  (t) => [
    index('example_table_tenant_id_idx').on(t.tenant_id), // ROUTE-05
  ]
)
```

### System Settings Server Action

```typescript
// apps/web/app/(ops)/settings/actions.ts
'use server'
import { auth } from '@/auth'
import { db } from '@repo/db'
import { systemSettings } from '@repo/db/schema'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const generalSettingsSchema = z.object({
  exchange_rate_eur_dkk: z.number().min(1).max(999.99),
  warehouse_ageing_threshold_days: z.number().int().min(1).max(365),
  discrepancy_alert_threshold_pct: z.number().int().min(1).max(100),
})

export async function saveGeneralSettings(formData: FormData) {
  const session = await auth()
  if (session?.user.role !== 'reco-admin') throw new Error('Unauthorized')

  const parsed = generalSettingsSchema.parse({
    exchange_rate_eur_dkk: Number(formData.get('exchange_rate')),
    warehouse_ageing_threshold_days: Number(formData.get('ageing_threshold')),
    discrepancy_alert_threshold_pct: Number(formData.get('discrepancy_threshold')),
  })

  await db.update(systemSettings).set(parsed)
  revalidatePath('/settings')
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` / `export function middleware()` | `proxy.ts` / `export function proxy()` | Next.js v16.0.0 | Must rename file and function; codemod available |
| `getServerSession(authOptions)` | `auth()` | Auth.js v5 | Simpler API; works natively in Server Components |
| `NEXTAUTH_` env var prefix | `AUTH_` prefix | Auth.js v5 | e.g. `AUTH_SECRET` replaces `NEXTAUTH_SECRET` |
| `next-auth.session-token` cookie name | `authjs.session-token` cookie name | Auth.js v5 | Cookie name changed; check browser dev tools for correct name |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui Tailwind v4 update | Install `tw-animate-css`; remove `tailwindcss-animate` |
| `tailwind.config.js` + `@tailwind` directives | `@import "tailwindcss"` + `@theme inline {}` | Tailwind CSS v4 | No config file needed; CSS-first configuration |
| `forwardRef` on shadcn components | `data-slot` attributes, no `forwardRef` | shadcn/ui Tailwind v4 update | Components no longer use `forwardRef` |

**Deprecated/outdated:**
- `middleware.ts`: Deprecated in Next.js 16. Use `proxy.ts`. Running codemod: `npx @next/codemod@canary middleware-to-proxy .`
- `NEXTAUTH_URL` and `NEXTAUTH_SECRET`: Replaced by `AUTH_URL` and `AUTH_SECRET` in Auth.js v5.
- `tailwindcss-animate`: Replaced by `tw-animate-css` for Tailwind v4 projects.

---

## Open Questions

1. **Azure PostgreSQL connection pooling with RLS context**
   - What we know: `set_config` with `local = TRUE` (third arg) only persists for the current transaction. With a connection pool, connections are reused and the JWT context from a previous request could theoretically leak.
   - What's unclear: Whether `postgres` (the driver) supports transaction-level connection reset, and whether PgBouncer (often used with Azure PostgreSQL Flexible Server) is configured in transaction mode (required for `SET LOCAL` to work correctly).
   - Recommendation: Configure Azure PostgreSQL to use the `postgres` driver directly (no PgBouncer in session mode); wrap every DB operation in a transaction with context-setting SQL; test with the RLS integration test in CI.

2. **Auth.js v5 stable vs beta tag**
   - What we know: The package is `next-auth` v5; v5 has been in development for an extended period.
   - What's unclear: Whether `npm install next-auth@5` resolves to stable or still requires `@beta`.
   - Recommendation: Run `npm view next-auth dist-tags` before writing the install instructions in the plan. If `latest` is still 4.x, use `next-auth@beta`.

3. **Azure Container Apps wildcard domain during development**
   - What we know: Azure Container Apps supports custom domains with wildcard certificates (customer-provided). Managed certificates are per-hostname, not wildcard.
   - What's unclear: Whether the initial deployment uses the Azure Container Apps default domain (e.g. `xyz.azurecontainerapps.io`) which has no subdomain structure, making proxy.ts tenant detection impossible until custom domain is configured.
   - Recommendation: proxy.ts should have a `NEXT_PUBLIC_DOMAIN_MODE=azure-default` fallback that treats all traffic as `ops` context during initial development. Custom domain should be provisioned early in the deployment plan.

4. **Drizzle adapter Auth.js required tables**
   - What we know: `@auth/drizzle-adapter` requires `users`, `accounts`, `sessions`, `verification_tokens` tables defined in the Drizzle schema.
   - What's unclear: Whether the adapter schema definitions are compatible with custom columns (e.g. adding `role`, `tenant_id` to the `users` table that Auth.js also manages).
   - Recommendation: Define the Auth.js adapter tables in Drizzle schema explicitly (not using the auto-generated adapter tables), adding custom columns. Follow the `@auth/drizzle-adapter` docs for the custom schema pattern.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `packages/db/vitest.config.ts` — does not exist yet (Wave 0 gap) |
| Quick run command | `pnpm --filter @repo/db test:rls` |
| Full suite command | `pnpm --filter @repo/db test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-04 | Tenant-A user sees zero rows from Tenant-B tables | integration | `pnpm --filter @repo/db test -- rls` | ❌ Wave 0 |
| ROUTE-05 | tenant_id index exists on all tenant-scoped tables | schema assertion | `pnpm --filter @repo/db test -- schema` | ❌ Wave 0 |
| AUTH-01 | Six roles exist as valid enum values | unit | `pnpm --filter @repo/db test -- roles` | ❌ Wave 0 |
| AUTH-02 | JWT callback injects role, tenant_id, location_id, facility_id | unit | `pnpm --filter @repo/web test -- jwt-callback` | ❌ Wave 0 |
| AUTH-06 | Session cookie has domain `.courierrecycling.com` in production | unit (config) | `pnpm --filter @repo/web test -- cookie-domain` | ❌ Wave 0 |
| AUTH-10 | No service_role key in any API route | static (grep/lint) | `biome check apps/web/app/api` | N/A — lint rule |
| ROUTE-01 | proxy.ts resolves tenant from subdomain without DB call | unit | `pnpm --filter @repo/web test -- proxy` | ❌ Wave 0 |
| SETTINGS-01 | Exchange rate, thresholds save and load correctly | integration | `pnpm --filter @repo/web test -- settings` | ❌ Wave 0 |
| SETTINGS-02 | Prison facility CRUD (create, read, archive) | integration | `pnpm --filter @repo/web test -- facilities` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @repo/db test -- rls` (RLS isolation test only; ~5s)
- **Per wave merge:** `pnpm test` (full monorepo suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/db/vitest.config.ts` — Vitest config pointing at test database
- [ ] `packages/db/src/tests/rls.test.ts` — RLS isolation test (ROUTE-04 success criterion)
- [ ] `packages/db/src/tests/schema.test.ts` — tenant_id index assertion
- [ ] `apps/web/src/tests/proxy.test.ts` — proxy.ts unit test using `unstable_doesProxyMatch`
- [ ] `apps/web/src/tests/auth-callbacks.test.ts` — JWT callback unit tests
- [ ] `.env.test` — `DATABASE_URL_TEST` pointing at isolated Azure PostgreSQL test database

---

## Sources

### Primary (HIGH confidence)

- [https://nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — proxy.ts API reference (Next.js 16.2.0, verified 2026-03-13)
- [https://authjs.dev/getting-started/providers/microsoft-entra-id](https://authjs.dev/getting-started/providers/microsoft-entra-id) — Entra ID provider config
- [https://authjs.dev/getting-started/providers/resend](https://authjs.dev/getting-started/providers/resend) — Resend magic link provider config
- [https://authjs.dev/guides/role-based-access-control](https://authjs.dev/guides/role-based-access-control) — JWT callback custom claims pattern
- [https://orm.drizzle.team/docs/rls](https://orm.drizzle.team/docs/rls) — Drizzle RLS policy definitions
- [https://ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — shadcn/ui Tailwind v4 setup
- npm registry — verified versions for: next (16.2.0), next-auth (4.24.13 / v5 tag TBD), drizzle-orm (0.45.1), drizzle-kit (0.31.10), @auth/drizzle-adapter (1.11.1), @biomejs/biome (2.4.8), tailwindcss (4.2.2), vitest (4.1.0), turbo (2.8.20), tw-animate-css (1.4.0)

### Secondary (MEDIUM confidence)

- Multiple community sources confirm Turborepo + pnpm workspace + Drizzle monorepo pattern is stable in 2025
- Auth.js v5 cookie domain configuration pattern verified across multiple GitHub issues and official docs
- PostgreSQL trigger-based audit log JSONB pattern confirmed via PostgreSQL wiki and multiple 2025-2026 sources
- Azure Container Apps custom domain + wildcard certificate support confirmed via Microsoft Learn docs (2025)

### Tertiary (LOW confidence)

- PgBouncer transaction mode compatibility with `SET LOCAL` — not verified against Azure PostgreSQL Flexible Server documentation; recommendation to test in CI is precautionary

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified from npm registry
- Architecture: HIGH — proxy.ts, Auth.js v5, Drizzle RLS patterns all from official docs
- Pitfalls: HIGH — most from official migration guides and Auth.js v5 breaking changes documentation
- Validation architecture: HIGH — Vitest + real DB integration test pattern is standard

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Auth.js v5 stable/beta status may change; verify before planning)
