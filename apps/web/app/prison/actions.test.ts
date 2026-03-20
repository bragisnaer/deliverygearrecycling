import { describe, it } from 'vitest'

// Wave 0 stubs — prison Server Action tests
// These todos map to INTAKE requirements and will be implemented in later Phase 5 plans.

describe('requirePrisonSession', () => {
  it.todo('requirePrisonSession rejects non-prison roles') // INTAKE-01
})

describe('submitIntake', () => {
  it.todo('submitIntake validates required fields') // INTAKE-03
  it.todo('submitIntake pre-fills informed_quantity from pickup_lines') // INTAKE-04
  it.todo('submitIntake flags discrepancy when line exceeds threshold') // INTAKE-06
  it.todo('submitIntake blocks when batch_flags match found') // INTAKE-07
})

describe('submitUnexpectedIntake', () => {
  it.todo('submitUnexpectedIntake creates record with is_unexpected=true') // INTAKE-05
})
