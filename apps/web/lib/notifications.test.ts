import { describe, it } from 'vitest'

// These imports will resolve once Plan 01 creates the file
// For now, stub tests use todo() to mark as pending

describe('notification type classification', () => {
  it.todo('CRITICAL_NOTIFICATION_TYPES contains exactly 4 critical types')

  it.todo('NON_CRITICAL_NOTIFICATION_TYPES contains exactly 10 non-critical types')

  it.todo('isCritical returns true for discrepancy_detected')

  it.todo('isCritical returns true for uninvoiced_delivery')

  it.todo('isCritical returns true for defective_batch_match')

  it.todo('isCritical returns true for facility_inactive')

  it.todo('isCritical returns false for pickup_submitted')

  it.todo('isCritical returns false for pickup_confirmed')

  it.todo('NOTIFICATION_TYPE_LABELS has an entry for every notification type')
})

describe('mute preference guard', () => {
  it.todo('saveMutePreference rejects critical notification types')

  it.todo('saveMutePreference accepts non-critical notification types')
})
