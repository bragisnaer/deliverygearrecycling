import { z } from 'zod'
import type { ImportSourceId } from './import-sources'

// ─── Per-source Zod schemas ───────────────────────────────────────────────────

// pickup_log → pickups + pickup_lines (IMPORT-02)
export const pickupLogSchema = z.object({
  location_name: z.string().min(1, 'Location name is required'),
  pallet_count: z.coerce
    .number()
    .int('Pallet count must be an integer')
    .positive('Pallet count must be positive'),
  preferred_date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date for preferred_date' }),
  }),
  status: z
    .enum([
      'submitted',
      'confirmed',
      'transport_booked',
      'picked_up',
      'at_warehouse',
      'in_outbound_shipment',
      'in_transit',
      'delivered',
      'intake_registered',
      'cancelled',
    ])
    .default('delivered'),
  notes: z.string().optional(),
})

export type PickupLogRow = z.infer<typeof pickupLogSchema>

// intake_log → intake_records + intake_lines (IMPORT-02)
export const intakeLogSchema = z.object({
  facility_name: z.string().min(1, 'Facility name is required'),
  staff_name: z.string().min(1, 'Staff name is required'),
  delivery_date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date for delivery_date' }),
  }),
  origin_market: z.string().optional(),
  notes: z.string().optional(),
})

export type IntakeLogRow = z.infer<typeof intakeLogSchema>

// greenloop → processing_reports (IMPORT-02)
export const greenloopSchema = z.object({
  facility_name: z.string().min(1, 'Facility name is required'),
  staff_name: z.string().min(1, 'Staff name is required'),
  activity_type: z.enum(['wash', 'pack'], {
    errorMap: () => ({ message: 'Activity type must be wash or pack' }),
  }),
  product_name: z.string().min(1, 'Product name is required'),
  report_date: z.coerce.date({
    errorMap: () => ({ message: 'Invalid date for report_date' }),
  }),
  quantity: z.coerce
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be positive'),
  notes: z.string().optional(),
})

export type GreenloopRow = z.infer<typeof greenloopSchema>

// invoice_binder → financial_records (IMPORT-02)
export const invoiceBinderSchema = z.object({
  intake_reference: z.string().min(1, 'Intake reference is required'),
  invoice_status: z.enum(['not_invoiced', 'invoiced', 'paid'], {
    errorMap: () => ({
      message: 'Invoice status must be not_invoiced, invoiced, or paid',
    }),
  }),
  invoice_number: z.string().optional(),
  invoice_date: z.coerce
    .date({ errorMap: () => ({ message: 'Invalid date for invoice_date' }) })
    .optional(),
  notes: z.string().optional(),
})

export type InvoiceBinderRow = z.infer<typeof invoiceBinderSchema>

// transport_costs → transport_bookings (IMPORT-02)
export const transportCostSchema = z.object({
  pickup_reference: z.string().min(1, 'Pickup reference is required'),
  provider_name: z.string().min(1, 'Provider name is required'),
  transport_type: z.enum(['direct', 'consolidation'], {
    errorMap: () => ({
      message: 'Transport type must be direct or consolidation',
    }),
  }),
  transport_cost_eur: z.coerce
    .number()
    .positive('Transport cost must be a positive number'),
})

export type TransportCostRow = z.infer<typeof transportCostSchema>

// ─── Schema selector ─────────────────────────────────────────────────────────

type AnyImportSchema =
  | typeof pickupLogSchema
  | typeof intakeLogSchema
  | typeof greenloopSchema
  | typeof invoiceBinderSchema
  | typeof transportCostSchema

export function getSchemaForSource(sourceId: ImportSourceId): AnyImportSchema {
  switch (sourceId) {
    case 'pickup_log':
      return pickupLogSchema
    case 'intake_log':
      return intakeLogSchema
    case 'greenloop':
      return greenloopSchema
    case 'invoice_binder':
      return invoiceBinderSchema
    case 'transport_costs':
      return transportCostSchema
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export interface ValidationError {
  row: number
  field: string
  message: string
}

/**
 * Validate an array of rows against a Zod schema.
 *
 * Row numbers are 1-indexed starting at 2 (row 1 = headers in spreadsheet).
 * Returns { valid, errors } where errors include row number and field-level messages.
 */
export function validateRows<T>(
  rows: unknown[],
  schema: z.ZodSchema<T>
): { valid: T[]; errors: ValidationError[] } {
  const valid: T[] = []
  const errors: ValidationError[] = []

  rows.forEach((row, index) => {
    // Row 1 = headers in spreadsheet, so data starts at row 2
    const rowNumber = index + 2
    const result = schema.safeParse(row)
    if (result.success) {
      valid.push(result.data)
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path.length > 0 ? String(issue.path[0]) : 'unknown',
          message: issue.message,
        })
      }
    }
  })

  return { valid, errors }
}

