# Local User Testing — Quick Start

Get the platform running locally in ~10 minutes for user testing.

---

## Prerequisites

- Node.js 20+, pnpm 10+
- PostgreSQL 15+ (local) **or** a free Supabase project
- `psql` CLI accessible in your terminal

---

## Step 1 — Install dependencies

```bash
pnpm install
```

---

## Step 2 — Configure environment

```bash
cp apps/web/.env.local apps/web/.env.local.bak  # if it already exists
```

Edit `apps/web/.env.local` — two things need your attention:

| Variable | Action |
|----------|--------|
| `DATABASE_URL` | Point to your Postgres instance (see below) |
| `AUTH_SECRET` | Run `npx auth secret` and paste the output |

Everything else can stay as-is for local testing (emails log to console, no real delivery).

### Local Postgres

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/deliverygearrecycling
```

Create the database first:
```bash
psql -U postgres -c "CREATE DATABASE deliverygearrecycling;"
```

### Supabase (free tier)

Use the **Transaction pooler** connection string from your project's Settings → Database page.
It looks like: `postgresql://postgres.xxxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

> **Supabase note:** The connection must use a role with `BYPASSRLS` (the default `postgres` role has this). Do **not** use the anon key URL.

---

## Step 3 — Build the database + seed demo data

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/deliverygearrecycling
bash scripts/setup-local-db.sh
```

This runs migrations, applies RLS/trigger supplements, seeds Wolt products, and loads demo test data.

Expected output ends with:
```
Demo accounts (password: Demo1234!):
  reco-admin  →  admin@reco.demo
  ...
```

---

## Step 4 — Generate AUTH_SECRET

```bash
npx auth secret
```

Paste the output into `apps/web/.env.local` as `AUTH_SECRET`.

---

## Step 5 — Start the dev server

```bash
pnpm dev
```

Visit **http://localhost:3000**

---

## Demo Accounts

All accounts use password **`Demo1234!`**

| Role | Email | What they can see |
|------|-------|-------------------|
| `reco-admin` | `admin@reco.demo` | Everything — full platform admin |
| `reco` | `ops@reco.demo` | Operations dashboard, read-only financials |
| `client` | `client@wolt.demo` | Wolt pickup history (Copenhagen) |
| `client` | `finland@wolt.demo` | Wolt pickup history (Helsinki) |
| `prison` | `prison@vejle.demo` | Vejle Fengsel — intake + processing |
| `transport` | `transport@direct.demo` | DirectFreight — assigned transport bookings |

Sign in at **http://localhost:3000/sign-in** with email + password.

---

## Pre-loaded Demo Data

The seed creates a realistic 3-month snapshot of Wolt gear recycling activity:

| What | Details |
|------|---------|
| **Pickup queue** | 11 pickups across all lifecycle states (submitted → cancelled) |
| **Transport bookings** | 7 bookings (direct + consolidation) |
| **Intake records** | 4 completed intakes at Vejle Fengsel + Horsens |
| **Discrepancy** | 1 intake with quarantine flagged + admin override |
| **Processing reports** | Wash + pack reports for 2 intakes |
| **Dispatches** | 1 delivered dispatch + 1 ready-to-ship |
| **Financial records** | Mix of paid / invoiced / not-invoiced |
| **Notifications** | 4 unread alerts for admin account |

---

## Known Gaps (Accepted for Beta)

| Gap | Notes |
|-----|-------|
| Magic link emails | URL is logged to the dev server console instead of delivered |
| Photo uploads | Requires `SUPABASE_URL` + `SUPABASE_ANON_KEY` — skip during testing |
| Microsoft Entra ID | Not testable without Azure app registration |
| ESG CO2 column | Shows "Formula pending" — intentional stub |
| Prison subdomain routing | With `DOMAIN_MODE=azure-default` all traffic resolves to ops context. To test prison/client views, sign in as the prison or client user through the same URL. |

---

## Troubleshooting

**`ERROR: relation "users" already exists`**
The database was already migrated. Either drop and recreate the database, or run just the seed steps:
```bash
pnpm --filter @repo/db seed:wolt
pnpm --filter @repo/db seed:demo
```

**Sign-in fails with "Invalid credentials"**
Make sure `AUTH_SECRET` is set in `apps/web/.env.local`.

**`Wolt products not found` during demo seed**
The demo seed must run after the Wolt seed. Run `bash scripts/setup-local-db.sh` from scratch, or run `pnpm --filter @repo/db seed:wolt` first.

**Blank page / 500 error on load**
Check that `DATABASE_URL` is reachable: `psql $DATABASE_URL -c "SELECT 1"`

**Financial records not updating (invoice status stays `not_invoiced`)**
The demo seed UPDATEs financial records that are auto-created by a DB trigger on intake insert. If the trigger didn't fire (e.g., if FORCE RLS blocked the seed connection), run the demo seed again after confirming your `DATABASE_URL` uses a superuser or service_role connection.
