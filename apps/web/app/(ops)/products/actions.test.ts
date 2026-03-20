import { describe, it } from 'vitest'

describe('Product actions (PROD-04, PROD-05)', () => {
  it.todo('createPricingRecord sets effective_to on previous current record')
  it.todo('createPricingRecord rejects if new effective_from <= current effective_from')
  it.todo('updateMaterialComposition closes previous composition and creates new with effective_from')
  it.todo('historical composition query returns correct materials at a past date')
})
