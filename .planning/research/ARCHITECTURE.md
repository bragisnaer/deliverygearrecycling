# Architecture Research

**Domain:** Multi-tenant SaaS — circular gear operations platform
**Researched:** 2026-03-19
**Confidence:** HIGH (patterns verified against official Next.js docs, Supabase docs, and production ecosystem sources)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DNS / Vercel Edge                               │
│  *.courierrecycling.com → single deployment (wildcard CNAME)             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       middleware.ts  (Edge Runtime)                      │
│  1. Reads hostname → resolves domain context                             │
│  2. Injects x-domain-context header (marketing / ops / client)           │
│  3. Rewrites URL to route group: /app/(ops) /app/(client) /app/(public)  │
│  4. Calls supabase.auth.getClaims() → injects x-user-role header         │
│  5. Redirects unauthenticated requests to /login                         │
│  6. Refreshes session cookie                                             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                    Next.js App Router  (app/)                            │
│                                                                          │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐     │
│  │  (public)/   │  │    (ops)/        │  │      (client)/         │     │
│  │  marketing   │  │  ops portal      │  │  tenant portal         │     │
│  │  ISR pages   │  │  layout guards   │  │  tenant-scoped         │     │
│  │  no auth     │  │  role-gated      │  │  branding              │     │
│  └──────────────┘  └──────────────────┘  └────────────────────────┘     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            Shared: Server Actions + Route Handlers               │   │
│  │  /api/notifications  /api/webhooks  /api/public-stats           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         Supabase                                         │
│                                                                          │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Auth       │  │  PostgreSQL       │  │  Realtime  │  │  Storage  │  │
│  │  + JWT hook │  │  + RLS policies  │  │  channels  │  │  buckets  │  │
│  └─────────────┘  └──────────────────┘  └────────────┘  └───────────┘  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │               Edge Functions                                    │    │
│  │  send-email (Resend)   custom-access-token-hook                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| middleware.ts | Domain context resolution, session refresh, auth redirect, role-based rewrite | Next.js Edge Middleware, `@supabase/ssr` |
| `(public)` route group | Marketing site — ISR pages, public stats API, no auth | Next.js ISR, read-only Supabase client |
| `(ops)` route group | reco + transport + prison portal — all internal roles | Layout-level role guard via server component |
| `(client)` route group | Tenant portal — client and client-global roles, tenant-scoped branding | Layout reads tenant branding, injects CSS vars |
| `TenantProvider` | Injects tenant context (id, slug, branding) into React tree | Server component reads from middleware header, passes to context |
| `RoleGuard` layout | Checks user role against allowed roles, redirects if insufficient | Server component reads JWT claims via `getClaims()` |
| Supabase Auth + Custom Hook | Issues JWT with `role`, `tenant_id`, `facility_id` as `app_metadata` claims | PL/pgSQL `custom_access_token_hook` function |
| RLS policies | Enforces data isolation at DB layer — tenant, role, facility | PostgreSQL RLS on every table |
| Realtime channel | Pushes notification inserts to connected clients | Client component `useEffect` subscription, filtered by `user_id` |
| Edge Functions | Transactional email dispatch, access token hook | Supabase Edge Functions (Deno) |
| Storage buckets | Photos, logos, PDFs | Supabase Storage with RLS bucket policies |

---

## Recommended Project Structure

