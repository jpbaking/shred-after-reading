export interface ExpiryRequest {
  amount: number
  unit: 'minutes' | 'hours' | 'days' | 'months' | 'year'
}

export interface ExpiryLimit {
  amount: number
  unit: 'minutes' | 'hours' | 'days' | 'months' | 'year'
}

export class ExpiryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExpiryError'
  }
}

export function calculateExpiry(
  base: Date,
  requested: ExpiryRequest,
  limit: ExpiryLimit
): Date {
  // Validate requested expiry
  if (requested.amount <= 0 || !Number.isInteger(requested.amount)) {
    throw new ExpiryError('Expiry amount must be a positive integer')
  }

  // Validate limit
  if (limit.amount <= 0 || !Number.isInteger(limit.amount)) {
    throw new ExpiryError('Global expiry limit must be a positive integer')
  }

  // Convert both to minutes for comparison
  const requestedMinutes = expiryToMinutes(requested)
  const limitMinutes = expiryToMinutes(limit)

  // Clamp to limit
  const clampedMinutes = Math.min(requestedMinutes, limitMinutes)

  // Calculate expiry date by setting components directly to avoid Date overflow
  const expiryDate = new Date(base.getTime())

  if (requested.unit === 'year') {
    const years = Math.floor(clampedMinutes / (365 * 24 * 60))
    const remainingMinutes = clampedMinutes % (365 * 24 * 60)
    expiryDate.setFullYear(expiryDate.getFullYear() + years)
    if (remainingMinutes > 0) {
      expiryDate.setMinutes(expiryDate.getMinutes() + remainingMinutes)
    }
  } else if (requested.unit === 'months') {
    const months = Math.floor(clampedMinutes / (30 * 24 * 60))
    const remainingMinutes = clampedMinutes % (30 * 24 * 60)
    expiryDate.setMonth(expiryDate.getMonth() + months)
    if (remainingMinutes > 0) {
      expiryDate.setMinutes(expiryDate.getMinutes() + remainingMinutes)
    }
  } else if (requested.unit === 'days') {
    const days = Math.floor(clampedMinutes / (24 * 60))
    const remainingMinutes = clampedMinutes % (24 * 60)
    expiryDate.setDate(expiryDate.getDate() + days)
    if (remainingMinutes > 0) {
      expiryDate.setMinutes(expiryDate.getMinutes() + remainingMinutes)
    }
  } else if (requested.unit === 'hours') {
    const hours = Math.floor(clampedMinutes / 60)
    const remainingMinutes = clampedMinutes % 60
    expiryDate.setHours(expiryDate.getHours() + hours)
    if (remainingMinutes > 0) {
      expiryDate.setMinutes(expiryDate.getMinutes() + remainingMinutes)
    }
  } else {
    // minutes
    expiryDate.setMinutes(expiryDate.getMinutes() + clampedMinutes)
  }

  return expiryDate
}

export function defaultExpiry(base: Date, limit: ExpiryLimit = { amount: 365, unit: 'days' }): Date {
  return calculateExpiry(base, { amount: 7, unit: 'days' }, limit)
}

export function expiryToMinutes(expiry: ExpiryRequest): number {
  switch (expiry.unit) {
    case 'minutes':
      return expiry.amount
    case 'hours':
      return expiry.amount * 60
    case 'days':
      return expiry.amount * 24 * 60
    case 'months':
      return expiry.amount * 30 * 24 * 60
    case 'year':
      return expiry.amount * 365 * 24 * 60
  }
}
