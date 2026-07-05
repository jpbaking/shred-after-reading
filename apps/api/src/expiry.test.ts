import { describe, expect, it } from 'vitest'
import { calculateExpiry, defaultExpiry } from './expiry.js'

describe('expiry utilities', () => {
  const base = new Date('2026-07-04T00:00:00.000Z')

  it('calculates minute, hour, day, month, and year expiries', () => {
    expect(calculateExpiry(base, { amount: 30, unit: 'minutes' }, { amount: 1, unit: 'year' }).toISOString()).toBe('2026-07-04T00:30:00.000Z')
    expect(calculateExpiry(base, { amount: 6, unit: 'hours' }, { amount: 1, unit: 'year' }).toISOString()).toBe('2026-07-04T06:00:00.000Z')
    expect(calculateExpiry(base, { amount: 10, unit: 'days' }, { amount: 1, unit: 'year' }).toISOString()).toBe('2026-07-14T00:00:00.000Z')
    expect(calculateExpiry(base, { amount: 2, unit: 'months' }, { amount: 1, unit: 'year' }).toISOString()).toBe('2026-09-04T00:00:00.000Z')
    expect(calculateExpiry(base, { amount: 1, unit: 'year' }, { amount: 1, unit: 'year' }).toISOString()).toBe('2027-07-04T00:00:00.000Z')
  })

  it('clamps requested expiry to the global limit', () => {
    const expiry = calculateExpiry(base, { amount: 2, unit: 'year' }, { amount: 1, unit: 'year' })

    expect(expiry.toISOString()).toBe('2027-07-04T00:00:00.000Z')
  })

  it('uses a 7 day default expiry with a 1 year global cap', () => {
    expect(defaultExpiry(base).toISOString()).toBe('2026-07-11T00:00:00.000Z')
  })

  it('rejects invalid requested expiry amounts', () => {
    expect(() => calculateExpiry(base, { amount: 0, unit: 'days' }, { amount: 1, unit: 'year' })).toThrow('Expiry amount')
    expect(() => calculateExpiry(base, { amount: 1.5, unit: 'days' }, { amount: 1, unit: 'year' })).toThrow('Expiry amount')
  })

  it('rejects invalid global expiry amounts', () => {
    expect(() => calculateExpiry(base, { amount: 1, unit: 'days' }, { amount: 0, unit: 'year' })).toThrow('Global expiry limit')
  })
})
