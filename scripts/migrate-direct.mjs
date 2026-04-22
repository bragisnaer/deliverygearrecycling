#!/usr/bin/env node
// Full database setup: applies all SQL files in dependency order,
// bypassing drizzle-kit so errors are visible and "already exists" is handled gracefully.
// Usage: node scripts/migrate-direct.mjs

import postgres from '../packages/db/node_modules/postgres/src/index.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, '../packages/db/migrations')

// Auto-load .env.local if DATABASE_URL is not already set
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '../apps/web/.env.local')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim()
      }
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 })

// All files in the correct dependency order.
// Drizzle-tracked files (0000-0004) must come before supplements.
// 0007 (ESG indexes) must come last — it references tables created by supplements.
const ALL_FILES = [
  // Drizzle journal migrations
  '0000_naive_mentallo.sql',
  '0001_curved_zaran.sql',
  '0002_natural_exiles.sql',
  '0003_worthless_quicksilver.sql',
  '0004_tense_chronomancer.sql',
  // Manual supplement migrations (RLS, triggers, GRANTs — use psql-style full execution)
  '0001_rls_and_triggers.sql',
  '0003_phase4_pickup_transport.sql',
  '0004_intake_trigger_rls.sql',
  '0005_phase6_processing_dispatch_audit.sql',
  '0006_financial_records.sql',
  '0008_notifications_manuals.sql',
  '0009_historical_import.sql',
  // ESG indexes last — depends on tables created by supplements above
  '0007_esg_dashboard_indexes.sql',
]

const SKIP_CODES = new Set([
  '42710', // duplicate_object (role/type/constraint already exists)
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '23505', // unique_violation (for seed inserts)
  '42704', // undefined_object on DROP IF EXISTS
])

async function applyFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename)
  if (!fs.existsSync(filePath)) {
    console.log(`  [SKIP] ${filename} — file not found`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')

  // Split on drizzle's statement-breakpoint marker OR just semicolons for supplement files
  const isDrizzle = !filename.includes('rls') &&
    !filename.includes('phase') &&
    !filename.includes('intake_trigger') &&
    !filename.includes('financial') &&
    !filename.includes('notifications') &&
    !filename.includes('historical') &&
    !filename.includes('esg')

  let statements
  if (isDrizzle) {
    statements = content
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
  } else {
    // Supplement files: run as one block (they use $$ functions and triggers)
    statements = [content]
  }

  console.log(`\n  Applying ${filename}...`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt) continue
    try {
      await sql.unsafe(stmt)
    } catch (err) {
      const code = err.code || ''
      const msg = (err.message || '').split('\n')[0]

      if (SKIP_CODES.has(code) || msg.includes('already exists')) {
        console.log(`    [SKIP] ${msg}`)
      } else {
        console.error(`\n  FAILED in ${filename} (statement ${i + 1}/${statements.length}):`)
        console.error(`  Error [${code}]: ${msg}`)
        if (statements.length > 1) {
          console.error(`  SQL: ${stmt.slice(0, 300)}`)
        }
        throw err
      }
    }
  }
  console.log(`  ✓ ${filename}`)
}

async function main() {
  console.log('==> Running full database migration...')
  console.log(`    ${DATABASE_URL.replace(/:([^@]+)@/, ':***@')}\n`)

  for (const file of ALL_FILES) {
    await applyFile(file)
  }

  console.log('\n✓ All migrations applied.\n')
  await sql.end()
}

main().catch(async (err) => {
  console.error('\nMigration failed:', err.message)
  await sql.end()
  process.exit(1)
})
