# Phase 2: Auth, Roles, and Tenant Branding - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the complete auth and portal experience: all six user roles can sign in using email/password or magic link, land on the correct portal, and be protected from cross-portal access. reco-admin can invite and deactivate users. Client portals render tenant-specific branding via CSS custom properties, with reco defaults as automatic fallback. No Microsoft Entra ID / SSO — simplified to single auth method set for all roles.

</domain>

<decisions>
## Implementation Decisions

### User Invitation & Management UI
- User management lives at `/settings/users` — new tab added to the existing settings page (alongside General, Facilities)
- Invite flow uses a modal dialog — less context-switching; existing `dialog` shadcn component used
- User table columns: Email, Role, Tenant, Status (active/deactivated), Invited date, Actions
- Deactivation UX: confirmation dialog ("Deactivate [email]? They will lose access immediately.") — standard destructive action pattern; no reason required

### Auth Flow UX — Login Pages
- Single shared sign-in component with portal context injected (tenant name, optional logo) — no separate pages per portal
- Auth method: email/password + magic link for ALL six roles (no Microsoft Entra ID / Azure AD SSO); prison still uses `/prison/login?facility=X` which sends a magic link to the facility email
- Dropping Entra ID rationale: removes Azure AD app registration complexity, simpler local dev, no client secrets to manage; reco staff use strong email/password + magic link convenience
- Post-login redirect is role-based: `reco-admin`/`reco` → `/dashboard`, `client`/`client-global` → `/overview`, `transport` → `/dashboard` (transport-scoped nav), `prison` → `/prison`
- Client subdomain sign-in pages show tenant branding if configured; ops sign-in always shows reco identity
- All API secrets (DB connection, auth secret, Resend key) are server-only env vars — never `NEXT_PUBLIC_*`; all DB calls go through Server Actions or Route Handlers only

### Tenant Branding Schema & Configuration
- Font specification uses a predefined list (5-8 options: system stack + popular Google Fonts like Inter, DM Sans, Lato, Nunito) — safe rendering, no custom font upload
- Branding config UI: new "Branding" tab added to settings page (joins General, Facilities, Users tabs)
- Live preview panel shown while editing — sample portal header/card updates in real time with current colour/font values
- Fallback: automatic CSS variable fallback — `:root` defines reco defaults; `tenant_branding` record is optional; no branding record = full reco identity renders automatically
- WCAG AA contrast validation at config step (BRAND-05) — reject colour combinations that fail before saving

### Role-Based Route Protection & Portal UX
- Wrong-portal access: redirect to correct portal (e.g. client user visiting `ops.` → redirected to `[tenant].courierrecycling.com/overview`)
- Unauthenticated access to protected routes: redirect to sign-in; proxy.ts handles this before route resolution
- Guard granularity: route-level protection in proxy.ts + server component guards via `lib/auth-guard.ts`; no client-side role checks — server enforces everything
- `transport` role accesses `ops.courierrecycling.com` with a transport-scoped navigation set (no dedicated subdomain)

### Claude's Discretion
- Exact shadcn/ui component choices for the live branding preview panel
- CSS variable naming convention for tenant branding tokens
- Auth.js session callback implementation details for role injection
- Specific Google Fonts included in the predefined font list (5-8 options)
- Order and grouping of columns in the user management table

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/ui/dialog.tsx` — already exists; use for invite modal
- `apps/web/components/ui/table.tsx` — already exists; use for user management table
- `apps/web/components/ui/tabs.tsx` — already exists; use for new settings tabs
- `apps/web/components/ui/form.tsx`, `input.tsx`, `label.tsx`, `button.tsx` — all available
- `apps/web/app/(ops)/settings/page.tsx` — existing settings page with Tabs structure to extend
- `apps/web/lib/auth-guard.ts` — server-side auth guard helper; extend with role checks
- `apps/web/auth.ts` — Auth.js v5 configuration; extend with Credentials + Resend providers
- `packages/types/src/auth.ts` — `UserRole` type and `USER_ROLES` array already defined
- `packages/db/src/schema/auth.ts` — `users`, `accounts`, `verificationTokens` tables with full RLS
- `packages/db/src/schema/tenants.ts` — `tenants` and `prisonFacilities` tables

### Established Patterns
- Drizzle ORM with `snake_case` columns; `pgPolicy` for RLS; restrictive deny-all base + permissive allow policies per role
- shadcn/ui components + Tailwind CSS v4; reco brand tokens as CSS custom properties
- Server Actions for mutations (`apps/web/app/(ops)/settings/actions.ts` pattern)
- Auth.js `auth()` on server; never raw JWT claims
- proxy.ts (not middleware.ts) for subdomain detection and auth enforcement

### Integration Points
- `apps/web/auth.ts` — add Credentials provider + Resend magic link; update JWT/session callbacks to inject role, tenant_id, location_id, facility_id
- `packages/db/src/schema/` — add `tenant_branding` table (new file: `branding.ts`)
- `apps/web/app/(ops)/settings/page.tsx` — add Users and Branding tabs
- `apps/web/proxy.ts` — extend with role-based portal redirect logic
- `apps/web/app/sign-in/page.tsx` — extend with portal context + tenant branding injection

</code_context>

<specifics>
## Specific Ideas

- No Microsoft Entra ID / Azure AD SSO — user explicitly confirmed they are open to magic link + email/password for all roles; simplifies auth setup significantly
- API secrets must never appear in front-end code — all DB calls via Server Actions / Route Handlers only; this is a hard requirement from the user
- Prison login: facility-pre-authenticated via `/prison/login?facility=X` sending magic link to facility email; 7-day session maxAge in Auth.js

</specifics>

<deferred>
## Deferred Ideas

- Azure AD B2C or Entra ID SSO — rejected for v1; pure magic link + email/password is sufficient
- Per-staff prison accounts — out of scope (facility-level accounts only)
- Custom font upload for tenant branding — free-text font name or upload deferred; predefined list only for v1
- `transport.courierrecycling.com` dedicated subdomain — deferred; transport uses ops subdomain for v1

</deferred>
