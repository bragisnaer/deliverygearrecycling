# Phase 1: Infrastructure Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the foundational infrastructure that every subsequent phase builds on: Next.js 16 app scaffolded and deployed to Azure Container Apps, Azure Database for PostgreSQL with RLS-enforced multi-tenant schema, Auth.js v5 handling both Microsoft Entra ID (reco staff) and email magic-link (prison/transport/client) authentication, subdomain-based tenant routing via proxy.ts, and a system settings screen for reco-admin to configure operational parameters.

</domain>

<decisions>
## Implementation Decisions

### Project Structure & Tooling
- Monorepo with `/apps/web` (Next.js 16) + `/packages/db` (Drizzle schema + migrations) + `/packages/types` (shared TypeScript types)
- Biome for linting and formatting (fast, zero-config, single tool replaces ESLint + Prettier)
- shadcn/ui + Tailwind CSS v4 as the component base; reco brand tokens applied via CSS custom properties
- `.env.local` for local dev; Azure App Configuration / container env vars for production
- No additional apps in this phase — monorepo structure is set up ready for future expansion

### Database Schema & Migrations
- Azure Database for PostgreSQL Flexible Server (EU region for compliance)
- Drizzle ORM migrations — TypeScript-native, works with Azure PostgreSQL, generates SQL migration files
- `snake_case` naming throughout DB (matches PostgreSQL conventions and Drizzle defaults)
- Restrictive RLS base: all tenant-scoped tables start with `USING (false)` as default policy; explicit allow policies added per role — fail-closed, no accidental cross-tenant data leaks
- Trigger-based audit log (`audit_log` table) capturing before/after JSON for all editable tables — set up in Phase 1 so all Phase 2+ tables inherit it automatically

### Auth Implementation — Dual-Provider Auth.js v5
- **Auth.js v5** (Next.js App Router native) as the single auth system
- **Provider 1 — Microsoft Entra ID** (Azure AD): for `reco-admin` and `reco` role users who have Microsoft 365 accounts
- **Provider 2 — Resend email magic link**: for `client`, `client-global`, `transport`, and `prison` role users who have no Microsoft accounts
- JWT callbacks inject `role`, `tenant_id`, `location_id`, `facility_id` into session token (replaces Supabase Custom Access Token Hook)
- Auth cookies scoped to the apex domain (`.courierrecycling.com` or equivalent Azure domain) so sessions are shared across all subdomains
- Server-side always uses `auth()` from Auth.js (equivalent of Supabase `getUser()` — revalidates session); never read raw JWT claims without validation
- Prison login: `/prison/login?facility=X` sends magic link to facility email; 7-day session maxAge configured in Auth.js
- `proxy.ts` (Next.js 16) handles subdomain detection and auth enforcement before routes resolve; no `middleware.ts` (Next.js 15 pattern)

### Deployment — Azure Container Apps
- Azure Container Apps as the hosting target (supports wildcard custom domains, auto-scaling, containerised Node.js)
- Dockerfile in `apps/web/` for containerised Next.js build
- Azure Container Registry for image storage
- CI/CD via GitHub Actions: build → push to ACR → deploy to Container Apps
- Domain: may start as an Azure Container Apps domain; custom wildcard DNS (`*.courierrecycling.com`) to be pointed at Container Apps ingress when ready — proxy.ts handles tenant resolution from hostname regardless of domain
- `NEXT_PUBLIC_` env vars for public Supabase-like values; secrets (DB connection string, Auth.js secret, Entra ID credentials) stored in Azure Key Vault and injected at container startup

### System Settings UI
- Single tabbed settings page accessible only to `reco-admin` role
- Tabs: **General** (exchange rate EUR/DKK with last-updated timestamp, warehouse ageing threshold, discrepancy threshold), **Facilities** (prison facility registry), **Users** (managed in Phase 2)
- Explicit save button per tab section with success/error toast — clear intent for admin configuration
- Facility registry: inline editable table — add new row, edit in place, archive (soft delete) with confirmation dialog; no bulk import in Phase 1

### Claude's Discretion
- Exact Drizzle schema file organisation within `/packages/db`
- Docker multi-stage build configuration details
- GitHub Actions workflow file structure
- Biome configuration specifics (rule set, ignore patterns)
- shadcn/ui component selection for settings forms

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — project is blank (only PRD.md exists at project root)

### Established Patterns
- None established — Phase 1 creates all foundational patterns

### Integration Points
- All future phases depend on the Drizzle schema in `/packages/db`
- Auth session (role, tenant_id, location_id, facility_id) is the contract all route guards in Phases 2–10 depend on
- proxy.ts tenant resolution sets the `x-tenant-id` header consumed by all Server Components
- Audit log trigger in Phase 1 covers all tables created in Phases 2–10

</code_context>

<specifics>
## Specific Ideas

- Azure Container Apps chosen for hosting — user is unsure of exact Azure subscription capabilities; Claude should pick the most flexible option that supports wildcard subdomains (Container Apps with custom domain binding)
- Auth.js v5 dual-provider approach: Entra ID for reco staff (Microsoft 365), email magic link (via Resend) for all external users — this was explicitly decided when user noted reco has M365 but prisons/transport/clients do not
- Domain situation is fluid — may be an Azure default domain initially, with custom domain added later; proxy.ts must handle both gracefully (fallback to "ops" context if no tenant subdomain detected)
- No Supabase at all — Azure PostgreSQL replaces Supabase for data storage; Auth.js replaces Supabase Auth; Azure Blob Storage (Phase 1 setup, used in Phase 3+) replaces Supabase Storage

</specifics>

<deferred>
## Deferred Ideas

- Bulk CSV import for facility registry — deferred to a later phase or never (admin will add facilities one by one initially)
- API-connected exchange rate feed — manual entry only for v1
- Azure AD B2C for external users — considered but rejected in favour of simpler Auth.js magic link
- Playwright E2E test setup — Phase 1 focuses on Vitest for RLS integration tests; E2E testing deferred to Phase 2+

</deferred>