```
/
├── middleware.ts                 # Domain context + auth + role routing
├── app/
│   ├── (public)/                 # courierrecycling.com — no auth
│   │   ├── layout.tsx            # Marketing shell, reco brand
│   │   ├── page.tsx              # Home
│   │   └── api/
│   │       └── public-stats/
│   │           └── route.ts      # Aggregated stats endpoint (ISR-friendly)
│   │
│   ├── (ops)/                    # ops.courierrecycling.com — internal roles
│   │   ├── layout.tsx            # Auth check + role guard (server component)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx          # reco-admin + reco only
│   │   ├── pickups/
│   │   │   └── page.tsx
│   │   ├── transport/
│   │   │   └── page.tsx
│   │   ├── prison/               # prison role — simplified tablet UI
│   │   │   ├── layout.tsx        # Danish lang, large touch targets
│   │   │   ├── page.tsx          # Facility dashboard
│   │   │   ├── intake/
│   │   │   └── processing/
│   │   ├── finance/              # reco-admin + reco (if toggled)
│   │   ├── admin/                # reco-admin only
│   │   │   ├── users/
│   │   │   ├── tenants/
│   │   │   └── settings/
│   │   └── api/
│   │       └── notifications/
│   │           └── route.ts
│   │
│   ├── (client)/                 # [client].courierrecycling.com
│   │   ├── layout.tsx            # Tenant branding injection + auth check
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── pickups/
│   │   │   ├── page.tsx          # List
│   │   │   └── new/
│   │   │       └── page.tsx      # Booking form
│   │   └── faq/
│   │       └── page.tsx
│   │
│   └── api/
│       └── auth/
│           └── callback/
│               └── route.ts      # Supabase OAuth callback
│
├── components/
│   ├── ui/                       # Headless, brand-variable aware
│   ├── ops/                      # Ops-portal specific components
│   ├── client/                   # Client-portal specific components
│   ├── prison/                   # Prison tablet UI components
│   └── shared/                   # Cross-domain components
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client (singleton)
│   │   ├── server.ts             # Server component client
│   │   └── middleware.ts         # Middleware-specific client helper
│   ├── auth/
│   │   ├── get-user.ts           # Typed getClaims() wrapper
│   │   └── roles.ts              # Role constants + permission helpers
│   ├── tenant/
│   │   ├── resolve-context.ts    # Hostname → tenant slug resolver (no DB)
│   │   └── sanitize-branding.ts  # Validates HEX values before CSS injection
│   └── notifications/
│       └── use-notifications.ts  # Client hook for realtime subscription
│
├── supabase/
│   ├── migrations/               # SQL migration files
│   │   ├── 001_core_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── ...
│   └── functions/
│       ├── custom-access-token/  # JWT claims hook
│       └── send-email/           # Transactional email
│
└── types/
    ├── database.ts               # Generated from Supabase (supabase gen types)
    └── app.ts                    # Application-level types (Role, TenantContext, etc.)
```

### Structure Rationale

- **Route groups `(ops)`, `(client)`, `(public)`:** Route groups in Next.js App Router do not add URL segments. They allow separate `layout.tsx` files per domain context — the ops portal and client portal have completely different shells, auth requirements, and branding, making co-location in a single `app/` folder without route groups impractical.
- **`middleware.ts` at root:** Middleware runs before any route handler. Domain context resolution and session refresh must happen here. Role enforcement happens at both middleware (redirect) and layout (render guard) — defence in depth.
- **`supabase/migrations/`:** Keep all SQL in versioned migration files tracked in git. Never rely on the Supabase dashboard UI for schema changes in production.
- **`lib/auth/roles.ts`:** Centralise role constants and permission logic. Prevents scattered `role === 'reco-admin'` comparisons across the codebase.
- **`lib/tenant/sanitize-branding.ts`:** HEX values from the DB must be validated as valid CSS colour values before being injected as CSS custom properties. This prevents both XSS and broken layouts from malformed data.

---

## Architectural Patterns

### Pattern 1: Subdomain → Domain Context Resolution

**What:** Middleware reads `request.headers.get('host')`, strips the root domain, and determines whether the request is for `ops`, a tenant client subdomain, or the marketing root. It injects an `x-domain-context` header and rewrites the request path to the correct route group.

**When to use:** Applied universally on every request via `middleware.ts`. This is the entry point for all domain context decisions.

**Trade-offs:** URL rewrites are transparent — the user sees `wolt.courierrecycling.com/dashboard`, not `/app/(client)/dashboard`. The cost is that all routing logic is concentrated in middleware; it must be kept lean (no DB calls).

