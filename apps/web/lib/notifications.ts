// Notification type classification (NOTIF-02: critical types cannot be muted)
export const CRITICAL_NOTIFICATION_TYPES = [
  'discrepancy_detected',
  'uninvoiced_delivery',
  'defective_batch_match',
  'facility_inactive',
] as const

export const NON_CRITICAL_NOTIFICATION_TYPES = [
  'pickup_submitted',
  'pickup_confirmed',
  'transport_booked',
  'pickup_collected',
  'pallets_received',
  'warehouse_ageing',
  'outbound_dispatched',
  'delivery_completed',
  'unexpected_intake',
  'processing_submitted',
] as const

export type CriticalNotificationType = (typeof CRITICAL_NOTIFICATION_TYPES)[number]
export type NonCriticalNotificationType = (typeof NON_CRITICAL_NOTIFICATION_TYPES)[number]
export type NotificationType = CriticalNotificationType | NonCriticalNotificationType

export function isCritical(type: string): boolean {
  return (CRITICAL_NOTIFICATION_TYPES as readonly string[]).includes(type)
}

// All notification types with metadata for display
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  discrepancy_detected: 'Discrepancy Detected',
  uninvoiced_delivery: 'Uninvoiced Delivery',
  defective_batch_match: 'Defective Batch Match',
  facility_inactive: 'Facility Inactive',
  pickup_submitted: 'Pickup Submitted',
  pickup_confirmed: 'Pickup Confirmed',
  transport_booked: 'Transport Booked',
  pickup_collected: 'Pickup Collected',
  pallets_received: 'Pallets Received',
  warehouse_ageing: 'Warehouse Ageing Alert',
  outbound_dispatched: 'Outbound Dispatched',
  delivery_completed: 'Delivery Completed',
  unexpected_intake: 'Unexpected Intake',
  processing_submitted: 'Processing Report Submitted',
}
