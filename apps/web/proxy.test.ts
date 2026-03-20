import { describe, it, expect } from 'vitest'
import { getTenantFromHost } from './proxy'

describe('getTenantFromHost', () => {
  it('resolves ops.courierrecycling.com to ops context', () => {
    expect(getTenantFromHost('ops.courierrecycling.com', 'custom'))
      .toEqual({ context: 'ops', tenantSlug: null })
  })

  it('resolves wolt.courierrecycling.com to client context with slug', () => {
    expect(getTenantFromHost('wolt.courierrecycling.com', 'custom'))
      .toEqual({ context: 'client', tenantSlug: 'wolt' })
  })

  it('resolves ikea.courierrecycling.com to client context with slug', () => {
    expect(getTenantFromHost('ikea.courierrecycling.com', 'custom'))
      .toEqual({ context: 'client', tenantSlug: 'ikea' })
  })

  it('resolves courierrecycling.com to public context', () => {
    expect(getTenantFromHost('courierrecycling.com', 'custom'))
      .toEqual({ context: 'public', tenantSlug: null })
  })

  it('resolves www.courierrecycling.com to public context', () => {
    expect(getTenantFromHost('www.courierrecycling.com', 'custom'))
      .toEqual({ context: 'public', tenantSlug: null })
  })

  it('resolves Azure default domain to ops fallback', () => {
    expect(getTenantFromHost('myapp.azurecontainerapps.io', 'azure-default'))
      .toEqual({ context: 'ops', tenantSlug: null })
  })

  it('resolves Azure default domain by hostname suffix to ops fallback', () => {
    expect(getTenantFromHost('myapp.azurecontainerapps.io', 'custom'))
      .toEqual({ context: 'ops', tenantSlug: null })
  })

  it('resolves localhost to ops for development', () => {
    expect(getTenantFromHost('localhost:3000', 'custom'))
      .toEqual({ context: 'ops', tenantSlug: null })
  })

  it('resolves ops.localhost:3000 to ops context', () => {
    expect(getTenantFromHost('ops.localhost:3000', 'custom'))
      .toEqual({ context: 'ops', tenantSlug: null })
  })

  it('strips port from hostname before parsing', () => {
    expect(getTenantFromHost('wolt.courierrecycling.com:3000', 'custom'))
      .toEqual({ context: 'client', tenantSlug: 'wolt' })
  })
})