**Example:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/middleware'

const ROOT_DOMAIN = 'courierrecycling.com'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)

  // 1. Refresh session — must happen before any conditional logic
  const { data: { user } } = await supabase.auth.getClaims()

  const hostname = request.headers.get('host') ?? ''
  const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, '').replace(ROOT_DOMAIN, '')

  let domainContext: 'public' | 'ops' | 'client'
  let tenantSlug: string | null = null

  if (!subdomain || subdomain === '') {
    domainContext = 'public'
  } else if (subdomain === 'ops') {
    domainContext = 'ops'
  } else {
    domainContext = 'client'
    tenantSlug = subdomain
  }

  // 2. Inject context headers for layouts to consume
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-domain-context', domainContext)
  if (tenantSlug) requestHeaders.set('x-tenant-slug', tenantSlug)

  // 3. Auth redirect for protected domains
  if ((domainContext === 'ops' || domainContext === 'client') && !user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next({ request: { headers: requestHeaders }, headers: response.headers })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

### Pattern 2: JWT Custom Claims for Role and Tenant

**What:** A Supabase `custom_access_token_hook` PL/pgSQL function runs at token issuance and injects `role`, `tenant_id`, and `facility_id` into the `app_metadata` claim of every JWT. This makes role and tenant context available without a DB round-trip in middleware or server components.

**When to use:** Set up once in database migrations. Every auth token issued automatically carries these claims. Read them with `getClaims()` in server components and middleware.

**Trade-offs:** Claims are cached in the JWT (no per-request DB call). If a user's role changes, they must re-authenticate to get updated claims. For this application with infrequent role changes, this is acceptable. Never use `getSession()` server-side — it does not validate the JWT signature and cannot be trusted.

**Example:**
```sql
-- supabase/migrations/002_auth_hook.sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
  user_tenant_id uuid;
  user_facility_id uuid;
begin
  select role, tenant_id, prison_facility_id
  into user_role, user_tenant_id, user_facility_id
  from public.users
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(user_tenant_id));
  claims := jsonb_set(claims, '{app_metadata,facility_id}', to_jsonb(user_facility_id));

  return jsonb_set(event, '{claims}', claims);
end;
$$;
```

```typescript
// lib/auth/get-user.ts
import { createServerClient } from '@/lib/supabase/server'

export type UserClaims = {
  id: string
  role: 'reco-admin' | 'reco' | 'client' | 'client-global' | 'transport' | 'prison'
  tenant_id: string | null
  facility_id: string | null
  can_view_financials: boolean
}

export async function getAuthUser(): Promise<UserClaims | null> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getClaims()
  if (!user) return null
  return {
    id: user.id,
    role: user.app_metadata.role,
    tenant_id: user.app_metadata.tenant_id ?? null,
    facility_id: user.app_metadata.facility_id ?? null,
    can_view_financials: user.app_metadata.can_view_financials ?? false,
  }
}
```

---

### Pattern 3: Layout-Level Role Guards

**What:** Each route group's `layout.tsx` is a server component that calls `getAuthUser()`, checks the role against the allowed set for that domain context, and redirects to `/login` or `/unauthorized` if the check fails. Child pages do not repeat auth checks.

**When to use:** Applied at the route group layout level. This is the render-time enforcement layer. Middleware handles redirect-before-render; layout guards are the authoritative render-level check. Both exist intentionally — middleware is the first gate, layout is the second.

**Trade-offs:** Two-layer protection is deliberate duplication. The redundancy is the point: middleware alone is insufficient for complex role logic (edge runtime has limited capabilities); layout alone is insufficient because page content begins rendering before a redirect fires.

**Example:**
```typescript
// app/(ops)/layout.tsx
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth/get-user'

const OPS_ALLOWED_ROLES = ['reco-admin', 'reco', 'transport', 'prison'] as const

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) redirect('/login')
  if (!OPS_ALLOWED_ROLES.includes(user.role as typeof OPS_ALLOWED_ROLES[number])) {
    redirect('/unauthorized')
  }

  return <>{children}</>
}
```

```typescript
// app/(ops)/finance/layout.tsx — nested role guard for finance section
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth/get-user'

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  const canViewFinance =
    user?.role === 'reco-admin' ||
    (user?.role === 'reco' && user.can_view_financials === true)

  if (!canViewFinance) redirect('/unauthorized')

  return <>{children}</>
}
```

---

### Pattern 4: RLS Policy Structure

**What:** Every table has a `tenant_id` column (nullable for global tables like `prison_facilities`). RLS policies use `app_metadata` claims from the JWT via helper functions to enforce isolation. Global tables (prisons, materials, transport providers) use role-based policies instead of tenant isolation.

**When to use:** Defined in migration files. Applied to every tenant-scoped table. RLS is the data-layer enforcement — it protects against bugs in application code and compromised service-role key misuse.

**Trade-offs:** RLS adds per-query overhead. Mitigate with: (1) SQL helper functions that wrap `auth.jwt()` calls so the result is cached per statement, not re-evaluated per row; (2) indexes on `tenant_id` on every tenant-scoped table; (3) explicit filters in all application queries. RLS should be the safety net, not the primary filter.

**Example:**
```sql
-- Helper functions — cache JWT claims per statement, not per row
create or replace function auth_tenant_id()
returns uuid language sql stable as $$
  select (auth.jwt()->'app_metadata'->>'tenant_id')::uuid
$$;

create or replace function auth_role()
returns text language sql stable as $$
  select auth.jwt()->'app_metadata'->>'role'
$$;

-- Tenant-scoped table policies
alter table pickup_requests enable row level security;

create policy "reco-admin full access"
on pickup_requests for all to authenticated
using (auth_role() = 'reco-admin');

create policy "reco read all"
on pickup_requests for select to authenticated
using (auth_role() = 'reco');

create policy "client tenant isolation"
on pickup_requests for select to authenticated
using (
  auth_role() in ('client', 'client-global')
  and tenant_id = auth_tenant_id()
);

-- Critical: index on tenant_id for every tenant-scoped table
create index pickup_requests_tenant_id_idx on pickup_requests(tenant_id);
create index pickup_requests_tenant_status_idx on pickup_requests(tenant_id, status);
```

---

### Pattern 5: Tenant Branding Injection

**What:** The `(client)` layout server component reads the tenant slug from the `x-tenant-slug` header (set by middleware), queries the `tenant_branding` table, validates the HEX colour values, and sets CSS custom properties on the page. Components reference `var(--brand-primary)` exclusively — no hardcoded colours.

**When to use:** Applied once in `app/(client)/layout.tsx`. All child components automatically pick up tenant branding.

**Trade-offs:** Branding is server-rendered (no flash of default brand). The tenant lookup in layout adds one DB query per page navigation for client-portal users — use `unstable_cache` with a tag to amortize this. Tenant branding changes are infrequent and can be revalidated on demand via `revalidateTag`.

**Security note:** HEX values from the database must be validated against a strict pattern (`/^#[0-9A-Fa-f]{6}$/`) before use. While the values are admin-controlled (not user-controlled), validation prevents both XSS edge cases and broken layouts from malformed data. Inject via `style` prop with a typed React `CSSProperties` object, not as a raw HTML string, to avoid innerHTML-based injection vectors.

**Example:**
```typescript
// lib/tenant/sanitize-branding.ts
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function safeHex(value: string | null | undefined, fallback: string): string {
  if (value && HEX_PATTERN.test(value)) return value
  return fallback
}

// app/(client)/layout.tsx
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { safeHex } from '@/lib/tenant/sanitize-branding'

const getTenantBranding = unstable_cache(
  async (slug: string) => {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('tenants')
      .select('id, name, tenant_branding(*)')
      .eq('slug', slug)
      .single()
    return data
  },
  ['tenant-branding'],
  { tags: ['tenant-branding'], revalidate: 3600 }
)

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const headersList = headers()
  const slug = headersList.get('x-tenant-slug') ?? ''
  const tenant = await getTenantBranding(slug)
  const b = tenant?.tenant_branding?.[0]

  // Inject via React style prop on a wrapper div — not via innerHTML
  const brandingVars = {
    '--brand-primary': safeHex(b?.primary_colour, '#ED1C24'),
    '--brand-secondary': safeHex(b?.secondary_colour, '#9FA4A6'),
    '--brand-bg': safeHex(b?.background_colour, '#FAF9F4'),
    '--brand-text': safeHex(b?.text_colour, '#000000'),
    '--brand-accent': safeHex(b?.accent_colour, '#ED1C24'),
  } as React.CSSProperties

  return (
    <div style={brandingVars}>
      {children}
    </div>
  )
}
```

---

### Pattern 6: Realtime Notifications

**What:** A client component subscribes to `postgres_changes` INSERT events on the `notifications` table filtered by `user_id`. Initial notification state is server-rendered; the client component hydrates and opens a WebSocket subscription on mount.

**When to use:** Added to the root layout of `(ops)` and `(client)` portals. Not used on the marketing site or prison module — prison tablet uses a 7-day session on a shared device, where persistent WebSocket accumulation is a concern. Use polling for prison.

**Trade-offs:** Each connected user opens one WebSocket to Supabase Realtime. At 50 concurrent users this is well within Supabase Pro plan limits. Subscriptions must be cleaned up on unmount to prevent connection leaks.

**Example:**
```typescript
// lib/notifications/use-notifications.ts
'use client'
import { useEffect, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  user_id: string
  type: string
  body: string
  link: string | null
  dismissed: boolean
}

export function useNotificationStream(
  userId: string,
  onNew: (n: Notification) => void
) {
  const supabase = createBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    channelRef.current = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onNew(payload.new as Notification)
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [userId])
}
```

---

## Data Flow

### Pickup Booking Request Flow

```
Client user submits form (client portal)
    ↓
Server Action: validate input, write pickup_request + pickup_request_lines
    ↓ (RLS policy checks tenant_id matches JWT claim)
PostgreSQL: insert into pickup_requests, pickup_request_lines
    ↓
DB trigger → insert into notifications (for reco-admin user_id)
    ↓ (Realtime broadcast)
reco-admin NotificationStream receives INSERT event → bell icon updates
    ↓
Email Edge Function: send confirmation to client user via Resend
```

### Subdomain Request Resolution Flow

```
Request: wolt.courierrecycling.com/dashboard
    ↓
Vercel Edge: wildcard CNAME matches → routes to Next.js deployment
    ↓
middleware.ts:
  hostname = 'wolt.courierrecycling.com'
  subdomain = 'wolt' → domainContext = 'client', tenantSlug = 'wolt'
  getClaims() → user present, role = 'client', tenant_id = wolt-uuid
  sets headers: x-domain-context=client, x-tenant-slug=wolt
    ↓
app/(client)/layout.tsx:
  reads x-tenant-slug → fetches tenant branding (unstable_cache, 1h TTL)
  validates HEX values → injects CSS vars via style prop
  checks user role is client or client-global
    ↓
app/(client)/dashboard/page.tsx (Server Component):
  getAuthUser() → role=client, tenant_id=wolt-uuid
  query: pickup_requests where tenant_id = wolt-uuid AND location_id = user.location_id
  RLS policy enforces tenant isolation redundantly
    ↓
Page renders with Wolt branding, data scoped to Wolt + user location
```

### Prison Intake Submission Flow

```
Prison staff submits intake form (ops portal, /prison/intake)
    ↓
Server Action: validate form fields
  facility_id: auto-resolved from JWT claim (not form input — prevents wrong-facility submissions)
  tenant_id: taken from client dropdown selection (prison users are cross-tenant)
    ↓
PostgreSQL:
  insert intake_record + intake_record_lines
  trigger: compare actual_quantity vs pickup_request_line.quantity per product
  if any line discrepancy > threshold → set discrepancy_flagged = true on intake_record
  if batch matches batch_flags → set quarantine_flagged = true
  insert notification rows for reco-admin
    ↓
Realtime + Email Edge Function: alert reco-admin of intake + flags
    ↓
audit_log: record user_id, action, entity, old/new values
```

### Key Data Flow Principles

1. **Tenant isolation:** Every query from server components includes an explicit `tenant_id` filter. RLS policies enforce the same filter as a secondary guarantee. JWT claims carry `tenant_id` — no DB lookup needed per request.
2. **Role escalation prevention:** Users cannot modify their own `app_metadata` JWT claims. The custom claims hook reads from `public.users` which only reco-admin can modify via RLS.
3. **Financial data gating:** `can_view_financials` is a separate JWT claim checked in the finance layout guard. Both `role === 'reco'` and the boolean must be true.
4. **Prison cross-tenant access:** Prison staff have `tenant_id = null` in their JWT. Their `facility_id` is in the JWT. Prison RLS policies match on `facility_id` rather than `tenant_id`. Tenant association happens at form submission via the client dropdown.
5. **No DB calls in middleware:** Tenant slug and role come from hostname parsing and JWT claims respectively. No Supabase queries in middleware.

---

## Suggested Build Order

This order minimises blocking dependencies. Each layer depends on the one above it.

| Order | Component | Depends On | Why First |
|-------|-----------|------------|-----------|
| 1 | Database schema + RLS migrations | Nothing | Everything reads from and writes to the DB |
| 2 | Supabase Auth + custom claims hook | Schema (users table) | JWT claims power all downstream auth |
| 3 | middleware.ts (domain context + session refresh) | Auth | Required before any protected route works |
| 4 | Route group shells + layout guards | Middleware, Auth | Login walls must exist before building features |
| 5 | Tenant branding injection | Schema (tenant_branding) | Client portal is unusable without it |
| 6 | Product registry + material library | Schema | Pickup form and prison forms depend on product list |
| 7 | Pickup booking (client portal) | Products, Auth, Tenant | First user-facing workflow |
| 8 | Transport management (ops portal) | Pickups | Transport bookings link to pickup requests |
| 9 | Prison intake + processing (ops/prison) | Transport, Products | Intake references transport bookings + product data |
| 10 | Financial records | Intake, Transport, Products | Calculated from all upstream data |
| 11 | Dashboards | All above | Aggregate views require data to exist |
| 12 | Notifications (realtime) | All workflow modules | Triggered by events in each module |
| 13 | Data import tooling | Full schema | Imports must map to the complete schema |
| 14 | Audit log viewer | All write operations | Audit trail accumulates during all above steps |
| 15 | Marketing site | Public stats API | Reads aggregated data, no auth dependency |

**Build order rationale:**

- Schema and RLS must be written first and tracked in migration files. Writing them incrementally leads to policy gaps that are hard to audit. Write the full schema + policies for Phase 1 tables before building any server component.
- The custom claims JWT hook must be live before any layout guard can work — without it, `user.app_metadata.role` is undefined and every role check fails open.
- Route group shells without content allow testing the full auth flow (login → session → redirect → layout guard) before any feature UI exists.
- Prison processing depends on transport bookings (to link intake to expected deliveries) and on the product registry (for dynamic product lists per client). Building prison before those is possible but produces degraded forms that need rework.
- Dashboards are last because they are read-only aggregates of everything else. Building dashboards with placeholder data wastes effort — they need real data to be testable.

---

## Component Boundaries

| Boundary | Communication Pattern | Notes |
|----------|-----------------------|-------|
| Middleware ↔ Layout | HTTP headers (`x-domain-context`, `x-tenant-slug`) | The only mechanism to pass data from middleware to server components in Next.js App Router |
| Server Component ↔ Supabase | Supabase server client via `@supabase/ssr` | Cookie-based session; never use service role key in server components |
| Server Action ↔ Supabase | Same server client as server components | Server Actions run server-side; use same auth context as page renders |
| Client Component ↔ Supabase Realtime | Browser Supabase client singleton | WebSocket managed by Supabase SDK; one connection per client |
| Layout (parent) ↔ Page (child) | React context for tenant data | Tenant context passed via React context from layout — not re-fetched per page |
| Next.js ↔ Edge Functions | HTTPS fetch from Server Actions / Route Handlers | Email sending, webhook processing — kept out of the Next.js request path |
| Prison form ↔ facility context | JWT `facility_id` claim (not form input) | Prevents staff from accidentally submitting against the wrong facility |
| Client portal ↔ ops portal | No direct communication | Separate route groups; all shared state lives in the DB |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1 client, 50 users) | Standard Supabase Pro + Vercel Pro. No changes needed. |
| 5-10 clients, 500 users | Add explicit composite indexes on high-volume tables. Audit RLS policies with `EXPLAIN ANALYZE`. Consider `unstable_cache` for all repeated tenant lookups. |
| 50+ clients, 5000+ users | Evaluate Supabase dedicated compute. Read replica for dashboard queries. Redis (Upstash) for session-adjacent cache to remove dependency on Supabase for branding lookups. |

