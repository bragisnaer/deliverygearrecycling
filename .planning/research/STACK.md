# Stack Research

**Domain:** Multi-tenant SaaS / circular economy ops platform
**Researched:** 2026-03-19
**Confidence:** HIGH (core stack verified via official docs and release notes)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (current stable, released Oct 2025) | Full-stack framework | App Router + `proxy.ts` subdomain middleware is the official multi-tenant pattern. Turbopack is now default. React Compiler stable. `middleware.ts` is deprecated — use `proxy.ts`. |
| React | 19.2 | UI runtime | Bundled with Next.js 16. View Transitions, `useEffectEvent`, `<Activity/>` available. React Compiler eliminates manual `useMemo`/`useCallback`. |
| TypeScript | 5.1+ (required by Next.js 16) | Type safety | Next.js 16 minimum. Non-negotiable for a platform with six roles and complex RLS logic. |
| Supabase | Hosted (Pro plan, EU Frankfurt) | Postgres + Auth + Storage + Realtime | Single managed service replaces four separate ones. RLS enforced at DB layer. Point-in-time recovery on Pro. EU region satisfies GDPR. |
| `@supabase/supabase-js` | 2.99.x (latest as of 2026-03-19) | Supabase JS client | Isomorphic client; use with `@supabase/ssr` for server/client split in App Router. |
| `@supabase/ssr` | latest | Supabase server-side auth | Replaces the deprecated `auth-helpers` packages. Provides `createBrowserClient` and `createServerClient`. Required for cookie-based sessions in App Router. |
| Vercel | Pro (EU region) | Hosting + edge network | Native Next.js deployment. Wildcard subdomain support required for `*.courierrecycling.com`. EU region for GDPR. Integrated with Next.js caching APIs. |
| Tailwind CSS | 4.x | Utility-first CSS | shadcn/ui v4 ships with Tailwind 4. CSS custom properties for tenant branding map directly to Tailwind's `var()` approach. |
| shadcn/ui | CLI v4 (March 2026) | Component library | Not a dependency — copies components into your repo. Radix UI primitives + Tailwind. Accessible by default (WCAG AA). Data table via `@tanstack/react-table`. Acquired by Vercel Jan 2025; actively maintained. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-table` | v8 | Headless data tables | All data-dense views: pickup queue, intake records, financial tracking, audit log. Use with shadcn Data Table component. Supports sorting, filtering, pagination, column visibility — all needed here. |
| `@tanstack/react-query` | v5 | Client-side data fetching and cache | Use for client components that need optimistic updates (status changes, real-time notification badges) or background refetch. Do NOT use for initial page data — use Server Components for that. |
| `react-hook-form` | v7 | Form state management | All intake forms, pickup booking, processing reports, onboarding wizard. Reduces re-renders vs. controlled inputs. |
| `zod` | v3 | Schema validation | Pair with react-hook-form via `@hookform/resolvers/zod`. Define schemas once; reuse for client validation and Server Action input validation. |
| `@hookform/resolvers` | v3 | RHF + Zod adapter | Required bridge between react-hook-form and zod. |
| `resend` | v4 | Transactional email | Recommended by Supabase for custom auth emails. Clean API. Use with `react-email` for templates. Simpler than Postmark for a small-team setup. |
| `react-email` | v5 (Nov 2025) | Email template components | Build branded email templates as React components. v5 includes Tailwind 4, dark mode, 8 new components. Pairs directly with Resend. |
| `@react-email/components` | latest | Email component primitives | Buttons, text, links, images — cross-client compatible. |
| `next-intl` | v3 | i18n | Prison module requires Danish labels. next-intl is the standard for App Router i18n. Supports Server Components natively. Scope to prison route segment only — no need for full-app i18n. |
| `recharts` | v2 | Chart rendering | Powers Tremor charts under the hood. For custom ESG dashboard charts (bar, area, pie/donut), use directly or via Tremor. Must be a Client Component (`"use client"`). |
| `tremor` | v3 (Tremor Raw, Vercel-owned) | Dashboard chart components | Pre-built KPI cards, area charts, bar charts, donut charts for ESG and ops dashboards. Acquired by Vercel Jan 2025; integrated with shadcn/ui ecosystem. Use for standard dashboard layouts; use Recharts directly for custom ESG breakdowns. |
| `@react-pdf/renderer` | v3 | PDF generation | ESG export PDFs, packing lists. Renders React components to PDF on server via a Next.js Route Handler. Note: requires dynamic import with `ssr: false` for in-browser preview; server-side generation works directly in Route Handlers. |
| `papaparse` | v5 | CSV parse/generate | CSV export for ESG data, historical data import field-mapping UI. Lightweight, no native dependencies. |
| `xlsx` | v0.18 | XLSX parse | Historical data import only (intake logs, invoice binder, product workbook). Only used in the import flow — do not expose in general bundle. |
| `date-fns` | v3 | Date utilities | Date arithmetic (48-hour edit window, 14-day warehouse alerts, effective_from/to pricing). Smaller than `moment`, tree-shakable. |
| `lucide-react` | v0.4x | Icons | Default icon set for shadcn/ui. Consistent style, tree-shakable. |
| `nuqs` | v2 | URL search params state | Persist table filter/sort/pagination state in URL. Critical for dashboards: users can bookmark a filtered view and share links. Replaces manual `useSearchParams` boilerplate. |
| `uploadthing` | v7 | File upload orchestration | Handles the signed URL flow for Supabase Storage: server creates a signed upload URL, client uploads directly to Supabase. Adds type-safe upload routes, file type validation, size limits. Alternatively, build the signed URL flow manually — uploadthing is optional but saves significant boilerplate. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Bundler (dev + build) | Default in Next.js 16. 2-5x faster builds than webpack. No configuration needed. |
| Biome | Linting + formatting | `next lint` is removed in Next.js 16. Biome replaces ESLint + Prettier. Single dependency, ~35x faster than ESLint. Configure in `biome.json`. |
| Supabase CLI | Local dev + migrations | Run `supabase start` for local Postgres with RLS. Generate TypeScript types from schema with `supabase gen types typescript`. Run `supabase db push` to apply migrations. |
| Supabase type generation | Database types | `supabase gen types typescript --linked > src/types/database.types.ts`. Regenerate after every migration. Type all Supabase queries against this. |
| Vitest | Unit and integration tests | Test RLS policies via Supabase's `pgmock` or against local Supabase instance. Test Zod schemas. Test Server Action validation logic. Faster than Jest for TS-first projects. |
| Playwright | End-to-end tests | Test subdomain routing, auth flows per role, form submissions. Critical for a six-role system — manual testing of all role combinations is error-prone. |
| Docker (via Supabase CLI) | Local Postgres | Supabase CLI starts a containerised Postgres + Auth + Storage locally. |

---

## Installation

```bash
# Create project
npx create-next-app@latest reco-platform --typescript --tailwind --app --turbopack

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# UI
npx shadcn@latest init
npm install lucide-react

