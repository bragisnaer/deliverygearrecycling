// Demo seed — creates a realistic dataset for local user testing.
// Covers every role and every major lifecycle state so testers can walk
// through the full platform without having to create their own data.
//
// Run: pnpm --filter @repo/db seed:demo
//
// Idempotent: guarded by onConflictDoNothing() and explicit checks;
// safe to re-run against a database that already contains Wolt seed data.
//
// Requires: DATABASE_URL pointing to a superuser connection (local postgres)
//           or a service_role connection (Supabase).
//           All tables have FORCE ROW LEVEL SECURITY — the connecting role
//           must have BYPASSRLS (superuser or service_role on Supabase).

import { eq } from 'drizzle-orm'
import { db } from './db'
import {
  users,
  tenants,
  prisonFacilities,
  locations,
  transportProviders,
  transportProviderClients,
  pickups,
  pickupLines,
  transportBookings,
  intakeRecords,
  intakeLines,
  processingReports,
  processingReportLines,
  outboundDispatches,
  outboundDispatchLines,
  financialRecords,
  notifications,
  products,
} from './schema'

// ─── Fixed UUIDs ─────────────────────────────────────────────────────────────
// Pre-defined so every run produces the same IDs and FK links all hold.

const ID = {
  // Users
  adminUser:     'a0000000-0000-0000-0000-000000000001',
  opsUser:       'a0000000-0000-0000-0000-000000000002',
  clientUser:    'a0000000-0000-0000-0000-000000000003',
  clientUser2:   'a0000000-0000-0000-0000-000000000004',
  prisonUser:    'a0000000-0000-0000-0000-000000000005',
  transportUser: 'a0000000-0000-0000-0000-000000000006',

  // Facilities
  vejleFacility:    'f0000000-0000-0000-0000-000000000001',
  horsensFacility:  'f0000000-0000-0000-0000-000000000002',

  // Locations (Wolt)
  woltCopenhagen: 'c0000000-0000-0000-0000-000000000001',
  woltHelsinki:   'c0000000-0000-0000-0000-000000000002',
  woltMunich:     'c0000000-0000-0000-0000-000000000003',

  // Transport providers
  directProvider:       'ab000000-0000-0000-0000-000000000001',
  consolidationProvider:'ab000000-0000-0000-0000-000000000002',

  // Pickups — 11 total
  pickup01: 'b0000000-0000-0000-0001-000000000000', // submitted
  pickup02: 'b0000000-0000-0000-0002-000000000000', // submitted
  pickup03: 'b0000000-0000-0000-0003-000000000000', // confirmed
  pickup04: 'b0000000-0000-0000-0004-000000000000', // transport_booked
  pickup05: 'b0000000-0000-0000-0005-000000000000', // picked_up
  pickup06: 'b0000000-0000-0000-0006-000000000000', // delivered
  pickup07: 'b0000000-0000-0000-0007-000000000000', // intake_registered
  pickup08: 'b0000000-0000-0000-0008-000000000000', // intake_registered
  pickup09: 'b0000000-0000-0000-0009-000000000000', // intake_registered (discrepancy)
  pickup10: 'b0000000-0000-0000-0010-000000000000', // intake_registered
  pickup11: 'b0000000-0000-0000-0011-000000000000', // cancelled

  // Intake records (linked to pickups 07–10)
  intake07: 'e0000000-0000-0000-0007-000000000000',
  intake08: 'e0000000-0000-0000-0008-000000000000',
  intake09: 'e0000000-0000-0000-0009-000000000000',
  intake10: 'e0000000-0000-0000-0010-000000000000',
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Pre-computed bcrypt hash for 'Demo1234!' (cost 10).
// All demo accounts share this password. Generate a fresh hash with:
//   node -e "const b=require('bcryptjs'); b.hash('Demo1234!',10).then(console.log)"
const DEMO_PASSWORD_HASH = '$2b$10$kXPCehVwHHr7zLymzKWM9.SbhpqhbHOwGUeZdjsF9Ubxw4B93TAIC'

async function main() {
  const passwordHash = DEMO_PASSWORD_HASH

  console.log('==> Seeding demo data...')

  // ── 0. Ensure Wolt tenant ──────────────────────────────────────────────────
  await db
    .insert(tenants)
    .values({ id: 'wolt', name: 'Wolt', active: true })
    .onConflictDoNothing()

  // ── 1. Prison facilities ───────────────────────────────────────────────────
  await db
    .insert(prisonFacilities)
    .values([
      {
        id: ID.vejleFacility,
        slug: 'vejle-fengsel',
        name: 'Vejle Fengsel',
        address: 'Fængslet 1, 7100 Vejle, Denmark',
        contact_email: 'intake@vejle-fengsel.dk',
        active: true,
      },
      {
        id: ID.horsensFacility,
        slug: 'horsens-statsfengsel',
        name: 'Horsens Statsfengsel',
        address: 'Langmarksvej 14, 8700 Horsens, Denmark',
        contact_email: 'intake@horsens-statsfengsel.dk',
        active: true,
      },
    ])
    .onConflictDoNothing()

  // ── 2. Wolt pickup locations ───────────────────────────────────────────────
  await db
    .insert(locations)
    .values([
      {
        id: ID.woltCopenhagen,
        tenant_id: 'wolt',
        name: 'Wolt Denmark HQ',
        address: 'Frederiksberg Allé 1, 1820 Frederiksberg, Denmark',
        country: 'DK',
        active: true,
      },
      {
        id: ID.woltHelsinki,
        tenant_id: 'wolt',
        name: 'Wolt Finland — Helsinki',
        address: 'Arkadiankatu 6, 00100 Helsinki, Finland',
        country: 'FI',
        active: true,
      },
      {
        id: ID.woltMunich,
        tenant_id: 'wolt',
        name: 'Wolt Germany — Munich',
        address: 'Leopoldstr. 12, 80802 München, Germany',
        country: 'DE',
        active: true,
      },
    ])
    .onConflictDoNothing()

  // ── 3. Demo users ──────────────────────────────────────────────────────────
  await db
    .insert(users)
    .values([
      {
        id: ID.adminUser,
        name: 'Alex Admin',
        email: 'admin@reco.demo',
        role: 'reco-admin',
        tenant_id: null,
        password_hash: passwordHash,
        active: true,
      },
      {
        id: ID.opsUser,
        name: 'Olivia Ops',
        email: 'ops@reco.demo',
        role: 'reco',
        tenant_id: null,
        password_hash: passwordHash,
        active: true,
      },
      {
        id: ID.clientUser,
        name: 'Chris Client',
        email: 'client@wolt.demo',
        role: 'client',
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        password_hash: passwordHash,
        active: true,
      },
      {
        id: ID.clientUser2,
        name: 'Fiona Finland',
        email: 'finland@wolt.demo',
        role: 'client',
        tenant_id: 'wolt',
        location_id: ID.woltHelsinki,
        password_hash: passwordHash,
        active: true,
      },
      {
        id: ID.prisonUser,
        name: 'Peter Prison',
        email: 'prison@vejle.demo',
        role: 'prison',
        tenant_id: null,
        facility_id: ID.vejleFacility,
        password_hash: passwordHash,
        active: true,
      },
      {
        id: ID.transportUser,
        name: 'Tristan Transport',
        email: 'transport@direct.demo',
        role: 'transport',
        tenant_id: null,
        password_hash: passwordHash,
        active: true,
      },
    ])
    .onConflictDoNothing()

  // ── 4. Transport providers ─────────────────────────────────────────────────
  await db
    .insert(transportProviders)
    .values([
      {
        id: ID.directProvider,
        name: 'DirectFreight A/S',
        contact_email: 'ops@directfreight.dk',
        contact_phone: '+45 70 20 30 40',
        service_regions: 'DK,FI,DE',
        provider_type: 'direct',
        has_platform_access: true,
        user_id: ID.transportUser,
        active: true,
      },
      {
        id: ID.consolidationProvider,
        name: 'Nordic Consolidation ApS',
        contact_email: 'warehouse@nordiclogistics.dk',
        provider_type: 'consolidation',
        warehouse_address: 'Industriparken 8, 2600 Glostrup, Denmark',
        has_platform_access: false,
        active: true,
      },
    ])
    .onConflictDoNothing()

  // Link transport provider to Wolt tenant
  await db
    .insert(transportProviderClients)
    .values([
      {
        transport_provider_id: ID.directProvider,
        tenant_id: 'wolt',
      },
      {
        transport_provider_id: ID.consolidationProvider,
        tenant_id: 'wolt',
      },
    ])
    .onConflictDoNothing()

  // ── 5. Fetch Wolt product IDs (needed for pickup_lines + intake_lines) ─────
  const woltProducts = await db
    .select()
    .from(products)
    .where(eq(products.tenant_id, 'wolt'))

  if (woltProducts.length === 0) {
    throw new Error(
      'Wolt products not found. Run `pnpm --filter @repo/db seed:wolt` first.'
    )
  }

  const prodId = (code: string) => {
    const p = woltProducts.find((p) => p.product_code === code)
    if (!p) throw new Error(`Product not found: "${code}"`)
    return p.id
  }

  const bikeBagId    = prodId('WLT-BB-001')
  const carBagId     = prodId('WLT-CB-001')
  const innerBagId   = prodId('WLT-IB-001')
  const heatingPlateId = prodId('WLT-HP-001')
  const clothingId   = prodId('WLT-CL-001')

  // ── 6. Pickups ──────────────────────────────────────────────────────────────
  // Guard: skip if demo pickups already exist
  const existingPickup = await db
    .select({ id: pickups.id })
    .from(pickups)
    .where(eq(pickups.id, ID.pickup01))

  if (existingPickup.length === 0) {
    await db.insert(pickups).values([
      // --- submitted (2 fresh, awaiting confirmation) ---
      {
        id: ID.pickup01,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'submitted',
        pallet_count: 3,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '8040',
        preferred_date: daysFromNow(5),
        notes: 'Please use the rear loading bay.',
        submitted_by: ID.clientUser,
        created_at: daysAgo(1),
        updated_at: daysAgo(1),
      },
      {
        id: ID.pickup02,
        tenant_id: 'wolt',
        location_id: ID.woltHelsinki,
        status: 'submitted',
        pallet_count: 2,
        preferred_date: daysFromNow(7),
        submitted_by: ID.clientUser2,
        created_at: daysAgo(0),
        updated_at: daysAgo(0),
      },
      // --- confirmed ---
      {
        id: ID.pickup03,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'confirmed',
        pallet_count: 4,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '10720',
        preferred_date: daysFromNow(3),
        confirmed_date: daysFromNow(3),
        submitted_by: ID.clientUser,
        created_at: daysAgo(3),
        updated_at: daysAgo(2),
      },
      // --- transport_booked ---
      {
        id: ID.pickup04,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'transport_booked',
        pallet_count: 5,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '13400',
        preferred_date: daysFromNow(1),
        confirmed_date: daysFromNow(1),
        submitted_by: ID.clientUser,
        created_at: daysAgo(5),
        updated_at: daysAgo(2),
      },
      // --- picked_up ---
      {
        id: ID.pickup05,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'picked_up',
        pallet_count: 3,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '8040',
        preferred_date: daysAgo(2),
        confirmed_date: daysAgo(2),
        submitted_by: ID.clientUser,
        created_at: daysAgo(8),
        updated_at: daysAgo(2),
      },
      // --- delivered (at prison, intake not yet done) ---
      {
        id: ID.pickup06,
        tenant_id: 'wolt',
        location_id: ID.woltHelsinki,
        status: 'delivered',
        pallet_count: 2,
        preferred_date: daysAgo(3),
        confirmed_date: daysAgo(3),
        submitted_by: ID.clientUser2,
        created_at: daysAgo(10),
        updated_at: daysAgo(1),
      },
      // --- intake_registered (fully processed, 4 pickups) ---
      {
        id: ID.pickup07,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'intake_registered',
        pallet_count: 4,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '10720',
        preferred_date: daysAgo(21),
        confirmed_date: daysAgo(21),
        submitted_by: ID.clientUser,
        created_at: daysAgo(28),
        updated_at: daysAgo(20),
      },
      {
        id: ID.pickup08,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'intake_registered',
        pallet_count: 6,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '16080',
        preferred_date: daysAgo(35),
        confirmed_date: daysAgo(35),
        submitted_by: ID.clientUser,
        created_at: daysAgo(42),
        updated_at: daysAgo(34),
      },
      {
        id: ID.pickup09,
        tenant_id: 'wolt',
        location_id: ID.woltHelsinki,
        status: 'intake_registered',
        pallet_count: 3,
        preferred_date: daysAgo(49),
        confirmed_date: daysAgo(49),
        notes: 'Batch LOT-2025-441 flagged — quarantine applied at intake.',
        submitted_by: ID.clientUser2,
        created_at: daysAgo(56),
        updated_at: daysAgo(48),
      },
      {
        id: ID.pickup10,
        tenant_id: 'wolt',
        location_id: ID.woltMunich,
        status: 'intake_registered',
        pallet_count: 5,
        pallet_dimensions: '120x80',
        estimated_weight_grams: '13400',
        preferred_date: daysAgo(63),
        confirmed_date: daysAgo(63),
        submitted_by: ID.clientUser,
        created_at: daysAgo(70),
        updated_at: daysAgo(62),
      },
      // --- cancelled ---
      {
        id: ID.pickup11,
        tenant_id: 'wolt',
        location_id: ID.woltCopenhagen,
        status: 'cancelled',
        pallet_count: 2,
        preferred_date: daysAgo(14),
        confirmed_date: daysAgo(14),
        cancellation_reason: 'Client warehouse access unavailable on scheduled day.',
        cancelled_at: daysAgo(15),
        cancelled_by: ID.adminUser,
        submitted_by: ID.clientUser,
        created_at: daysAgo(20),
        updated_at: daysAgo(15),
      },
    ])

    // ── 6b. Pickup lines (product quantities per pickup) ─────────────────────
    await db.insert(pickupLines).values([
      // pickup01 — 3 pallets, mixed bikes and cars
      { pickup_id: ID.pickup01, product_id: bikeBagId,  quantity: 150 },
      { pickup_id: ID.pickup01, product_id: carBagId,   quantity: 80 },
      { pickup_id: ID.pickup01, product_id: innerBagId, quantity: 150 },
      // pickup02 — 2 pallets, Helsinki, bikes only
      { pickup_id: ID.pickup02, product_id: bikeBagId,  quantity: 100 },
      { pickup_id: ID.pickup02, product_id: innerBagId, quantity: 100 },
      // pickup03 — 4 pallets, mixed
      { pickup_id: ID.pickup03, product_id: bikeBagId,    quantity: 200 },
      { pickup_id: ID.pickup03, product_id: carBagId,     quantity: 100 },
      { pickup_id: ID.pickup03, product_id: innerBagId,   quantity: 200 },
      { pickup_id: ID.pickup03, product_id: heatingPlateId, quantity: 50 },
      // pickup04 — 5 pallets
      { pickup_id: ID.pickup04, product_id: bikeBagId,  quantity: 250 },
      { pickup_id: ID.pickup04, product_id: carBagId,   quantity: 120 },
      { pickup_id: ID.pickup04, product_id: innerBagId, quantity: 250 },
      // pickup05 — 3 pallets, in transit
      { pickup_id: ID.pickup05, product_id: bikeBagId,  quantity: 150 },
      { pickup_id: ID.pickup05, product_id: innerBagId, quantity: 150 },
      // pickup06 — 2 pallets delivered, Helsinki
      { pickup_id: ID.pickup06, product_id: bikeBagId,  quantity: 100 },
      { pickup_id: ID.pickup06, product_id: innerBagId, quantity: 100 },
      // pickup07–10 — completed (for intake reference)
      { pickup_id: ID.pickup07, product_id: bikeBagId,    quantity: 200 },
      { pickup_id: ID.pickup07, product_id: carBagId,     quantity: 90 },
      { pickup_id: ID.pickup07, product_id: innerBagId,   quantity: 200 },
      { pickup_id: ID.pickup07, product_id: heatingPlateId, quantity: 40 },
      { pickup_id: ID.pickup08, product_id: bikeBagId,  quantity: 300 },
      { pickup_id: ID.pickup08, product_id: carBagId,   quantity: 120 },
      { pickup_id: ID.pickup08, product_id: innerBagId, quantity: 300 },
      { pickup_id: ID.pickup09, product_id: bikeBagId,    quantity: 150 },
      { pickup_id: ID.pickup09, product_id: innerBagId,   quantity: 150 },
      { pickup_id: ID.pickup09, product_id: clothingId,   quantity: 80 },
      { pickup_id: ID.pickup10, product_id: bikeBagId,    quantity: 250 },
      { pickup_id: ID.pickup10, product_id: carBagId,     quantity: 100 },
      { pickup_id: ID.pickup10, product_id: innerBagId,   quantity: 250 },
      { pickup_id: ID.pickup10, product_id: heatingPlateId, quantity: 60 },
      // pickup11 — cancelled, no point adding lines
    ])
  } else {
    console.log('    Demo pickups already exist — skipping pickup insert.')
  }

  // ── 7. Transport bookings ──────────────────────────────────────────────────
  const existingBooking = await db
    .select({ id: transportBookings.id })
    .from(transportBookings)
    .where(eq(transportBookings.pickup_id, ID.pickup04))

  if (existingBooking.length === 0) {
    await db.insert(transportBookings).values([
      // pickup04 — transport_booked
      {
        pickup_id: ID.pickup04,
        transport_provider_id: ID.directProvider,
        transport_type: 'direct',
        prison_facility_id: ID.vejleFacility,
        transport_cost_market_to_destination_eur: '185.0000',
        confirmed_pickup_date: daysFromNow(1),
        delivery_notes: 'Use south entrance. Contact Peter at +45 21 30 40 50.',
        booked_by: ID.adminUser,
      },
      // pickup05 — picked_up
      {
        pickup_id: ID.pickup05,
        transport_provider_id: ID.directProvider,
        transport_type: 'direct',
        prison_facility_id: ID.vejleFacility,
        transport_cost_market_to_destination_eur: '155.0000',
        confirmed_pickup_date: daysAgo(2),
        booked_by: ID.adminUser,
      },
      // pickup06 — delivered
      {
        pickup_id: ID.pickup06,
        transport_provider_id: ID.directProvider,
        transport_type: 'direct',
        prison_facility_id: ID.horsensFacility,
        transport_cost_market_to_destination_eur: '210.0000',
        confirmed_pickup_date: daysAgo(3),
        booked_by: ID.adminUser,
      },
      // pickup07 — completed
      {
        pickup_id: ID.pickup07,
        transport_provider_id: ID.directProvider,
        transport_type: 'direct',
        prison_facility_id: ID.vejleFacility,
        transport_cost_market_to_destination_eur: '178.0000',
        confirmed_pickup_date: daysAgo(21),
        booked_by: ID.adminUser,
      },
      // pickup08 — completed
      {
        pickup_id: ID.pickup08,
        transport_provider_id: ID.directProvider,
        transport_type: 'direct',
        prison_facility_id: ID.vejleFacility,
        transport_cost_market_to_destination_eur: '220.0000',
        confirmed_pickup_date: daysAgo(35),
        booked_by: ID.adminUser,
      },
      // pickup09 — completed (consolidation)
      {
        pickup_id: ID.pickup09,
        transport_provider_id: ID.consolidationProvider,
        transport_type: 'consolidation',
        transport_cost_market_to_destination_eur: '95.0000',
        confirmed_pickup_date: daysAgo(49),
        booked_by: ID.adminUser,
      },
      // pickup10 — completed (direct from Germany)
      {
        pickup_id: ID.pickup10,
        transport_provider_id: ID.directProvider,
        transport_type: 'direct',
        prison_facility_id: ID.horsensFacility,
        transport_cost_market_to_destination_eur: '385.0000',
        confirmed_pickup_date: daysAgo(63),
        booked_by: ID.adminUser,
      },
    ])
  }

  // ── 8. Intake records (for pickups 07–10) ─────────────────────────────────
  const existingIntake = await db
    .select({ id: intakeRecords.id })
    .from(intakeRecords)
    .where(eq(intakeRecords.id, ID.intake07))

  if (existingIntake.length === 0) {
    await db.insert(intakeRecords).values([
      // intake07 — clean, no discrepancy
      {
        id: ID.intake07,
        prison_facility_id: ID.vejleFacility,
        pickup_id: ID.pickup07,
        tenant_id: 'wolt',
        staff_name: 'Peter Prison',
        delivery_date: daysAgo(20),
        delivered_at: daysAgo(20),
        origin_market: 'DK',
        discrepancy_flagged: false,
        quarantine_flagged: false,
        notes: 'All pallets intact. Count matches.',
        submitted_by: ID.prisonUser,
        created_at: daysAgo(20),
        updated_at: daysAgo(20),
      },
      // intake08 — minor discrepancy (just under threshold — not flagged)
      {
        id: ID.intake08,
        prison_facility_id: ID.vejleFacility,
        pickup_id: ID.pickup08,
        tenant_id: 'wolt',
        staff_name: 'Peter Prison',
        delivery_date: daysAgo(34),
        delivered_at: daysAgo(34),
        origin_market: 'DK',
        discrepancy_flagged: false,
        quarantine_flagged: false,
        notes: '12 bike bags short vs. informed quantity (within threshold).',
        submitted_by: ID.prisonUser,
        created_at: daysAgo(34),
        updated_at: daysAgo(34),
      },
      // intake09 — discrepancy flagged + quarantine (batch issue)
      {
        id: ID.intake09,
        prison_facility_id: ID.vejleFacility,
        pickup_id: ID.pickup09,
        tenant_id: 'wolt',
        staff_name: 'Peter Prison',
        delivery_date: daysAgo(48),
        delivered_at: daysAgo(48),
        origin_market: 'FI',
        discrepancy_flagged: true,
        quarantine_flagged: true,
        quarantine_overridden: true,
        quarantine_override_reason: 'Batch LOT-2025-441 cleared after re-inspection — no defects found.',
        quarantine_overridden_by: ID.adminUser,
        quarantine_overridden_at: daysAgo(47),
        notes: 'Clothing batch flagged on arrival. Override approved by admin.',
        submitted_by: ID.prisonUser,
        created_at: daysAgo(48),
        updated_at: daysAgo(47),
      },
      // intake10 — clean, Munich delivery to Horsens
      {
        id: ID.intake10,
        prison_facility_id: ID.horsensFacility,
        pickup_id: ID.pickup10,
        tenant_id: 'wolt',
        staff_name: 'Hanne Hansen',
        delivery_date: daysAgo(62),
        delivered_at: daysAgo(62),
        origin_market: 'DE',
        discrepancy_flagged: false,
        quarantine_flagged: false,
        submitted_by: ID.prisonUser,
        created_at: daysAgo(62),
        updated_at: daysAgo(62),
      },
    ])

    // ── 8b. Intake lines ───────────────────────────────────────────────────
    await db.insert(intakeLines).values([
      // intake07 — exact match
      { intake_record_id: ID.intake07, product_id: bikeBagId,    informed_quantity: 200, actual_quantity: 200 },
      { intake_record_id: ID.intake07, product_id: carBagId,     informed_quantity: 90,  actual_quantity: 90  },
      { intake_record_id: ID.intake07, product_id: innerBagId,   informed_quantity: 200, actual_quantity: 200 },
      { intake_record_id: ID.intake07, product_id: heatingPlateId, informed_quantity: 40, actual_quantity: 40 },
      // intake08 — 12 bike bags short (within 15% threshold → not flagged)
      { intake_record_id: ID.intake08, product_id: bikeBagId,    informed_quantity: 300, actual_quantity: 288, discrepancy_pct: '4.00' },
      { intake_record_id: ID.intake08, product_id: carBagId,     informed_quantity: 120, actual_quantity: 120 },
      { intake_record_id: ID.intake08, product_id: innerBagId,   informed_quantity: 300, actual_quantity: 300 },
      // intake09 — discrepancy on clothing (24% over threshold)
      { intake_record_id: ID.intake09, product_id: bikeBagId,    informed_quantity: 150, actual_quantity: 150 },
      { intake_record_id: ID.intake09, product_id: innerBagId,   informed_quantity: 150, actual_quantity: 150 },
      { intake_record_id: ID.intake09, product_id: clothingId,   informed_quantity: 80,  actual_quantity: 99,  discrepancy_pct: '23.75', quarantine_flagged: true, batch_lot_number: 'LOT-2025-441' },
      // intake10 — clean
      { intake_record_id: ID.intake10, product_id: bikeBagId,    informed_quantity: 250, actual_quantity: 250 },
      { intake_record_id: ID.intake10, product_id: carBagId,     informed_quantity: 100, actual_quantity: 100 },
      { intake_record_id: ID.intake10, product_id: innerBagId,   informed_quantity: 250, actual_quantity: 250 },
      { intake_record_id: ID.intake10, product_id: heatingPlateId, informed_quantity: 60, actual_quantity: 60 },
    ])
  } else {
    console.log('    Demo intakes already exist — skipping intake insert.')
  }

  // ── 9. Processing reports (wash + pack for intake07 and intake08) ──────────
  const existingReport = await db
    .select({ id: processingReports.id })
    .from(processingReports)
    .where(eq(processingReports.intake_record_id, ID.intake07))

  if (existingReport.length === 0) {
    // intake07: full cycle — wash then pack
    const [washReport07] = await db
      .insert(processingReports)
      .values({
        prison_facility_id: ID.vejleFacility,
        intake_record_id: ID.intake07,
        tenant_id: 'wolt',
        staff_name: 'Peter Prison',
        activity_type: 'wash',
        product_id: bikeBagId,
        report_date: daysAgo(19),
        notes: 'All bike bags washed. No damage found.',
        submitted_by: ID.prisonUser,
        created_at: daysAgo(19),
        updated_at: daysAgo(19),
      })
      .returning({ id: processingReports.id })

    await db.insert(processingReportLines).values([
      { processing_report_id: washReport07.id, size_bucket: null, quantity: 200 },
    ])

    const [packReport07] = await db
      .insert(processingReports)
      .values({
        prison_facility_id: ID.vejleFacility,
        intake_record_id: ID.intake07,
        tenant_id: 'wolt',
        staff_name: 'Peter Prison',
        activity_type: 'pack',
        product_id: clothingId,
        report_date: daysAgo(18),
        submitted_by: ID.prisonUser,
        created_at: daysAgo(18),
        updated_at: daysAgo(18),
      })
      .returning({ id: processingReports.id })

    await db.insert(processingReportLines).values([
      { processing_report_id: packReport07.id, size_bucket: 'S',  quantity: 45 },
      { processing_report_id: packReport07.id, size_bucket: 'M',  quantity: 78 },
      { processing_report_id: packReport07.id, size_bucket: 'L',  quantity: 52 },
      { processing_report_id: packReport07.id, size_bucket: 'XL', quantity: 25 },
    ])

    // intake08: wash only (pack in progress)
    const [washReport08] = await db
      .insert(processingReports)
      .values({
        prison_facility_id: ID.vejleFacility,
        intake_record_id: ID.intake08,
        tenant_id: 'wolt',
        staff_name: 'Peter Prison',
        activity_type: 'wash',
        product_id: bikeBagId,
        report_date: daysAgo(33),
        notes: 'Wash complete. 288 bags processed.',
        submitted_by: ID.prisonUser,
        created_at: daysAgo(33),
        updated_at: daysAgo(33),
      })
      .returning({ id: processingReports.id })

    await db.insert(processingReportLines).values([
      { processing_report_id: washReport08.id, size_bucket: null, quantity: 288 },
    ])
  }

  // ── 10. Outbound dispatches (for intake07 processed clothing) ──────────────
  const existingDispatch = await db
    .select({ id: outboundDispatches.id })
    .from(outboundDispatches)
    .where(eq(outboundDispatches.intake_record_id, ID.intake07))

  if (existingDispatch.length === 0) {
    const [dispatch] = await db
      .insert(outboundDispatches)
      .values({
        prison_facility_id: ID.vejleFacility,
        tenant_id: 'wolt',
        intake_record_id: ID.intake07,
        dispatch_date: daysAgo(16),
        destination: 'Røde Kors Genbrugsbutikker, Nationwide DK',
        carrier: 'Post Nord',
        notes: '4 boxes, all sealed and labelled.',
        status: 'delivered',
        created_by: ID.adminUser,
        created_at: daysAgo(17),
        updated_at: daysAgo(15),
      })
      .returning({ id: outboundDispatches.id })

    await db.insert(outboundDispatchLines).values([
      { outbound_dispatch_id: dispatch.id, product_id: clothingId, size_bucket: 'S',  quantity: 45 },
      { outbound_dispatch_id: dispatch.id, product_id: clothingId, size_bucket: 'M',  quantity: 78 },
      { outbound_dispatch_id: dispatch.id, product_id: clothingId, size_bucket: 'L',  quantity: 52 },
      { outbound_dispatch_id: dispatch.id, product_id: clothingId, size_bucket: 'XL', quantity: 25 },
    ])

    // A second dispatch in 'created' state (ready to ship)
    const [dispatch2] = await db
      .insert(outboundDispatches)
      .values({
        prison_facility_id: ID.vejleFacility,
        tenant_id: 'wolt',
        intake_record_id: ID.intake08,
        dispatch_date: daysAgo(5),
        destination: 'Røde Kors Genbrugsbutikker, Nationwide DK',
        carrier: 'Post Nord',
        status: 'created',
        created_by: ID.adminUser,
        created_at: daysAgo(6),
        updated_at: daysAgo(6),
      })
      .returning({ id: outboundDispatches.id })

    await db.insert(outboundDispatchLines).values([
      { outbound_dispatch_id: dispatch2.id, product_id: clothingId, size_bucket: 'XS', quantity: 30 },
      { outbound_dispatch_id: dispatch2.id, product_id: clothingId, size_bucket: 'S',  quantity: 55 },
      { outbound_dispatch_id: dispatch2.id, product_id: clothingId, size_bucket: 'M',  quantity: 90 },
      { outbound_dispatch_id: dispatch2.id, product_id: clothingId, size_bucket: 'L',  quantity: 48 },
    ])
  }

  // ── 11. Update financial records (auto-created by trigger on intake insert) ─
  // Set varying invoice states so the finance view looks realistic.
  // intake07 → paid; intake08 → invoiced; intake09 → invoiced; intake10 → not_invoiced
  await db
    .update(financialRecords)
    .set({
      invoice_status: 'paid',
      invoice_number: 'INV-2026-0047',
      invoice_date: daysAgo(10),
      transport_cost_eur: '178.0000',
      estimated_invoice_amount_eur: '1243.80',
      notes: 'Payment confirmed by Wolt accounts 2026-03-12.',
      updated_at: daysAgo(10),
    })
    .where(eq(financialRecords.intake_record_id, ID.intake07))

  await db
    .update(financialRecords)
    .set({
      invoice_status: 'invoiced',
      invoice_number: 'INV-2026-0031',
      invoice_date: daysAgo(25),
      transport_cost_eur: '220.0000',
      estimated_invoice_amount_eur: '1876.40',
      updated_at: daysAgo(25),
    })
    .where(eq(financialRecords.intake_record_id, ID.intake08))

  await db
    .update(financialRecords)
    .set({
      invoice_status: 'invoiced',
      invoice_number: 'INV-2026-0018',
      invoice_date: daysAgo(39),
      transport_cost_eur: '95.0000',
      estimated_invoice_amount_eur: '982.50',
      updated_at: daysAgo(39),
    })
    .where(eq(financialRecords.intake_record_id, ID.intake09))

  // intake10 remains not_invoiced — just update costs
  await db
    .update(financialRecords)
    .set({
      transport_cost_eur: '385.0000',
      estimated_invoice_amount_eur: '2215.60',
      updated_at: daysAgo(55),
    })
    .where(eq(financialRecords.intake_record_id, ID.intake10))

  // ── 12. Notifications ──────────────────────────────────────────────────────
  const existingNotif = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.entity_id, ID.pickup09))

  if (existingNotif.length === 0) {
    await db.insert(notifications).values([
      {
        user_id: ID.adminUser,
        tenant_id: 'wolt',
        type: 'discrepancy_flagged',
        title: 'Discrepancy flagged — intake IN-2026-0009',
        body: 'Clothing count 24% above informed quantity. Quarantine applied.',
        entity_type: 'intake_record',
        entity_id: ID.intake09,
        read: true,
        created_at: daysAgo(48),
      },
      {
        user_id: ID.adminUser,
        tenant_id: 'wolt',
        type: 'pickup_submitted',
        title: 'New pickup submitted — Wolt DK HQ',
        body: 'Chris Client submitted a pickup request for 3 pallets.',
        entity_type: 'pickup',
        entity_id: ID.pickup01,
        read: false,
        created_at: daysAgo(1),
      },
      {
        user_id: ID.adminUser,
        tenant_id: 'wolt',
        type: 'pickup_submitted',
        title: 'New pickup submitted — Wolt FI Helsinki',
        body: 'Fiona Finland submitted a pickup request for 2 pallets.',
        entity_type: 'pickup',
        entity_id: ID.pickup02,
        read: false,
        created_at: daysAgo(0),
      },
      {
        user_id: ID.clientUser,
        tenant_id: 'wolt',
        type: 'pickup_confirmed',
        title: 'Your pickup has been confirmed',
        body: 'Pickup PU-2026-0003 confirmed for collection.',
        entity_type: 'pickup',
        entity_id: ID.pickup03,
        read: false,
        created_at: daysAgo(2),
      },
    ])
  }

  console.log('\nDemo seed complete.')
  console.log('\nDemo login credentials (password for all: Demo1234!):')
  console.log('  reco-admin   →  admin@reco.demo')
  console.log('  reco         →  ops@reco.demo')
  console.log('  client       →  client@wolt.demo     (Wolt Copenhagen)')
  console.log('  client       →  finland@wolt.demo    (Wolt Helsinki)')
  console.log('  prison       →  prison@vejle.demo    (Vejle Fengsel)')
  console.log('  transport    →  transport@direct.demo')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Demo seed failed:', e)
    process.exit(1)
  })
