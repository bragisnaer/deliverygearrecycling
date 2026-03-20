# Phase 2: Auth, Roles, and Tenant Branding - Research

**Researched:** 2026-03-20
**Domain:** Auth.js v5 (Credentials + Resend), CSS custom property theming, WCAG contrast, user management
**Confidence:** HIGH (all critical claims verified against official docs or existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No Microsoft Entra ID / Azure AD SSO — user explicitly confirmed magic link + email/password for all roles; simplifies auth setup significantly
- Auth method: email/password + magic link for ALL six roles; Entra ID dropped entirely
- Prison login: `/prison/login?facility=X` sends magic link to facility contact email; 7-day session maxAge in Auth.js
- Post-login redirect is role-based: `reco-admin`/`reco` → `/dashboard`, `client`/`client-global` → `/overview`, `transport` → `/dashboard`, `prison` → `/prison`
- Wrong-portal access: redirect to correct portal (client user visiting ops → redirected to `[tenant].courierrecycling.com/overview`)
- Guard granularity: route-level in proxy.ts + server component guards via `lib/auth-guard.ts`; no client-side role checks
- `transport` role accesses `ops.courierrecycling.com` with transport-scoped navigation; no dedicated subdomain
- User management at `/settings/users` — new tab on existing settings page; invite via modal dialog
- User table columns: Email, Role, Tenant, Status (active/deactivated), Invited date, Actions
- Deactivation uses confirmation dialog; no reason required
- Tenant branding config: new "Branding" tab on settings page
- Font specification uses a predefined list (5–8 options); no custom font upload
- Live preview panel shown while editing branding
- Fallback: automatic CSS variable fallback — `:root` defines reco defaults; no branding record = full reco identity renders automatically
- WCAG AA contrast validation at config step (BRAND-05) — reject colour combinations that fail before saving
- All API secrets server-only env vars — never `NEXT_PUBLIC_*`; all DB calls via Server Actions or Route Handlers only

### Claude's Discretion
- Exact shadcn/ui component choices for the live branding preview panel
- CSS variable naming convention for tenant branding tokens
- Auth.js session callback implementation details for role injection
- Specific Google Fonts included in the predefined font list (5–8 options)
- Order and grouping of columns in the user management table

### Deferred Ideas (OUT OF SCOPE)
- Azure AD B2C or Entra ID SSO — rejected for v1
- Per-staff prison accounts — out of scope (facility-level accounts only)
- Custom font upload for tenant branding — predefined list only for v1
- `transport.courierrecycling.com` dedicated subdomain — deferred; transport uses ops subdomain for v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-09 | reco-admin can invite users by email with role assignment; can deactivate users at any time | Invite pattern: insert user row + signIn('resend', {redirect:false}) Server Action; deactivation: update users.active=false + signIn callback already blocks deactivated users |
| BRAND-01 | Each tenant has a `tenant_branding` record with logo URL, favicon URL, primary/secondary/background/text/accent colours (HEX), heading font, body font — all nullable with reco defaults | New `tenant_branding` table in `packages/db/src/schema/branding.ts`; all nullable; reco CSS vars as fallback |
| BRAND-02 | Client portals inject tenant branding as CSS custom properties on wrapper element via React `style` prop; HEX values validated against strict regex before use | React `style` prop with `--variable: value` pairs on a wrapper `<div>`; regex `/^#[0-9A-Fa-f]{6}$/` |
| BRAND-03 | All components reference CSS variables exclusively; no hardcoded colours in component code | Enforced by convention + grep check; globals.css already uses CSS vars throughout |
| BRAND-04 | Client portal with no branding configured renders identically to ops portal (full reco visual identity) | `:root` already defines reco defaults in globals.css; no wrapper injection = reco defaults apply automatically |
| BRAND-05 | Colour combinations that fail WCAG AA contrast ratios are rejected at branding configuration step | `wcag-contrast` npm package (v3.0.0); server-side validation in Server Action before DB insert |
</phase_requirements>

---

## Summary

Phase 2 builds on a solid Phase 1 foundation. The existing codebase already has: the `users` table with `active` and `role` columns, the `signIn` callback blocking deactivated users, JWT callbacks injecting role/tenant/facility claims, the Resend provider configured for magic links, and the prison login page plus its Route Handler. The CSS variable system in globals.css already defines all reco brand tokens.

What this phase must add is: (1) a Credentials provider to `auth.ts` for email/password sign-in alongside the existing Resend provider, (2) role-based post-login redirect logic in the `redirect` callback or proxy.ts, (3) the `tenant_branding` DB table and its Drizzle schema with RLS policies matching the existing pattern, (4) CSS variable injection in the client portal layout using the tenant branding record, (5) the Users and Branding tabs on the settings page including the invite modal and WCAG AA contrast validation, and (6) removing the dead MicrosoftEntraID provider from auth.ts.

The critical technical risks are: the Credentials provider `authorize` function must not throw errors (return `null` on failure instead), bcrypt/bcryptjs must be used in Node.js runtime only (not Edge), and WCAG AA contrast validation must happen server-side in the Server Action before the DB insert so invalid colour combinations are never persisted.

**Primary recommendation:** Extend the existing auth.ts with Credentials provider and role-aware redirect callback; build branding injection as a single wrapper component in the client layout; use `wcag-contrast` npm package for server-side WCAG AA validation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | beta (5.0.0-beta.30) | Auth — already installed; extend with Credentials provider | Already in use; project pinned to this version |
| @auth/drizzle-adapter | ^1.11.1 | Drizzle ORM adapter for Auth.js | Already in use; provides verificationTokens table integration |
| bcryptjs | 3.0.3 | Password hashing — pure JS, works outside Edge runtime | Edge-safe alternative to `bcrypt`; no native bindings |
| wcag-contrast | 3.0.0 | WCAG AA contrast ratio calculation | Tiny, no dependencies, pure JS, correct W3C formula |
| zod | ^3.24.1 | Validation in Server Actions and authorize callback | Already in use throughout the project |
| resend | (already installed via auth.ts) | Transactional email for invite and magic link | Already configured; Resend provider in auth.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/bcryptjs | 3.0.0 | TypeScript types for bcryptjs | Dev dependency alongside bcryptjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcryptjs | argon2 | argon2 is stronger but has native bindings — not Edge-safe; bcryptjs is sufficient for this use case |
| wcag-contrast | Hand-rolled formula | wcag-contrast is verified against W3C spec; hand-rolling the luminance formula has known precision pitfalls |

**Installation:**
```bash
pnpm add bcryptjs wcag-contrast --filter @repo/web
pnpm add -D @types/bcryptjs --filter @repo/web
```

**Version verification (confirmed 2026-03-20):**
- `bcryptjs`: 3.0.3 (npm view)
- `wcag-contrast`: 3.0.0 (npm view)
- `next-auth` beta: 5.0.0-beta.30 (npm view dist-tags.beta)

---

## Architecture Patterns

### Recommended Project Structure

New files this phase adds:

```
packages/db/src/schema/
└── branding.ts                        # tenant_branding table + RLS

apps/web/app/
├── (ops)/settings/
│   ├── users-tab.tsx                  # Users tab content (server component)
│   ├── users-table.tsx                # Client table with deactivate action
│   ├── invite-user-dialog.tsx         # Client modal — invite form
│   ├── branding-tab.tsx               # Branding tab content (server component)
│   ├── branding-form.tsx              # Client form with live preview
│   └── actions.ts                     # Extend: addInviteUser, deactivateUser, saveBranding
└── (client)/
    └── layout.tsx                     # Extend: inject CSS vars from tenant_branding

apps/web/lib/
├── auth-guard.ts                      # Extend: requirePortalAccess(role, context)
└── contrast.ts                        # WCAG AA helper wrapping wcag-contrast

apps/web/auth.ts                       # Extend: add Credentials provider, redirect callback, remove Entra ID
```

### Pattern 1: Credentials Provider in Auth.js v5

**What:** Add email/password sign-in alongside the existing Resend magic link provider. Both providers coexist in the `providers` array.

**When to use:** All six roles; email/password is the primary daily-use method; magic link is the convenience / prison method.

**Key rule:** The `authorize` function must return `null` on failure — never throw (throwing produces an opaque `CallbackRouteError`). Validate with Zod inside `authorize`, then compare password with bcryptjs.

```typescript
// Source: https://authjs.dev/getting-started/authentication/credentials
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
})

Credentials({
  credentials: {
    email: { type: 'email', label: 'Email' },
    password: { type: 'password', label: 'Password' },
  },
  async authorize(credentials) {
    const parsed = credentialsSchema.safeParse(credentials)
    if (!parsed.success) return null

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1)

    if (!user || !user.password_hash) return null

    const valid = await bcrypt.compare(parsed.data.password, user.password_hash)
    if (!valid) return null

    return { id: user.id, email: user.email, name: user.name }
  },
})
```

**Schema addition:** The `users` table needs a `password_hash` column (`text('password_hash')`). It is nullable — users who only use magic link will have `null` here.

### Pattern 2: Role-Based Post-Login Redirect

**What:** After successful authentication, redirect to the portal appropriate for the user's role. Implemented in the `redirect` callback in auth.ts.

**When to use:** Every sign-in for any role.

**How it works:** The `jwt` callback already writes `token.role` to the JWT on sign-in. The `redirect` callback receives the resolved URL and can return a different URL. The role is available on `token` via the session at the time of redirect.

**Important limitation confirmed:** The Auth.js `redirect` callback only receives `url` and `baseUrl` — it does NOT receive the session/token directly. The recommended pattern for role-based redirect in Auth.js v5 is to use the `authorized` callback in proxy.ts (middleware) to detect an authenticated-but-not-yet-redirected state, or to use the `signIn` callback to set a role-specific `callbackUrl`, or to handle the redirect via the sign-in page's own `callbackUrl` parameter.

**Practical approach for this codebase:** The sign-in page (client component) calls `signIn('credentials', { callbackUrl: getRoleDestination(role) })` — but the role is not known client-side before sign-in. The cleanest server-side approach is: after `authorize` returns a user, the `jwt` callback writes the role, and then the `redirect` callback reads from the token stored by Auth.js. However the `redirect` callback signature `{ url, baseUrl }` does not give token access directly.

**Verified working pattern:** Use a dedicated `/api/auth/redirect` route or handle it in `proxy.ts` (middleware) by inspecting the `auth()` session and sending to the correct path based on role. The middleware `authorized` callback CAN return a `NextResponse.redirect()`.

```typescript
// In proxy.ts: extend with role-based redirect
// Source: https://authjs.dev/reference/nextjs (authorized callback)
export default auth((request) => {
  const session = request.auth
  const { pathname } = request.nextUrl
  const { context } = getTenantFromHost(request.headers.get('host') ?? 'localhost')

  if (!session) {
    // ... existing unauthenticated redirect logic
    return
  }

  const role = session.user?.role
  // Wrong-portal redirect: client visiting ops
  if (context === 'ops' && (role === 'client' || role === 'client-global')) {
    const tenantId = session.user?.tenant_id
    return NextResponse.redirect(`https://${tenantId}.courierrecycling.com/overview`)
  }
  // Wrong-portal redirect: reco/admin/transport visiting client subdomain
  if (context === 'client' && (role === 'reco-admin' || role === 'reco' || role === 'transport')) {
    return NextResponse.redirect(`${request.nextUrl.origin.replace(request.nextUrl.hostname, 'ops.courierrecycling.com')}/dashboard`)
  }
})
```

**Post-login destination:** Pass `callbackUrl` per-role at the sign-in page level. The sign-in page is already a client component; it can read the subdomain context from a header or URL to select the correct `callbackUrl`.

### Pattern 3: CSS Variable Injection for Tenant Branding

**What:** In the `(client)` layout server component, fetch the tenant's branding record and inject it as a `style` prop on the root wrapper `<div>`. Components use the same CSS variable names as the `:root` defaults — no component code changes needed.

**When to use:** Every page render in the `(client)` route group.

**Key rules:**
- All values must pass HEX regex before injection: `/^#[0-9A-Fa-f]{6}$/`
- If no branding record exists, no `style` prop is added — `:root` defaults apply automatically
- Font names must be from the predefined allowlist — never inject arbitrary CSS

