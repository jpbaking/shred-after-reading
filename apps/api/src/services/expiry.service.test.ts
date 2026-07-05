import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../db.js'
import { ExpiryError } from '../expiry.js'
import {
  ExpiryService,
  parseExpiryRequest,
  GLOBAL_EXPIRY_LIMIT_KEY,
  GLOBAL_EXPIRY_LIMIT_MINUTES_KEY,
  DEFAULT_EXPIRY_KEY,
} from './expiry.service.js'

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

describe('parseExpiryRequest', () => {
  it('accepts every documented unit', () => {
    for (const unit of ['minutes', 'hours', 'days', 'months', 'year']) {
      expect(parseExpiryRequest({ amount: 1, unit })).toEqual({ amount: 1, unit })
    }
  })

  it('rejects invalid units', () => {
    expect(() => parseExpiryRequest({ amount: 1, unit: 'weeks' })).toThrow(ExpiryError)
    expect(() => parseExpiryRequest({ amount: 1, unit: 'years' })).toThrow(ExpiryError)
    expect(() => parseExpiryRequest({ amount: 1, unit: '' })).toThrow(ExpiryError)
  })

  it('rejects invalid durations', () => {
    expect(() => parseExpiryRequest({ amount: 0, unit: 'days' })).toThrow(ExpiryError)
    expect(() => parseExpiryRequest({ amount: -3, unit: 'days' })).toThrow(ExpiryError)
    expect(() => parseExpiryRequest({ amount: 1.5, unit: 'days' })).toThrow(ExpiryError)
    expect(() => parseExpiryRequest({ amount: '7', unit: 'days' })).toThrow(ExpiryError)
    expect(() => parseExpiryRequest(null)).toThrow(ExpiryError)
  })
})

describe('ExpiryService', () => {
  const base = new Date('2026-07-04T00:00:00.000Z')
  let service: ExpiryService

  beforeEach(async () => {
    service = new ExpiryService()
    await setSetting(GLOBAL_EXPIRY_LIMIT_KEY, '365')
    await setSetting(GLOBAL_EXPIRY_LIMIT_MINUTES_KEY, String(365 * 24 * 60))
    await setSetting(DEFAULT_EXPIRY_KEY, '7')
  })

  afterAll(async () => {
    await setSetting(GLOBAL_EXPIRY_LIMIT_KEY, '365')
    await setSetting(GLOBAL_EXPIRY_LIMIT_MINUTES_KEY, String(365 * 24 * 60))
    await setSetting(DEFAULT_EXPIRY_KEY, '7')
  })

  it('keeps a below-limit expiry unchanged', async () => {
    const expiry = await service.resolveExpiry(base, { amount: 3, unit: 'days' })
    expect(expiry.toISOString()).toBe('2026-07-07T00:00:00.000Z')
  })

  it('keeps an at-limit expiry unchanged', async () => {
    const expiry = await service.resolveExpiry(base, { amount: 365, unit: 'days' })
    expect(expiry.toISOString()).toBe('2027-07-04T00:00:00.000Z')
  })

  it('clamps an above-limit expiry to the global limit', async () => {
    const expiry = await service.resolveExpiry(base, { amount: 2, unit: 'year' })
    expect(expiry.toISOString()).toBe('2027-07-04T00:00:00.000Z')
  })

  it('uses the configured default when no expiry is requested', async () => {
    const expiry = await service.resolveExpiry(base)
    expect(expiry.toISOString()).toBe('2026-07-11T00:00:00.000Z')
  })

  it('applies a lowered global limit to later expiries', async () => {
    const before = await service.resolveExpiry(base, { amount: 30, unit: 'days' })
    expect(before.toISOString()).toBe('2026-08-03T00:00:00.000Z')

    await setSetting(GLOBAL_EXPIRY_LIMIT_KEY, '10')
    await setSetting(GLOBAL_EXPIRY_LIMIT_MINUTES_KEY, String(10 * 24 * 60))

    const after = await service.resolveExpiry(base, { amount: 30, unit: 'days' })
    expect(after.toISOString()).toBe('2026-07-14T00:00:00.000Z')
  })

  it('falls back to safe defaults when settings are missing or invalid', async () => {
    await setSetting(GLOBAL_EXPIRY_LIMIT_KEY, 'not-a-number')
    await setSetting(GLOBAL_EXPIRY_LIMIT_MINUTES_KEY, 'not-a-number')
    const expiry = await service.resolveExpiry(base, { amount: 2, unit: 'year' })
    expect(expiry.toISOString()).toBe('2027-07-04T00:00:00.000Z')
  })
})
