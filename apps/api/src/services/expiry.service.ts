import { AppSettingsService } from './app-settings.service.js'
import { calculateExpiry, ExpiryError, type ExpiryRequest, type ExpiryLimit } from '../expiry.js'

export const GLOBAL_EXPIRY_LIMIT_KEY = 'global_expiry_limit_days'
export const GLOBAL_EXPIRY_LIMIT_MINUTES_KEY = 'global_expiry_limit_minutes'
export const DEFAULT_EXPIRY_KEY = 'default_expiry_days'

const FALLBACK_GLOBAL_LIMIT_DAYS = 365
const FALLBACK_DEFAULT_EXPIRY_DAYS = 7

export const EXPIRY_UNITS = ['minutes', 'hours', 'days', 'months', 'year'] as const

export function parseExpiryRequest(input: unknown): ExpiryRequest {
  if (typeof input !== 'object' || input === null) {
    throw new ExpiryError('Expiry must be an object with amount and unit')
  }

  const { amount, unit } = input as { amount?: unknown; unit?: unknown }

  if (typeof unit !== 'string' || !(EXPIRY_UNITS as readonly string[]).includes(unit)) {
    throw new ExpiryError(`Expiry unit must be one of: ${EXPIRY_UNITS.join(', ')}`)
  }

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new ExpiryError('Expiry amount must be a positive integer')
  }

  return { amount, unit: unit as ExpiryRequest['unit'] }
}

export class ExpiryService {
  private appSettingsService: AppSettingsService

  constructor() {
    this.appSettingsService = new AppSettingsService()
  }

  private async readPositiveIntSetting(key: string, fallback: number): Promise<number> {
    const setting = await this.appSettingsService.getAppSetting(key)
    const parsed = setting?.value ? parseInt(setting.value, 10) : NaN
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return fallback
    }
    return parsed
  }

  async getGlobalLimit(): Promise<ExpiryLimit> {
    const minutes = await this.readPositiveIntSetting(GLOBAL_EXPIRY_LIMIT_MINUTES_KEY, -1)
    if (minutes > 0) {
      return { amount: minutes, unit: 'minutes' }
    }
    const days = await this.readPositiveIntSetting(
      GLOBAL_EXPIRY_LIMIT_KEY,
      FALLBACK_GLOBAL_LIMIT_DAYS,
    )
    return { amount: days, unit: 'days' }
  }

  async getDefaultExpiry(): Promise<ExpiryRequest> {
    const days = await this.readPositiveIntSetting(
      DEFAULT_EXPIRY_KEY,
      FALLBACK_DEFAULT_EXPIRY_DAYS,
    )
    return { amount: days, unit: 'days' }
  }

  /**
   * Resolve a requested expiry (or the configured default) against the
   * database-backed global limit. Server-side authority per PROJECT-DECISIONS.
   */
  async resolveExpiry(base: Date, requested?: ExpiryRequest): Promise<Date> {
    const limit = await this.getGlobalLimit()
    const effective = requested ?? (await this.getDefaultExpiry())
    return calculateExpiry(base, effective, limit)
  }
}
