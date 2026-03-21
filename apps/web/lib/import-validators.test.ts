import { describe, it, expect } from 'vitest'
import {
  pickupLogSchema,
  intakeLogSchema,
  greenloopSchema,
  invoiceBinderSchema,
  transportCostSchema,
  validateRows,
  applyColumnMapping,
  resolveForeignKeys,
} from './import-validators'

// ─── Test 1: pickupLogSchema validates a complete valid row ───────────────────
describe('pickupLogSchema', () => {
  it('validates a complete row with all required fields', () => {
    const result = pickupLogSchema.safeParse({
      location_name: 'Copenhagen',
      pallet_count: 5,
      preferred_date: '2024-03-15',
      status: 'delivered',
      notes: 'Handle with care',
    })
    expect(result.success).toBe(true)
  })

  // ─── Test 2: pickupLogSchema rejects missing pallet_count ───────────────────
  it('rejects a row missing required pallet_count with message containing "pallet_count"', () => {
    const result = pickupLogSchema.safeParse({
      location_name: 'Copenhagen',
      preferred_date: '2024-03-15',
      status: 'delivered',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      const paths = result.error.issues.flatMap((i) => i.path.map(String)).join(' ')
      expect(messages + ' ' + paths).toMatch(/pallet_count/i)
    }
  })

  it('applies default status of "delivered" when status is omitted', () => {
    const result = pickupLogSchema.safeParse({
      location_name: 'Oslo',
      pallet_count: 2,
      preferred_date: '2024-01-10',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('delivered')
    }
  })
})

// ─── Test 3: intakeLogSchema validates a complete row ────────────────────────
describe('intakeLogSchema', () => {
  it('validates a complete row and returns success', () => {
    const result = intakeLogSchema.safeParse({
      facility_name: 'Kragskovhede',
      staff_name: 'Lars Nielsen',
      delivery_date: '2024-02-20',
      origin_market: 'Copenhagen',
    })
    expect(result.success).toBe(true)
  })

  // ─── Test 4: intakeLogSchema rejects invalid delivery_date ──────────────────
  it('rejects invalid delivery_date (non-date string) with error message', () => {
    const result = intakeLogSchema.safeParse({
      facility_name: 'Kragskovhede',
      staff_name: 'Lars Nielsen',
      delivery_date: 'not-a-date',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' ')
      expect(messages).toBeTruthy()
    }
  })
})

// ─── Test 5: greenloopSchema validates activity types ────────────────────────
describe('greenloopSchema', () => {
  it('validates wash activity type', () => {
    const result = greenloopSchema.safeParse({
      facility_name: 'Møgelkær',
      staff_name: 'Anna Sørensen',
      activity_type: 'wash',
      product_name: 'Delivery Jacket',
      report_date: '2025-04-10',
      quantity: 50,
    })
    expect(result.success).toBe(true)
  })

  it('validates pack activity type', () => {
    const result = greenloopSchema.safeParse({
      facility_name: 'Renbæk',
      staff_name: 'Erik Hansen',
      activity_type: 'pack',
      product_name: 'Delivery Bag',
      report_date: '2025-05-01',
      quantity: 30,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid activity_type', () => {
    const result = greenloopSchema.safeParse({
      facility_name: 'Møgelkær',
      staff_name: 'Anna Sørensen',
      activity_type: 'sort',
      product_name: 'Delivery Jacket',
      report_date: '2025-04-10',
      quantity: 50,
    })
    expect(result.success).toBe(false)
  })
})

// ─── Test 6: invoiceBinderSchema validates invoice_status ────────────────────
describe('invoiceBinderSchema', () => {
  it('validates known invoice_status values', () => {
    for (const status of ['not_invoiced', 'invoiced', 'paid']) {
      const result = invoiceBinderSchema.safeParse({
        intake_reference: 'IN-2024-0042',
        invoice_status: status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects unknown invoice_status', () => {
    const result = invoiceBinderSchema.safeParse({
      intake_reference: 'IN-2024-0042',
      invoice_status: 'pending',
    })
    expect(result.success).toBe(false)
  })
})

// ─── Test 7: transportCostSchema validates numeric transport cost ─────────────
describe('transportCostSchema', () => {
  it('validates numeric transport cost', () => {
    const result = transportCostSchema.safeParse({
      pickup_reference: 'PU-2024-0017',
      provider_name: 'DSV',
      transport_type: 'direct',
      transport_cost_eur: 250.5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-numeric transport cost', () => {
    const result = transportCostSchema.safeParse({
      pickup_reference: 'PU-2024-0017',
      provider_name: 'DSV',
      transport_type: 'direct',
      transport_cost_eur: 'not-a-number',
    })
    expect(result.success).toBe(false)
  })
})

// ─── Test 8: validateRows returns { valid, errors } with correct row numbers ──
describe('validateRows', () => {
  it('returns valid rows and errors with 1-indexed row numbers starting at 2', () => {
    const rows = [
      // Row 2 (index 0) — valid
      { location_name: 'Aarhus', pallet_count: 3, preferred_date: '2024-06-01', status: 'confirmed' },
      // Row 3 (index 1) — invalid: missing pallet_count
      { location_name: 'Odense', preferred_date: '2024-06-02', status: 'confirmed' },
      // Row 4 (index 2) — valid
      { location_name: 'Aalborg', pallet_count: 1, preferred_date: '2024-06-03', status: 'delivered' },
    ]
    const result = validateRows(rows, pickupLogSchema)
    expect(result.valid).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    // Row 3 in spreadsheet = index 1 → row number 3
    expect(result.errors[0].row).toBe(3)
    expect(result.errors[0].field).toBeTruthy()
    expect(result.errors[0].message).toBeTruthy()
  })
})

// ─── Test 9: applyColumnMapping transforms raw row keys ──────────────────────
describe('applyColumnMapping', () => {
  it('remaps column headers and drops unmapped columns', () => {
    const rows = [
      { 'Location Name': 'Copenhagen', 'Pallet Count': 5, 'Extra Column': 'ignored' },
    ]
    const mapping: Record<string, string> = {
      'Location Name': 'location_name',
      'Pallet Count': 'pallet_count',
    }
    const result = applyColumnMapping(rows, mapping)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ location_name: 'Copenhagen', pallet_count: 5 })
    expect(result[0]).not.toHaveProperty('Extra Column')
    expect(result[0]).not.toHaveProperty('extra_column')
  })
})

// ─── Test 10: resolveForeignKeys replaces names with UUIDs ───────────────────
describe('resolveForeignKeys', () => {
  it('replaces facility_name with prison_facility_id UUID when lookup matches', () => {
    const rows = [
      { facility_name: 'Kragskovhede', staff_name: 'Lars' },
    ]
    const lookups = {
      facilities: { Kragskovhede: 'uuid-facility-1' },
    }
    const result = resolveForeignKeys(rows, lookups)
    expect(result.errors).toHaveLength(0)
    expect(result.resolved[0]).not.toHaveProperty('facility_name')
    expect(result.resolved[0].prison_facility_id).toBe('uuid-facility-1')
  })

  it('adds error when facility_name not found in lookup map', () => {
    const rows = [
      { facility_name: 'Unknown Prison', staff_name: 'Lars' },
    ]
    const lookups = {
      facilities: { Kragskovhede: 'uuid-facility-1' },
    }
    const result = resolveForeignKeys(rows, lookups)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toMatch(/Unknown facility: Unknown Prison/)
    expect(result.errors[0].row).toBe(1)
  })

  it('replaces product_name with product_id UUID when lookup matches', () => {
    const rows = [{ product_name: 'Delivery Jacket', quantity: 10 }]
    const lookups = { products: { 'Delivery Jacket': 'uuid-product-1' } }
    const result = resolveForeignKeys(rows, lookups)
    expect(result.errors).toHaveLength(0)
    expect(result.resolved[0].product_id).toBe('uuid-product-1')
    expect(result.resolved[0]).not.toHaveProperty('product_name')
  })

  it('replaces location_name with location_id UUID when lookup matches', () => {
    const rows = [{ location_name: 'Copenhagen', pallet_count: 2 }]
    const lookups = { locations: { Copenhagen: 'uuid-location-1' } }
    const result = resolveForeignKeys(rows, lookups)
    expect(result.errors).toHaveLength(0)
    expect(result.resolved[0].location_id).toBe('uuid-location-1')
    expect(result.resolved[0]).not.toHaveProperty('location_name')
  })

  it('replaces provider_name with transport_provider_id UUID', () => {
    const rows = [{ provider_name: 'DSV', transport_type: 'direct', transport_cost_eur: 100 }]
    const lookups = { providers: { DSV: 'uuid-provider-1' } }
    const result = resolveForeignKeys(rows, lookups)
    expect(result.errors).toHaveLength(0)
    expect(result.resolved[0].transport_provider_id).toBe('uuid-provider-1')
    expect(result.resolved[0]).not.toHaveProperty('provider_name')
  })
})