### Scaling Priorities

1. **First bottleneck: RLS policy evaluation on large tables.** The `pickup_requests` and `intake_records` tables will grow fastest. Index `(tenant_id, status)` composite for dashboard filter queries. Verify query plans with `EXPLAIN ANALYZE` before launch.
2. **Second bottleneck: Realtime WebSocket connections.** At 50 concurrent users this is fine. If concurrent users grow significantly, move non-critical in-app notifications to polling (per-page fetch every 30s) rather than persistent WebSockets.

---

## Anti-Patterns

### Anti-Pattern 1: DB calls in middleware

**What people do:** Query the `tenants` table in middleware to resolve `tenant_id` from `slug`, or check user roles in middleware via a Supabase DB call.

**Why it's wrong:** Middleware runs on every request at the edge. A DB round-trip adds 50-200ms latency to every page load and creates a failure mode where middleware is blocked by DB availability.

**Do this instead:** Resolve tenant slug from the hostname (string manipulation, no DB). Read role and tenant_id from JWT claims injected by the custom access token hook. DB calls belong in server components, server actions, and route handlers — not middleware.

---

### Anti-Pattern 2: Calling `getSession()` server-side

**What people do:** Use `supabase.auth.getSession()` in server components or middleware to get the current user and their claims.

**Why it's wrong:** `getSession()` reads from the cookie without cryptographic validation. In server-side code, this means a forged cookie could pass as valid. Supabase's documentation explicitly warns: "Never trust `supabase.auth.getSession()` inside server code."

