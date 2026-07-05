import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../../.env', import.meta.url) })

export interface AppConfig {
  port: number
  bodySizeLimit: number
  adminEmail: string
  adminPassword: string
  appBaseUrl: string
  cookieSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpFromAddress: string
  sessionTtlHours: number
  rememberMeTtlDays: number
  emailVerificationTtlDays: number
}

export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function parseNumber(key: string, defaultValue?: number): number {
  const value = getEnv(key, defaultValue?.toString())
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Invalid number for environment variable: ${key}`)
  }
  return parsed
}

export function parseBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined || value === '') {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  throw new Error(`Invalid boolean for environment variable: ${key}`)
}

export function validateConfig(): AppConfig {
  const appBaseUrl = getEnv('APP_BASE_URL', 'http://localhost:8080')
  const config: AppConfig = {
    port: parseNumber('PORT', 3000),
    bodySizeLimit: parseNumber('BODY_SIZE_LIMIT', 1048576),
    adminEmail: getEnv('ADMIN_EMAIL'),
    adminPassword: getEnv('ADMIN_PASSWORD'),
    appBaseUrl,
    cookieSecure: parseBoolean('COOKIE_SECURE', appBaseUrl.startsWith('https://')),
    smtpHost: getEnv('SMTP_HOST', 'mailpit'),
    smtpPort: parseNumber('SMTP_PORT', 1025),
    smtpFromAddress: getEnv('SMTP_FROM_ADDRESS', 'noreply@shred-after-reading.local'),
    sessionTtlHours: parseNumber('SESSION_TTL_HOURS', 24),
    rememberMeTtlDays: parseNumber('REMEMBER_ME_TTL_DAYS', 30),
    emailVerificationTtlDays: parseNumber('EMAIL_VERIFICATION_TTL_DAYS', 7),
  }

  if (!config.adminEmail || !config.adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set')
  }

  return config
}

export const config = validateConfig()

export function parseBodySizeLimitBytes(limit: number): string {
  if (limit <= 1024) {
    return `${limit}B`
  }
  if (limit <= 1048576) {
    return `${(limit / 1024).toFixed(0)}KB`
  }
  return `${(limit / 1048576).toFixed(0)}MB`
}