# Tables and data
npm install @tanstack/react-table @tanstack/react-query

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# Email
npm install resend react-email @react-email/components

# i18n (prison module only)
npm install next-intl

# Charts
npm install recharts tremor

# PDF and export
npm install @react-pdf/renderer papaparse

# Date utilities
npm install date-fns

# URL state
npm install nuqs

# Dev tools
npm install -D vitest @vitejs/plugin-react playwright @playwright/test biome

# XLSX for historical import only (lazy-loaded)
npm install xlsx
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 App Router | Next.js 15 Pages Router | Never for new projects. App Router is the present standard. |
| Supabase Auth + RLS | Auth.js (formerly NextAuth) | Auth.js if you need many OAuth providers and don't want Supabase. For this project, Supabase Auth is the right choice because RLS depends on `auth.uid()` — splitting auth from the DB creates unnecessary complexity. |
| Resend | Postmark / SendGrid | Postmark if you need dedicated IP pools and have high-volume transactional email. Resend is simpler to set up and has first-class React Email support. SendGrid is unnecessarily complex for this volume. |
| `@react-pdf/renderer` | Puppeteer / wkhtmltopdf | Puppeteer if PDFs must pixel-perfectly replicate an HTML page. React PDF gives programmatic layout control which is better for structured documents like packing lists and ESG reports. Puppeteer adds ~200MB to deployment size. |
| `date-fns` | `dayjs` | dayjs if you need a moment-compatible API. date-fns is better for tree-shaking and TypeScript types. |
| Biome | ESLint + Prettier | ESLint if your team has existing ESLint configs that are hard to migrate. Biome is the forward choice — `next lint` is removed in Next.js 16. |
| Tremor (Vercel-owned) | Chart.js | Chart.js if you need more chart types. Tremor is better integrated with the shadcn/Tailwind ecosystem and is actively developed by the Vercel team. |
| `nuqs` | Manual `useSearchParams` | Manual if URL state is simple and you don't need type safety. nuqs eliminates significant boilerplate and adds type-safe URL params. |
| Vitest | Jest | Jest if you have existing Jest config. Vitest is faster and has native TypeScript/ESM support without config. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated. Replaced by `@supabase/ssr`. Will not receive bug fixes. | `@supabase/ssr` with `createBrowserClient` / `createServerClient` |
| `middleware.ts` (Next.js 16) | Deprecated in Next.js 16. The `middleware.ts` name still works but is being removed. Multi-tenant subdomain logic belongs in `proxy.ts`. | `proxy.ts` with exported `proxy()` function |
| Prisma / Drizzle ORM | Supabase client already provides type-safe query builder. Adding an ORM on top of Supabase doubles the abstraction and breaks RLS — ORMs bypass row-level security by connecting as the service role. | `@supabase/supabase-js` with generated TypeScript types |
| `next-auth` / Auth.js | Creates a second auth system alongside Supabase Auth. Breaks the `auth.uid()` → RLS connection that keeps tenant isolation automatic. | Supabase Auth with Custom Access Token Hook for role injection |
| Zustand / Redux for server state | Server Components + `@tanstack/react-query` handle server state better. These stores should only manage ephemeral client-only UI state. | React Server Components for initial data, React Query for client-side cache |
| `moment.js` | 230KB, not tree-shakable, timezone handling is a footgun. | `date-fns` v3 |
| Puppeteer for PDF | 200MB+ binary, cold start latency, requires special Vercel config. Overkill for structured documents. | `@react-pdf/renderer` in a Route Handler |
| `react-table` v7 | Old API, not actively maintained. Not compatible with TanStack Table v8 docs. | `@tanstack/react-table` v8 |
| Hardcoded tenant checks in UI | Tenant isolation must be enforced at DB layer (RLS), not just UI layer. UI checks are defence-in-depth only. | RLS policies that reference `auth.uid()` and `app_metadata.tenant_id` |
| `xlsx` in client bundle | 500KB+ uncompressed. Import only lazily in the data import Route Handler. | Dynamic `import('xlsx')` inside the server-side import handler only |