**Do this instead:** Always use `supabase.auth.getClaims()` in server components and middleware. It validates the JWT signature against Supabase's public keys on every call.

---

### Anti-Pattern 3: Relying on RLS alone without application-layer filtering

**What people do:** Write no `where tenant_id = ...` filter in application queries, trusting RLS to filter the rows.

**Why it's wrong:** Without explicit filters in queries, PostgreSQL cannot use the `tenant_id` index efficiently — it may default to a sequential scan with the RLS filter applied post-scan on large tables. Dashboards become slow.

**Do this instead:** Always add explicit `where` filters in application code that match the RLS conditions. RLS becomes redundant but verifiable defence-in-depth. Queries are also self-documenting about their access scope.

---

### Anti-Pattern 4: Per-page tenant lookup in client portal

**What people do:** Fetch the tenant record (and branding) inside each page component to get the tenant context.

**Why it's wrong:** Duplicates a DB round-trip on every page render. Branding updates propagate inconsistently depending on which pages cached vs. refetched.

**Do this instead:** Fetch tenant context once in the route group's `layout.tsx` using `unstable_cache` with a revalidation tag. Pages receive tenant context via React context from the layout. Branding changes trigger `revalidateTag('tenant-branding')` from a server action.

---

### Anti-Pattern 5: Treating global entities as tenant-scoped