```typescript
// Source: CSS Custom Properties spec; React style prop pattern
// In apps/web/app/(client)/layout.tsx

import { getBrandingForTenant } from '@/lib/branding'

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export default async function ClientLayout({ children, params }) {
  const tenantId = headers().get('x-tenant-id') ?? ''
  const branding = await getBrandingForTenant(tenantId)

  const cssVars: React.CSSProperties = {}

  if (branding) {
    if (HEX_REGEX.test(branding.primary_color ?? ''))
      cssVars['--primary' as string] = branding.primary_color!
    if (HEX_REGEX.test(branding.background_color ?? ''))
      cssVars['--background' as string] = branding.background_color!
    if (HEX_REGEX.test(branding.foreground_color ?? ''))
      cssVars['--foreground' as string] = branding.foreground_color!
    // ... remaining tokens
    if (ALLOWED_FONTS.includes(branding.heading_font ?? ''))
      cssVars['--font-heading' as string] = `'${branding.heading_font}', sans-serif`
    if (ALLOWED_FONTS.includes(branding.body_font ?? ''))
      cssVars['--font-sans' as string] = `'${branding.body_font}', sans-serif`
  }

  return (
    <div style={Object.keys(cssVars).length > 0 ? cssVars : undefined}>
      {children}
    </div>
  )
}
```