---

## Stack Patterns by Variant

**Multi-tenant subdomain routing (proxy.ts pattern):**
- `proxy.ts` reads `request.headers.get('host')` to extract the subdomain
- Rewrites `/` to `/apps/[tenant]` or `/apps/ops` based on hostname
- Passes tenant slug as a header or cookie for downstream Server Components to read
- Marketing site (`courierrecycling.com`) routes to `/apps/marketing`
- Wildcard DNS (`*.courierrecycling.com` CNAME → Vercel) means no per-tenant DNS work

**Supabase Auth + custom roles:**
- Store `role`, `tenant_id`, `prison_facility_id` in `auth.users.app_metadata` (not `user_metadata` — app_metadata is not editable by the user)
- Use a **Custom Access Token Hook** (Postgres function) to inject `app_metadata` claims into the JWT at issue time
- RLS policies read `(auth.jwt() -> 'app_metadata' ->> 'role')` directly — no extra DB query per request
- The `reco`, `reco-admin`, `transport`, `prison` roles have `tenant_id: null` in app_metadata; their RLS policies are written differently from client/client-global policies
- Per-user financial visibility toggle: stored in `users.can_view_financials`; read in RLS policy for financial-adjacent views

**RLS policy pattern for tenant-scoped tables:**
```sql
-- Enable RLS
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;

-- Client users see only their tenant
CREATE POLICY "tenant_isolation" ON pickup_requests
  FOR ALL
  USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('reco-admin', 'reco')
  );
```

**File uploads (Supabase Storage with signed URLs):**
- Server Action generates a signed upload URL via `supabase.storage.from(bucket).createSignedUploadUrl(path)`
- Client uploads directly to Supabase Storage using the signed URL — bypasses Next.js 1MB Server Action body limit
- Server validates the upload completed and stores the path in the DB
- Use separate storage buckets per concern: `delivery-photos`, `product-images`, `client-logos`, `proof-of-delivery`
- Set bucket RLS policies so tenants can only read their own files

**Realtime notifications (in-app):**
- Supabase Realtime channel: `supabase.channel('notifications').on('postgres_changes', ...)` on the `notifications` table, filtered by `user_id`
- Client Component wraps the notification bell; calls `router.refresh()` on new events to rerender Server Component counts
- For critical alerts (discrepancy, uninvoiced), also send email via Resend Server Action

**ESG PDF export:**
- Route Handler at `/api/export/esg/[tenantId]/[period]` (protected by auth middleware)
- Server-side: query aggregated data, render `<Document>` via `@react-pdf/renderer`, stream PDF response
- Client button triggers download via `fetch()` → `URL.createObjectURL()`

**Tenant branding (CSS custom properties):**
- `proxy.ts` / Server Component reads `tenant_branding` from Supabase and injects CSS variables into `<html style="...">`
- All shadcn/ui components reference `var(--brand-primary)` etc., never hardcoded colours
- WCAG contrast validation runs at branding save time (server-side) and rejects combinations below AA threshold

**Historical data import (XLSX/CSV):**
- Dedicated admin-only route at `ops.courierrecycling.com/admin/import`
- Upload CSV/XLSX → Route Handler parses with `papaparse` or dynamically-imported `xlsx`
- Preview mapped data in a TanStack table before committing
- Import Server Action writes records with `source: 'import'` flag, wrapped in a Postgres transaction