**What people do:** Add `tenant_id` to `prison_facilities`, `transport_providers`, and `material_library` because "everything should be tenant-scoped."

**Why it's wrong:** Prison facilities, transport providers, and materials are shared across tenants by design. A single prison receives deliveries from multiple clients. Scoping them per-tenant duplicates data and makes cross-tenant reporting unnecessarily complex.

**Do this instead:** Keep global tables without `tenant_id`. Use join tables (`transport_provider_clients`) to express the many-to-many relationship between global entities and tenants. RLS on global tables uses role-based policies rather than tenant isolation.

---

### Anti-Pattern 6: Injecting tenant CSS values as raw HTML strings

**What people do:** Build a CSS string from DB-sourced colour values and inject it via `dangerouslySetInnerHTML` or a `<style>` tag with unvalidated content.

**Why it's wrong:** Even though HEX values are admin-controlled rather than end-user-controlled, injecting unvalidated strings as HTML is a bad habit that creates risk if the input path ever changes. It also breaks layouts silently if a value is malformed.

**Do this instead:** Validate all values against a strict HEX regex before use. Inject via the React `style` prop using a `CSSProperties` object with CSS custom property keys. React escapes property values automatically and the result is never treated as raw HTML.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/ssr` cookie-based client | Do not use service role key in browser code or server components |
| Supabase Realtime | Browser client WebSocket subscription | Notifications only; not used for data synchronisation |
| Supabase Storage | Server-side signed URLs for private files | Delivery photos and packing lists are not public |
| Resend (email) | Supabase Edge Function called from Server Action | Keeps email sending out of the Next.js request path |
| Vercel (hosting) | Native Next.js deployment, wildcard domain config | Wildcard subdomain requires Vercel Pro plan |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| (ops) ↔ (client) | No direct — both read same DB | No cross-portal API calls needed |
| Prison form ↔ pickup data | Supabase query by FK | Prison form pre-fills from pickup request when linked |
| Notification trigger ↔ email | DB trigger → Edge Function | Notification logic stays in DB, not scattered across server actions |
| Financial calculations ↔ product pricing | Calculated at query time | `estimated_invoice_amount` is derived, not stored, to stay consistent with current pricing data |
| Import tooling ↔ main schema | Writes via same RLS-protected schema with `source: import` flag | Import runs under reco-admin auth, not bypassing RLS |

---

## Sources

- [Next.js Multi-Tenant Guide (official, April 2025)](https://nextjs.org/docs/app/guides/multi-tenant) — HIGH confidence
- [Vercel Multi-Tenant Next.js Guide](https://vercel.com/guides/nextjs-multi-tenant-application) — HIGH confidence
- [Supabase Row Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — HIGH confidence
- [Supabase Custom Claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — HIGH confidence
- [Supabase SSR Client for Next.js App Router](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — HIGH confidence
- [Makerkit: Real-time Notifications with Supabase and Next.js](https://makerkit.dev/blog/tutorials/real-time-notifications-supabase-nextjs) — MEDIUM confidence (production pattern, community source)
- [Next.js RBAC Middleware Pattern 2025](https://www.jigz.dev/blogs/how-to-use-middleware-for-role-based-access-control-in-next-js-15-app-router) — MEDIUM confidence (community source, verified against official Next.js auth docs)

---
*Architecture research for: reco Platform — multi-tenant SaaS, subdomain routing, Supabase RLS*
*Researched: 2026-03-19*
