// Import source definitions — registry of all five historical data sources
// Used by the import wizard for field mapping UI and validation preview (IMPORT-01, IMPORT-02)

export type ImportSourceId =
  | 'pickup_log'
  | 'intake_log'
  | 'greenloop'
  | 'invoice_binder'
  | 'transport_costs'

export interface ImportSourceField {
  key: string // platform field name (e.g. 'delivery_date')
  label: string // human-readable label (e.g. 'Delivery Date')
  required: boolean
  type: 'string' | 'date' | 'number' | 'enum'
  enumValues?: string[] // for enum type fields
  description?: string // help text shown in mapping UI
}

export interface ImportSource {
  id: ImportSourceId
  name: string // e.g. 'Pickup Request Log'
  description: string // e.g. 'Client pickup bookings from 2023-2026'
  targetTable: string // e.g. 'pickups'
  hasLines: boolean // true if target has child line items table
  linesTable?: string // e.g. 'pickup_lines'
  fields: ImportSourceField[]
  lineFields?: ImportSourceField[]
  dateRange: string // e.g. '2023-2026'
}

export const IMPORT_SOURCES: Record<ImportSourceId, ImportSource> = {
  pickup_log: {
    id: 'pickup_log',
    name: 'Pickup Request Log',
    description: 'Client pickup bookings from 2023-2026',
    targetTable: 'pickups',
    hasLines: true,
    linesTable: 'pickup_lines',
    dateRange: '2023-2026',
    fields: [
      {
        key: 'location_name',
        label: 'Location Name',
        required: true,
        type: 'string',
        description: 'Market/location name — resolved to location_id',
      },
      {
        key: 'pallet_count',
        label: 'Pallet Count',
        required: true,
        type: 'number',
      },
      {
        key: 'preferred_date',
        label: 'Preferred Date',
        required: true,
        type: 'date',
      },
      {
        key: 'status',
        label: 'Status',
        required: true,
        type: 'enum',
        enumValues: [
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
        ],
      },
      {
        key: 'notes',
        label: 'Notes',
        required: false,
        type: 'string',
      },
    ],
    lineFields: [
      {
        key: 'product_name',
        label: 'Product Name',
        required: true,
        type: 'string',
        description: 'Product name — resolved to product_id',
      },
      {
        key: 'quantity',
        label: 'Quantity',
        required: true,
        type: 'number',
      },
    ],
  },

  intake_log: {
    id: 'intake_log',
    name: 'Prison Intake Log',
    description: 'Prison intake records from 2022-2026',
    targetTable: 'intake_records',
    hasLines: true,
    linesTable: 'intake_lines',
    dateRange: '2022-2026',
    fields: [
      {
        key: 'facility_name',
        label: 'Facility Name',
        required: true,
        type: 'string',
        description: 'Prison facility name — resolved to prison_facility_id',
      },
      {
        key: 'staff_name',
        label: 'Staff Name',
        required: true,
        type: 'string',
      },
      {
        key: 'delivery_date',
        label: 'Delivery Date',
        required: true,
        type: 'date',
      },
      {
        key: 'origin_market',
        label: 'Origin Market',
        required: false,
        type: 'string',
      },
      {
        key: 'notes',
        label: 'Notes',
        required: false,
        type: 'string',
      },
    ],
    lineFields: [
      {
        key: 'product_name',
        label: 'Product Name',
        required: true,
        type: 'string',
      },
      {
        key: 'actual_quantity',
        label: 'Actual Quantity',
        required: true,
        type: 'number',
      },
      {
        key: 'informed_quantity',
        label: 'Informed Quantity',
        required: false,
        type: 'number',
      },
      {
        key: 'batch_lot_number',
        label: 'Batch/Lot Number',
        required: false,
        type: 'string',
      },
    ],
  },

  greenloop: {
    id: 'greenloop',
    name: 'GreenLoop Processing Reports',
    description: 'Prison processing (wash/pack) data from 2025',
    targetTable: 'processing_reports',
    hasLines: false,
    dateRange: '2025',
    fields: [
      {
        key: 'facility_name',
        label: 'Facility Name',
        required: true,
        type: 'string',
      },
      {
        key: 'staff_name',
        label: 'Staff Name',
        required: true,
        type: 'string',
      },
      {
        key: 'activity_type',
        label: 'Activity Type',
        required: true,
        type: 'enum',
        enumValues: ['wash', 'pack'],
      },
      {
        key: 'product_name',
        label: 'Product Name',
        required: true,
        type: 'string',
      },
      {
        key: 'report_date',
        label: 'Report Date',
        required: true,
        type: 'date',
      },
      {
        key: 'quantity',
        label: 'Quantity',
        required: true,
        type: 'number',
      },
      {
        key: 'notes',
        label: 'Notes',
        required: false,
        type: 'string',
      },
    ],
  },

  invoice_binder: {
    id: 'invoice_binder',
    name: 'Invoice Binder',
    description: 'Invoice status and reference data',
    targetTable: 'financial_records',
    hasLines: false,
    dateRange: '2022-2026',
    fields: [
      {
        key: 'intake_reference',
        label: 'Intake Reference',
        required: true,
        type: 'string',
        description: 'IN-YYYY-NNNN reference — resolved to intake_record_id',
      },
      {
        key: 'invoice_status',
        label: 'Invoice Status',
        required: true,
        type: 'enum',
        enumValues: ['not_invoiced', 'invoiced', 'paid'],
      },
      {
        key: 'invoice_number',
        label: 'Invoice Number',
        required: false,
        type: 'string',
      },
      {
        key: 'invoice_date',
        label: 'Invoice Date',
        required: false,
        type: 'date',
      },
      {
        key: 'notes',
        label: 'Notes',
        required: false,
        type: 'string',
      },
    ],
  },

  transport_costs: {
    id: 'transport_costs',
    name: 'Transport Costs Spreadsheet',
    description: 'Transport booking cost data',
    targetTable: 'transport_bookings',
    hasLines: false,
    dateRange: '2023-2026',
    fields: [
      {
        key: 'pickup_reference',
        label: 'Pickup Reference',
        required: true,
        type: 'string',
        description: 'PU-YYYY-NNNN reference — resolved to pickup_id',
      },
      {
        key: 'provider_name',
        label: 'Provider Name',
        required: true,
        type: 'string',
        description: 'Transport provider name — resolved to transport_provider_id',
      },
      {
        key: 'transport_type',
        label: 'Transport Type',
        required: true,
        type: 'enum',
        enumValues: ['direct', 'consolidation'],
      },
      {
        key: 'transport_cost_eur',
        label: 'Transport Cost (EUR)',
        required: true,
        type: 'number',
      },
    ],
  },
}
