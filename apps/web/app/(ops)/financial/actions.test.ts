import { describe, it, expect } from 'vitest'
import {
  calculateInvoiceAmount,
  assembleTransportCost,
  formatCurrency,
} from './utils'

describe('calculateInvoiceAmount', () => {
  it('returns sum of (quantity * price) + transport cost', () => {
    const lines = [{ actual_quantity: 10, price_eur: '25.5000' }]
    expect(calculateInvoiceAmount(lines, '50.0000')).toBe('305.0000')
  })

  it('returns transport only when no lines', () => {
    expect(calculateInvoiceAmount([], '100.0000')).toBe('100.0000')
  })

  it('handles null pricing gracefully', () => {
    const lines = [{ actual_quantity: 5, price_eur: null }]
    expect(calculateInvoiceAmount(lines, '0.0000')).toBe('0.0000')
  })
})

describe('assembleTransportCost', () => {
  it('returns sum of both legs', () => {
    expect(assembleTransportCost('120.5000', '30.2500')).toBe('150.7500')
  })

  it('returns leg1 only when leg2 is null (direct delivery)', () => {
    expect(assembleTransportCost('120.5000', null)).toBe('120.5000')
  })

  it('returns null when both legs are null (unexpected delivery)', () => {
    expect(assembleTransportCost(null, null)).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('returns euro sign + amount for EUR', () => {
    expect(formatCurrency('100.0000', 'EUR', '7.4600')).toBe('\u20AC100.00')
  })

  it('returns DKK amount with exchange rate applied', () => {
    expect(formatCurrency('100.0000', 'DKK', '7.4600')).toBe('746.00 DKK')
  })

  it('returns em dash for null amount', () => {
    expect(formatCurrency(null, 'EUR', '7.4600')).toBe('\u2014')
  })
})