**Tailwind CSS v4 note:** The `@theme inline` block in globals.css maps Tailwind colour utilities (e.g., `text-primary`) to CSS variables (e.g., `var(--primary)`). Because this mapping is already in place, overriding the CSS variable in the wrapper `div` is sufficient — Tailwind utility classes will automatically resolve to the tenant colour. No Tailwind config changes needed.

### Pattern 4: User Invitation via Auth.js Resend Provider

**What:** reco-admin creates a user record in the DB (with email, role, tenant_id), then calls `signIn('resend', { email, redirect: false, callbackUrl: '/set-password' })` server-side to trigger Auth.js to send a magic link email. The invited user clicks the link and is logged in; they can then set a password via a separate settings flow.

**When to use:** The invite Server Action in `apps/web/app/(ops)/settings/actions.ts`.

**Key rules:**
- Insert the `users` row first with `active: true` and `emailVerified: null`
- `signIn` with `redirect: false` prevents the Server Action from throwing a redirect error
- The existing `verificationTokens` table (already in schema) stores the token
- A separate "set password" page is needed for users who want email/password login after invite

```typescript
// 'use server'
export async function inviteUser(data: {
  email: string
  role: UserRole
  tenant_id: string | null
}) {
  await requireRecoAdmin()
  const parsed = inviteSchema.parse(data)

  // 1. Insert user record
  await db.insert(users).values({
    email: parsed.email,
    role: parsed.role,
    tenant_id: parsed.tenant_id,
    active: true,
  })

  // 2. Trigger magic link email via Resend provider
  await signIn('resend', {
    email: parsed.email,
    redirect: false,
    callbackUrl: '/dashboard',
  })

  revalidatePath('/settings')
  return { success: true }
}
```