// ─── Column mapping ───────────────────────────────────────────────────────────

/**
 * Transform raw spreadsheet rows by remapping column headers to platform field names.
 *
 * Only mapped columns are kept — unmapped columns are dropped.
 * mapping: { 'Original Column Header': 'platform_field_name' }
 */
export function applyColumnMapping(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): Record<string, unknown>[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {}
    for (const [originalKey, platformKey] of Object.entries(mapping)) {
      if (originalKey in row) {
        mapped[platformKey] = row[originalKey]
      }
    }
    return mapped
  })
}

// ─── FK resolution ────────────────────────────────────────────────────────────

export interface FKLookups {
  facilities?: Record<string, string> // name → prison_facility_id UUID
  products?: Record<string, string> // name → product_id UUID
  locations?: Record<string, string> // name → location_id UUID
  intakeReferences?: Record<string, string> // IN-YYYY-NNNN → intake_record_id UUID
  pickupReferences?: Record<string, string> // PU-YYYY-NNNN → pickup_id UUID
  providers?: Record<string, string> // name → transport_provider_id UUID
}

/**
 * Replace string names/references with their UUID equivalents using lookup maps.
 *
 * Resolved rows have the original string field removed and the UUID field added.
 * Rows where a lookup key cannot be resolved are not included in resolved —
 * they produce errors. Row numbers are 1-indexed (1 = first data row).
 */
export function resolveForeignKeys(
  rows: Record<string, unknown>[],
  lookups: FKLookups
): { resolved: Record<string, unknown>[]; errors: ValidationError[] } {
  const resolved: Record<string, unknown>[] = []
  const errors: ValidationError[] = []

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 1
    const row = { ...rawRow }
    let hasError = false

    // facility_name → prison_facility_id
    if ('facility_name' in row && lookups.facilities) {
      const name = String(row.facility_name)
      const uuid = lookups.facilities[name]
      if (uuid) {
        row.prison_facility_id = uuid
        delete row.facility_name
      } else {
        errors.push({
          row: rowNumber,
          field: 'facility_name',
          message: `Unknown facility: ${name}`,
        })
        hasError = true
      }
    }

    // product_name → product_id
    if ('product_name' in row && lookups.products) {
      const name = String(row.product_name)
      const uuid = lookups.products[name]
      if (uuid) {
        row.product_id = uuid
        delete row.product_name
      } else {
        errors.push({
          row: rowNumber,
          field: 'product_name',
          message: `Unknown product: ${name}`,
        })
        hasError = true
      }
    }

    // location_name → location_id
    if ('location_name' in row && lookups.locations) {
      const name = String(row.location_name)
      const uuid = lookups.locations[name]
      if (uuid) {
        row.location_id = uuid
        delete row.location_name
      } else {
        errors.push({
          row: rowNumber,
          field: 'location_name',
          message: `Unknown location: ${name}`,
        })
        hasError = true
      }
    }

    // intake_reference → intake_record_id
    if ('intake_reference' in row && lookups.intakeReferences) {
      const ref = String(row.intake_reference)
      const uuid = lookups.intakeReferences[ref]
      if (uuid) {
        row.intake_record_id = uuid
        delete row.intake_reference
      } else {
        errors.push({
          row: rowNumber,
          field: 'intake_reference',
          message: `Unknown intake reference: ${ref}`,
        })
        hasError = true
      }
    }

    // pickup_reference → pickup_id
    if ('pickup_reference' in row && lookups.pickupReferences) {
      const ref = String(row.pickup_reference)
      const uuid = lookups.pickupReferences[ref]
      if (uuid) {
        row.pickup_id = uuid
        delete row.pickup_reference
      } else {
        errors.push({
          row: rowNumber,
          field: 'pickup_reference',
          message: `Unknown pickup reference: ${ref}`,
        })
        hasError = true
      }
    }

    // provider_name → transport_provider_id
    if ('provider_name' in row && lookups.providers) {
      const name = String(row.provider_name)
      const uuid = lookups.providers[name]
      if (uuid) {
        row.transport_provider_id = uuid
        delete row.provider_name
      } else {
        errors.push({
          row: rowNumber,
          field: 'provider_name',
          message: `Unknown provider: ${name}`,
        })
        hasError = true
      }
    }

    if (!hasError) {
      resolved.push(row)
    }
  })

  return { resolved, errors }
}