**i18n scope (Danish prison module only):**
- Use `next-intl` scoped to the `[locale]` segment under `/apps/ops/prison/`
- English default, Danish opt-in; do not add `[locale]` to the root layout — it adds unnecessary complexity for a feature used in one route segment
- Prison staff see Danish labels; reco-admins see English

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.x | React 19.2, TypeScript 5.1+ | Node.js 20.9+ required. Verify your Vercel deployment uses Node 20 LTS. |
| `@supabase/ssr` latest | `@supabase/supabase-js` 2.x | Always install matching versions. The `ssr` package re-exports from `supabase-js`. |
| shadcn/ui CLI v4 | Next.js 15+ App Router, Tailwind 4 | v4 dropped Tailwind 3 support. Do not mix v3 and v4 shadcn components. |
| `@react-pdf/renderer` v3 | Node.js 18+ | Works in Next.js Route Handlers. Requires `dynamic import` with `ssr: false` in Client Components. Do not use in Server Components directly — use a Route Handler. |
| Tremor v3 (Tremor Raw) | Recharts v2, Radix UI v2, Tailwind 4 | Tremor was acquired by Vercel Jan 2025. Tremor Raw is the current maintained package. Do not install the old `@tremor/react` — it is unmaintained. |
| `react-hook-form` v7 | React 19 | Fully compatible with React 19. The `useFormState` -> `useActionState` rename in React 19 does not affect RHF. |
| `next-intl` v3 | Next.js 16, App Router | Supports Server Components and `proxy.ts`. Use `getTranslations()` in Server Components, `useTranslations()` in Client Components. |
| `@tanstack/react-query` v5 | React 19 | v5 dropped the deprecated `useQuery` object syntax from v4. Use `queryKey` + `queryFn` object form. |

---

## Supabase RLS — Critical Implementation Notes

These patterns prevent the most common multi-tenant data leak vectors.

**Index every column used in RLS policies.** Unindexed `tenant_id` columns turn RLS from a security feature into a performance catastrophe. Required indexes:

```sql
CREATE INDEX idx_pickup_requests_tenant_id ON pickup_requests(tenant_id);
CREATE INDEX idx_intake_records_tenant_id ON intake_records(tenant_id);
CREATE INDEX idx_financial_records_tenant_id ON financial_records(tenant_id);
-- ... on every tenant-scoped table
```

**Never use the service role key in client-side code.** The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It belongs only in Server Actions and Route Handlers where you explicitly need to bypass RLS (e.g., admin operations). Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for all client-side and SSR code.

**Test RLS policies in CI.** Write pgTAP or Vitest tests against the local Supabase instance that impersonate different JWT payloads and verify:
- A `client` user cannot query another tenant's data
- A `prison` user cannot query financial records
- A `transport` user cannot see unassigned pickups

**Global tables (prison_facilities, material_library, transport_providers) still need RLS.** Read: `auth.role() = 'authenticated'`. Write: role-restricted. Never `FORCE ROW LEVEL SECURITY` without a read policy — it locks everyone out.

---

## Sources

- Next.js 16 release blog — https://nextjs.org/blog/next-16 (HIGH confidence, official)
- Next.js multi-tenant guide — https://nextjs.org/docs/app/guides/multi-tenant (HIGH confidence, official, version 16.2.0)
- Supabase `@supabase/ssr` docs — https://supabase.com/docs/guides/auth/server-side/creating-a-client (HIGH confidence, official)
- Supabase Custom Access Token Hook — https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook (HIGH confidence, official)
- Supabase Custom Claims RBAC — https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac (HIGH confidence, official)
- Supabase RLS docs — https://supabase.com/docs/guides/database/postgres/row-level-security (HIGH confidence, official)
- Supabase RLS best practices — https://makerkit.dev/blog/tutorials/supabase-rls-best-practices (MEDIUM confidence, community)
- `@supabase/supabase-js` npm — version 2.99.2 as of 2026-03-19 (HIGH confidence, npm registry)
- shadcn/ui changelog — https://ui.shadcn.com/docs/changelog (HIGH confidence, official; CLI v4 March 2026)
- React Email 5.0 — https://resend.com/blog/react-email-5 (HIGH confidence, official Resend blog)
- TanStack Query v5 — https://tanstack.com/query/latest (HIGH confidence, official)
- next-intl App Router — https://next-intl.dev/docs/getting-started/app-router (HIGH confidence, official)
- Vercel Platforms Starter Kit — https://vercel.com/templates/next.js/platforms-starter-kit (MEDIUM confidence, reference implementation)

---

*Stack research for: reco Platform — multi-tenant SaaS, circular gear operations*
*Researched: 2026-03-19*