### Pattern 5: WCAG AA Contrast Validation

**What:** Before saving a branding record, validate that each colour pair (foreground on background, primary on background, etc.) passes WCAG AA (4.5:1 ratio for normal text, 3:1 for large text).

**When to use:** In the `saveBranding` Server Action, before the DB insert/update.

```typescript
// Source: https://www.npmjs.com/package/wcag-contrast
import { score } from 'wcag-contrast'

// score(hex1, hex2) returns 'AAA' | 'AA' | 'AA Large' | 'DNP'
// WCAG AA requires score !== 'DNP' for all text combinations

export function validateBrandingContrast(branding: BrandingInput): string | null {
  const pairs: Array<[string, string, string]> = [
    [branding.foreground_color, branding.background_color, 'text on background'],
    [branding.primary_color, branding.background_color, 'primary on background'],
  ]

  for (const [fg, bg, label] of pairs) {
    if (!fg || !bg) continue
    const result = score(fg, bg)
    if (result === 'DNP') {
      return `Colour combination fails WCAG AA contrast: ${label} (${fg} on ${bg})`
    }
  }
  return null
}
```

### Anti-Patterns to Avoid

- **Throwing in `authorize`:** Auth.js v5 treats thrown errors in `authorize` as `CallbackRouteError`, which shows a generic error page. Always return `null` for failed authentication.
- **Edge runtime with bcryptjs:** The `authorize` callback runs in Node.js runtime (it's in auth.ts, not middleware). Do not import bcryptjs in middleware/proxy.ts which runs on the Edge. Keep bcryptjs imports only in auth.ts and Server Actions.
- **Hardcoded colours in component JSX:** All colour references must use CSS variables. Running a grep for hardcoded hex values in components should return zero results (verifiable).
- **Injecting unvalidated CSS variable values:** Never inject a font name or colour from the DB directly without validating against allowlist/regex. XSS via CSS injection is a real attack vector.
- **signIn with redirect in Server Actions:** `signIn(provider, { ... })` without `redirect: false` throws a `NEXT_REDIRECT` which aborts the Server Action before completion. Always pass `redirect: false` when calling signIn from a Server Action.
- **Client-side role checks:** Per the CONTEXT.md decision, all access control is server-enforced. Never use `session.user.role` in client components to hide/show sensitive routes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | `bcryptjs` | Salt rounds, timing-safe comparison, known attack resistance |
| WCAG contrast ratio | Manual luminance formula | `wcag-contrast` | W3C's formula has a non-obvious gamma correction step; off-by-one errors are common |
| Token generation for invites | Random string + DB table | Auth.js `verificationTokens` via `signIn('resend', ...)` | Already in the adapter; expiry, single-use enforcement handled automatically |
| Session management | Custom JWT signing | Auth.js JWT callbacks | HMAC verification, rotation, cookie scope already implemented |

**Key insight:** The Auth.js adapter already manages the entire invitation token lifecycle via `verificationTokens`. Using the Resend provider's built-in flow means no custom token table, no expiry logic, and no email template from scratch.

---

## Common Pitfalls

### Pitfall 1: MicrosoftEntraID Provider Still in auth.ts

**What goes wrong:** The existing `auth.ts` still imports and configures `MicrosoftEntraID`. It will cause a runtime error if env vars `AUTH_MICROSOFT_ENTRA_ID_ID` etc. are undefined, and will appear as a sign-in option.

**Why it happens:** Phase 1 scaffolded both providers. Entra ID was dropped as a decision in Phase 2.

**How to avoid:** Remove the MicrosoftEntraID import and provider entry from auth.ts in the first task of this phase.

**Warning signs:** Sign-in page shows "Sign in with Microsoft" button; missing env var errors at startup.

### Pitfall 2: users Table Missing password_hash Column

**What goes wrong:** Credentials provider `authorize` function cannot check a password because there is no column to store hashes. Users created via magic link have no password; this is valid (null hash). But the column must exist.

**Why it happens:** The existing schema was built before the Credentials provider decision.

**How to avoid:** Add `password_hash: text('password_hash')` (nullable) to the `users` table in a new Drizzle migration.

**Warning signs:** TypeScript error on `user.password_hash` reference; `authorize` can never return a user for password sign-in.

### Pitfall 3: redirect Callback Does Not Receive Session/Token

**What goes wrong:** Developer tries to read `session.user.role` inside the `redirect` callback to route users. The `redirect` callback signature is `{ url: string, baseUrl: string }` — there is no token/session parameter.

**Why it happens:** Confusion between `jwt`, `session`, and `redirect` callbacks.

**How to avoid:** Implement wrong-portal detection and post-login routing in `proxy.ts` (middleware) where `request.auth` provides the full session. The middleware `authorized` callback receives `auth` and can return `NextResponse.redirect()`.

**Warning signs:** TypeScript error attempting to destructure `token` or `session` from the redirect callback; roles are always `undefined` in redirect logic.

### Pitfall 4: CSS Variable Injection Breaks Tailwind CSS v4 Scoping

**What goes wrong:** Developer wraps the client layout in a `<div style={...}>` but the Tailwind utility classes resolve against `:root` rather than the nearest ancestor with overridden variables.

**Why it happens:** CSS custom property inheritance flows from the element where they are set downward in the DOM tree. The `@theme inline` mapping in globals.css maps Tailwind utilities to the CSS variables — but the variables resolve at the point of use, not at `:root`. This DOES work correctly with a wrapper div — it is a non-issue. The pitfall is putting the `style` prop on a non-ancestor (e.g., a sibling element).

**How to avoid:** Ensure the branding wrapper `<div>` is the direct parent of all child components in the layout. Do not apply the style to a `<span>` or a utility wrapper that is not in the render tree of the themed content.

**Warning signs:** Tenant colour shows in preview but not in actual portal; developer tools show CSS variable is set but computed value is still the reco default.

### Pitfall 5: Font Names Not Preloaded

**What goes wrong:** Tenant selects "Inter" from the font dropdown; the CSS variable `--font-sans` is set to `'Inter', sans-serif` but no `<link>` for Google Fonts is present. Font falls through to `sans-serif`.

**Why it happens:** CSS font-family declarations require the font to be available (either system font or loaded via `<link>`/`@font-face`).

**How to avoid:** For each font in the predefined list that is not a system font (Inter, DM Sans, Lato, Nunito are Google Fonts), add a conditional `<link>` in the client layout that loads only the selected fonts. Use `font-display: swap` to prevent FOUT.

**Warning signs:** Font visually different from preview; browser DevTools shows font-family is `sans-serif` not `Inter`.

### Pitfall 6: signIn('resend') in Server Action Without redirect:false

**What goes wrong:** Server Action throws `NEXT_REDIRECT` when `signIn` is called without `redirect: false`. This aborts the action before `revalidatePath` or the success return.

**Why it happens:** Auth.js v5 `signIn` defaults to redirecting on success, which is implemented via throwing a special error caught by Next.js.

**How to avoid:** Always call `signIn(provider, { ..., redirect: false })` inside Server Actions.

**Warning signs:** Server Action appears to never complete; Next.js App Router reports an unhandled redirect from a Server Action.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Branding Schema (Drizzle — matches existing pattern)

```typescript
// packages/db/src/schema/branding.ts
// Pattern: same RLS structure as tenants.ts and auth.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole } from './auth'

export const tenantBranding = pgTable(
  'tenant_branding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id').notNull().unique(), // FK to tenants.id
    logo_url: text('logo_url'),
    favicon_url: text('favicon_url'),
    primary_color: text('primary_color'),       // HEX e.g. '#ED1C24'
    secondary_color: text('secondary_color'),
    background_color: text('background_color'),
    foreground_color: text('foreground_color'),
    accent_color: text('accent_color'),
    heading_font: text('heading_font'),         // from predefined list
    body_font: text('body_font'),               // from predefined list
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('tenant_branding_tenant_id_idx').on(t.tenant_id),
    pgPolicy('tenant_branding_deny_all', {
      as: 'restrictive', for: 'all', using: sql`false`,
    }),
    pgPolicy('tenant_branding_reco_admin_all', {
      as: 'permissive', to: recoAdminRole, for: 'all',
      using: sql`true`, withCheck: sql`true`,
    }),
    pgPolicy('tenant_branding_reco_read', {
      as: 'permissive', to: recoRole, for: 'select', using: sql`true`,
    }),
    pgPolicy('tenant_branding_client_read', {
      as: 'permissive', to: clientRole, for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
  ]
)
```

### WCAG Contrast Helper

```typescript
// apps/web/lib/contrast.ts
import { score } from 'wcag-contrast'

type ContrastPair = { fg: string; bg: string; label: string }

export function checkBrandingContrast(pairs: ContrastPair[]): string | null {
  for (const { fg, bg, label } of pairs) {
    if (!fg || !bg) continue
    if (score(fg, bg) === 'DNP') {
      return `Colour combination fails WCAG AA contrast: ${label} (${fg} on ${bg}). Minimum ratio is 4.5:1 for normal text.`
    }
  }
  return null
}
```

### Predefined Font List (Claude's discretion — 7 options)

```typescript
// apps/web/lib/branding.ts
export const ALLOWED_FONTS = [
  'system-ui',     // system stack — fastest, always available
  'Inter',         // Google Fonts — neutral, widely used
  'DM Sans',       // Google Fonts — modern, round
  'Lato',          // Google Fonts — humanist, enterprise feel
  'Nunito',        // Google Fonts — friendly, round
  'Roboto',        // Google Fonts — ubiquitous Android default
  'Source Sans 3', // Google Fonts — readable, professional
] as const

export type AllowedFont = typeof ALLOWED_FONTS[number]
```

### Extending proxy.ts for Wrong-Portal Redirect

```typescript
// apps/web/proxy.ts — extend the proxy function
// Import auth to access session in middleware context
import { auth } from '@/auth'

// Export auth(proxy) — Auth.js wraps the middleware with session access
export default auth(function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? 'localhost'
  const { context, tenantSlug } = getTenantFromHost(host)
  const session = (request as any).auth  // Auth.js injects .auth on the request

  // Wrong-portal redirect before route resolution
  if (session?.user) {
    const role = session.user.role
    if (context === 'client' && ['reco-admin', 'reco', 'transport'].includes(role)) {
      const url = request.nextUrl.clone()
      url.hostname = `ops.${url.hostname.replace(/^[^.]+\./, '')}`
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    if (context === 'ops' && ['client', 'client-global'].includes(role)) {
      const tenantId = session.user.tenant_id
      if (tenantId) {
        const url = request.nextUrl.clone()
        url.hostname = `${tenantId}.${url.hostname.replace(/^ops\./, '')}`
        url.pathname = '/overview'
        return NextResponse.redirect(url)
      }
    }
  }

  // ... existing header-injection logic
})
```

**Note:** Wrapping `proxy` with `auth()` changes the export. `middleware.ts` currently does `export { proxy as middleware }` — it will need to export the auth-wrapped version. Verify the Auth.js v5 middleware wrapping pattern against the installed beta version before implementation.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Entra ID for reco staff | Credentials + Resend for all roles | Phase 2 decision | Simpler; no Azure app registration |
| MicrosoftEntraID provider in auth.ts | Remove and replace with Credentials | Phase 2 | auth.ts becomes simpler; dead env vars removed |
| Sign-in page shows Microsoft button | Single unified sign-in form | Phase 2 | Consistent UX; magic link + password both available |

**Deprecated/outdated in this codebase:**
- `MicrosoftEntraID` import in auth.ts: remove in first task
- `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` env vars: can be removed from all env files
- Sign-in page Microsoft button: replace with password form field

---

## Open Questions

1. **Password reset flow for Credentials users**
   - What we know: Invited users receive a magic link. They can log in via magic link indefinitely. If they set a password, they need a way to reset it.
   - What's unclear: Is a "forgot password" page in scope for Phase 2? The CONTEXT.md does not mention it.
   - Recommendation: Out of scope for Phase 2. Invited users use magic link until they explicitly set a password via an account settings page (later phase). Document this as a known gap.

2. **Wrong-portal redirect with cross-subdomain cookies on localhost**
   - What we know: Auth cookies are scoped to `.courierrecycling.com` in production. On localhost, domain is `undefined` (no cross-subdomain). Redirecting from `localhost` to `wolt.localhost` may lose the session.
   - What's unclear: Whether the proxy redirect for wrong-portal access is tested in dev.
   - Recommendation: Treat wrong-portal redirect as a production-only safety net. On localhost/dev, use the `AUTH_COOKIE_DOMAIN` env var to scope cookies to `.localhost` if cross-subdomain dev testing is needed.

3. **tenantBranding read in client layout — RLS context**
   - What we know: `withRLSContext()` wraps all tenant-scoped DB queries in a transaction that sets JWT claims. The client layout is a server component that calls `auth()` to get the session.
   - What's unclear: The branding fetch in the layout needs the session's tenant_id. This is straightforward with `withRLSContext`. But if branding is needed on the sign-in page (before auth), the query must use a different path (no JWT context yet — fetch branding by tenant_id slug directly without RLS, or use a dedicated unprotected query).
   - Recommendation: The client sign-in page can fetch branding without RLS using the raw DB client (bypassing `withRLSContext`) since branding is not sensitive. Create a dedicated `getBrandingPublic(tenantId)` function that uses the raw `db` client.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `apps/web/vitest.config.ts` (environment: node) |
| Quick run command | `pnpm --filter @repo/web test` |
| Full suite command | `pnpm --filter @repo/web test && pnpm --filter @repo/db test` |

### Success Criteria → Test Map

| Criterion | Behavior | Test Type | Automated Command | File |
|-----------|----------|-----------|-------------------|------|
| SC-1: Branding renders | Client portal with branding record renders using tenant CSS vars; no hardcoded colours in components | unit + grep | `pnpm --filter @repo/web test -- branding` + `grep -r '#[0-9A-Fa-f]\{6\}' apps/web/components` | `apps/web/lib/branding.test.ts` |
| SC-2: No branding = reco defaults | Portal with no branding record renders with reco identity (CSS var fallback) | unit | `pnpm --filter @repo/web test -- branding` | `apps/web/lib/branding.test.ts` |
| SC-3: WCAG AA rejection | Colour combination failing WCAG AA is rejected at save time with specific error message | unit | `pnpm --filter @repo/web test -- contrast` | `apps/web/lib/contrast.test.ts` |
| SC-4: Prison login bookmark stable | `/prison/login?facility=X` sends magic link; no 404; facility not found returns error | integration | Manual + `pnpm --filter @repo/web test -- prison` | `apps/web/app/api/prison/send-login/route.test.ts` |
| SC-5: User invite and deactivate | reco-admin invites user (row created, email sent), can deactivate (active=false, signIn blocked) | unit | `pnpm --filter @repo/web test -- users` | `apps/web/app/(ops)/settings/actions.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-09 | inviteUser inserts row; deactivateUser sets active=false; signIn callback blocks inactive user | unit | `pnpm --filter @repo/web test -- actions` | ❌ Wave 0 |
| BRAND-01 | tenantBranding schema has all required nullable columns | unit | `pnpm --filter @repo/db test -- schema` | Extend existing ✅ |
| BRAND-02 | CSS var injection validates HEX regex before use; invalid hex not injected | unit | `pnpm --filter @repo/web test -- branding` | ❌ Wave 0 |
| BRAND-03 | No hardcoded hex values in `apps/web/components/**` | static grep | `grep -rn '#[0-9A-Fa-f]\{6\}' apps/web/components/` exits 1 | ❌ Wave 0 (grep test) |
| BRAND-04 | getBrandingForTenant returns null when no record; layout does not inject style prop | unit | `pnpm --filter @repo/web test -- branding` | ❌ Wave 0 |
| BRAND-05 | checkBrandingContrast returns error string for DNP pairs; returns null for passing pairs | unit | `pnpm --filter @repo/web test -- contrast` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @repo/web test`
- **Per wave merge:** `pnpm --filter @repo/web test && pnpm --filter @repo/db test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/lib/contrast.test.ts` — covers BRAND-05; tests `checkBrandingContrast` with known passing and failing hex pairs
- [ ] `apps/web/lib/branding.test.ts` — covers BRAND-02, BRAND-04; tests HEX validation regex, null-branding returns no style vars
- [ ] `apps/web/app/(ops)/settings/actions.test.ts` — covers AUTH-09; tests `inviteUser` (mock DB insert) and `deactivateUser`; tests that `signIn` callback returns false for active=false user
- [ ] `apps/web/app/api/prison/send-login/route.test.ts` — covers SC-4; tests missing facility slug, inactive facility, valid facility flow (existing route.ts)
- [ ] Grep assertion in CI for BRAND-03 — add to package.json scripts: `"check:no-hardcoded-colors": "! grep -rn '#[0-9A-Fa-f]\\{6\\}' apps/web/components/"`

---

## Sources

### Primary (HIGH confidence)
- `apps/web/auth.ts` — existing Auth.js v5 config with JWT callbacks, Resend provider, deactivation signIn guard
- `packages/db/src/schema/auth.ts` — existing users table with `active`, `role`, `password_hash`-shaped columns
- `packages/db/src/schema/tenants.ts` — RLS pattern to replicate for `tenant_branding`
- `apps/web/app/globals.css` — confirmed CSS variable names in `:root` that branding injection must override
- `apps/web/proxy.ts` — existing middleware pattern to extend for wrong-portal redirect
- https://authjs.dev/getting-started/authentication/credentials — Credentials provider authorize function signature
- https://authjs.dev/guides/role-based-access-control — RBAC JWT/session callback pattern
- https://authjs.dev/reference/nextjs — authorized callback in middleware
- npm registry — verified: `next-auth@beta=5.0.0-beta.30`, `bcryptjs@3.0.3`, `wcag-contrast@3.0.0`, `@auth/drizzle-adapter@1.11.1`

### Secondary (MEDIUM confidence)
- https://www.npmjs.com/package/wcag-contrast — package description confirms `score(hex1, hex2)` API returning `'AAA'|'AA'|'AA Large'|'DNP'`
- https://github.com/vercel/next.js/issues/69002 — confirms bcrypt incompatible with Edge runtime; bcryptjs recommended
- https://github.com/nextauthjs/next-auth/discussions/11312 — community pattern for role-based redirect via proxy/middleware
- https://authjs.dev/guides/configuring-resend — Resend provider with `sendVerificationRequest` customization

### Tertiary (LOW confidence — flag for validation)
- Pattern for wrapping `proxy` with `auth()` in middleware: derived from Auth.js middleware docs but the exact export shape with the project's `export { proxy as middleware }` pattern needs verification against beta.30 behaviour during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry; existing packages confirmed in package.json
- Architecture: HIGH for patterns that mirror existing codebase (RLS, Server Actions, auth callbacks); MEDIUM for proxy.ts wrapping with auth() (needs implementation verification)
- Pitfalls: HIGH — based on documented Auth.js issues (authorize throwing, Edge bcrypt, redirect callback limits) and codebase inspection

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Auth.js beta moves fast; verify beta version before implementing)
